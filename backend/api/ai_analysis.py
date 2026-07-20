# backend/api/ai_analysis.py
import asyncio
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import datetime
import logging
from config.sqlalchemy import SessionLocal
from config.redis import redis_client
from models.strategy import Strategy
from security.jwt import JWTBearer
from service.market.manager import market_manager
from service.analysis.indicators import add_all_indicators
from service.analysis.ai_analyst import MarketAnalyst
from service.strategy.registry import strategy_registry
from service.backtest.engine import BacktestEngine
from service.trade.risk_manager import RiskManager
import pandas as pd

logger = logging.getLogger(__name__)
router = APIRouter(tags=["ai_analysis"])

# 全局 MarketAnalyst 单例，避免每次请求都创建 LLM 客户端
_analyst_instance = None


def get_analyst() -> MarketAnalyst:
    """获取 MarketAnalyst 单例"""
    global _analyst_instance
    if _analyst_instance is None:
        _analyst_instance = MarketAnalyst()
    return _analyst_instance


def _incr_rate_key(key: str, limit: int, window: int) -> bool:
    """原子 INCR 限流：返回 True 表示被限制。"""
    current = redis_client.incr(key)
    if current == 1:
        redis_client.expire(key, window)
    return current > limit


def _check_ai_rate_limit(user_id: int) -> bool:
    """AI 端点限流：10 次 / 60 秒（LLM 调用昂贵，需防刷）"""
    return _incr_rate_key(f"ai_call:{user_id}", limit=10, window=60)


def _clamp_limit(raw, default: int = 100) -> int:
    """限制 K 线数量在 [1, 1000] 之间，避免交易所返回 400"""
    try:
        v = int(raw) if raw is not None else default
    except (TypeError, ValueError):
        v = default
    return max(1, min(v, 1000))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _extract_latest_indicators(df: pd.DataFrame) -> dict:
    """从 DataFrame 提取最新一行的技术指标，跳过 OHLCV 列"""
    latest_indicators = {}
    if df.empty:
        return latest_indicators
    last_row = df.iloc[-1]
    for col in df.columns:
        if col in ('timestamp', 'open', 'high', 'low', 'close', 'volume'):
            continue
        val = last_row[col]
        if pd.notna(val):
            try:
                latest_indicators[col] = float(val)
            except (TypeError, ValueError):
                continue
    return latest_indicators


def _klines_to_df(klines):
    """K线列表转 DataFrame"""
    return pd.DataFrame([{
        "timestamp": k["open_time"],
        "open": k["open"],
        "high": k["high"],
        "low": k["low"],
        "close": k["close"],
        "volume": k["volume"]
    } for k in klines])


@router.post("/ai/analyze")
async def ai_analyze_market(
    data: dict,
    credentials: dict = Depends(JWTBearer())
):
    """AI 市场分析"""
    user_id = credentials.get("user_id")

    # 限流：10 次 / 60 秒（LLM 调用昂贵）
    if _check_ai_rate_limit(user_id):
        raise HTTPException(status_code=429, detail="AI 分析调用过于频繁，请稍后再试")

    # 获取参数
    exchange = data.get("exchange", "binance")
    symbol = data.get("symbol", "BTCUSDT")
    interval = data.get("interval", "15m")
    limit = _clamp_limit(data.get("limit", 100))

    # 获取行情数据
    source = market_manager.get_source(exchange)
    klines = await source.get_klines(symbol, interval, limit=limit)

    if not klines:
        raise HTTPException(status_code=400, detail="无法获取历史数据")

    # 计算技术指标（CPU 密集，放到线程池）
    df = _klines_to_df(klines)
    df = await asyncio.to_thread(add_all_indicators, df)
    latest_indicators = _extract_latest_indicators(df)

    # AI 分析
    analyst = get_analyst()
    analysis = await analyst.analyze_market(symbol, klines, latest_indicators)

    # 分析失败时不生成信号
    if "error" in analysis:
        raise HTTPException(status_code=500, detail=analysis["error"])

    signal = await analyst.generate_signal(symbol, analysis)

    return {
        "code": 0,
        "data": {
            "symbol": symbol,
            "exchange": exchange,
            "interval": interval,
            "analysis": analysis,
            "signal": signal,
            "timestamp": datetime.now().isoformat()
        }
    }


@router.post("/ai/backtest")
async def ai_backtest_strategy(
    data: dict,
    credentials: dict = Depends(JWTBearer()),
    db: Session = Depends(get_db)
):
    """AI 策略回测"""
    user_id = credentials.get("user_id")

    # 限流：10 次 / 60 秒
    if _check_ai_rate_limit(user_id):
        raise HTTPException(status_code=429, detail="AI 分析调用过于频繁，请稍后再试")

    # 获取参数
    strategy_id = data.get("strategy_id")
    exchange = data.get("exchange", "binance")
    symbol = data.get("symbol", "BTCUSDT")
    interval = data.get("interval", "15m")
    limit = _clamp_limit(data.get("limit", 500), default=500)
    initial_capital = data.get("initial_capital", 10000)

    # 获取策略
    if strategy_id:
        strategy_config = db.query(Strategy).filter(
            Strategy.id == strategy_id,
            Strategy.user_id == user_id
        ).first()

        if not strategy_config:
            raise HTTPException(status_code=404, detail="策略不存在")

        strategy_class = strategy_registry.get(strategy_config.strategy_type)
        strategy_instance = strategy_class(strategy_config.parameters)
    else:
        # 使用默认日内策略
        from service.strategy.intraday import IntradayStrategy
        strategy_instance = IntradayStrategy({})

    # 获取历史数据
    source = market_manager.get_source(exchange)
    klines = await source.get_klines(symbol, interval, limit=limit)

    if not klines:
        raise HTTPException(status_code=400, detail="无法获取历史数据")

    # 运行回测（CPU 密集，放到线程池）
    engine = BacktestEngine(strategy_instance, initial_capital, interval=interval)
    result = await asyncio.to_thread(engine.run, klines)

    return {"code": 0, "data": result}


@router.get("/ai/signals")
async def get_ai_signals(
    credentials: dict = Depends(JWTBearer())
):
    """获取 AI 交易信号列表（并发分析多个交易对）"""
    user_id = credentials.get("user_id")

    # 限流：10 次 / 60 秒（并发调用 3 个交易对的 LLM，开销大）
    if _check_ai_rate_limit(user_id):
        raise HTTPException(status_code=429, detail="AI 分析调用过于频繁，请稍后再试")

    # 监控的交易对
    symbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT"]
    analyst = get_analyst()
    source = market_manager.get_source("binance")

    async def analyze_one(symbol: str) -> dict:
        try:
            klines = await source.get_klines(symbol, "15m", limit=100)
            if not klines:
                return None

            df = await asyncio.to_thread(add_all_indicators, _klines_to_df(klines))
            latest_indicators = _extract_latest_indicators(df)

            analysis = await analyst.analyze_market(symbol, klines, latest_indicators)
            if "error" in analysis:
                logger.warning("分析 %s 失败: %s", symbol, analysis.get("error"))
                return None

            signal = await analyst.generate_signal(symbol, analysis)
            return {
                "symbol": symbol,
                "analysis": analysis,
                "signal": signal,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            logger.warning("分析 %s 异常: %s", symbol, e)
            return None

    # 并发分析所有交易对
    results = await asyncio.gather(*[analyze_one(s) for s in symbols])
    signals = [r for r in results if r is not None]

    return {"code": 0, "data": signals}


@router.post("/ai/risk-check")
async def ai_risk_check(
    data: dict,
    credentials: dict = Depends(JWTBearer())
):
    """AI 风控检查"""
    user_id = credentials.get("user_id")

    # 限流：10 次 / 60 秒
    if _check_ai_rate_limit(user_id):
        raise HTTPException(status_code=429, detail="AI 调用过于频繁，请稍后再试")

    risk_manager = RiskManager()

    # 检查持仓限制（同步方法，直接调用）
    position_value = data.get("position_value", 0)
    position_ok = risk_manager.check_position_limit(user_id, position_value)

    # 检查日内亏损限制
    loss_ok = risk_manager.check_daily_loss_limit(user_id)

    # 计算建议仓位
    capital = data.get("capital", 10000)
    entry_price = data.get("entry_price", 0)
    stop_price = data.get("stop_price", 0)

    position_size = risk_manager.calculate_position_size(
        capital, 0.02, entry_price, stop_price
    )

    return {
        "code": 0,
        "data": {
            "position_limit_ok": position_ok,
            "daily_loss_limit_ok": loss_ok,
            "suggested_position_size": position_size,
            "risk_level": "低" if position_ok and loss_ok else "高"
        }
    }
