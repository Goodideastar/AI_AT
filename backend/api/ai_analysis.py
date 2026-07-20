# backend/api/ai_analysis.py
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Dict
from datetime import datetime
from config.sqlalchemy import SessionLocal
from models.strategy import Strategy
from security.jwt import JWTBearer
from service.market.manager import market_manager
from service.analysis.indicators import add_all_indicators
from service.analysis.ai_analyst import MarketAnalyst
from service.strategy.registry import strategy_registry
from service.backtest.engine import BacktestEngine
from service.trade.risk_manager import RiskManager
import pandas as pd
import jwt
import os

router = APIRouter(tags=["ai_analysis"])

# 全局 MarketAnalyst 单例，避免每次请求都创建 LLM 客户端
_analyst_instance = None

def get_analyst() -> MarketAnalyst:
    """获取 MarketAnalyst 单例"""
    global _analyst_instance
    if _analyst_instance is None:
        _analyst_instance = MarketAnalyst()
    return _analyst_instance


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/ai/analyze")
async def ai_analyze_market(
    data: dict,
    credentials=Depends(JWTBearer())
):
    """AI 市场分析"""
    # 解析用户ID
    token = credentials.credentials
    payload = jwt.decode(token, os.getenv("SECRET_KEY"), algorithms=["HS256"])
    user_id = payload["user_id"]
    
    # 获取参数
    exchange = data.get("exchange", "binance")
    symbol = data.get("symbol", "BTCUSDT")
    interval = data.get("interval", "15m")
    limit = data.get("limit", 100)
    
    # 获取行情数据
    source = market_manager.get_source(exchange)
    klines = await source.get_klines(symbol, interval, limit=limit)
    
    if not klines:
        raise HTTPException(status_code=400, detail="无法获取历史数据")
    
    # 转换为 DataFrame
    df = pd.DataFrame([{
        "timestamp": k["open_time"],
        "open": k["open"],
        "high": k["high"],
        "low": k["low"],
        "close": k["close"],
        "volume": k["volume"]
    } for k in klines])
    
    # 计算技术指标
    df = add_all_indicators(df)
    
    # 提取最新一行的指标数据
    latest_indicators = {}
    if not df.empty:
        last_row = df.iloc[-1]
        for col in df.columns:
            if col not in ['timestamp', 'open', 'high', 'low', 'close', 'volume']:
                val = last_row[col]
                if pd.notna(val):
                    latest_indicators[col] = float(val)
    
    # AI 分析
    analyst = get_analyst()
    analysis = await analyst.analyze_market(symbol, klines, latest_indicators)
    
    # 生成交易信号
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
    credentials=Depends(JWTBearer()),
    db: Session = Depends(get_db)
):
    """AI 策略回测"""
    # 解析用户ID
    token = credentials.credentials
    payload = jwt.decode(token, os.getenv("SECRET_KEY"), algorithms=["HS256"])
    user_id = payload["user_id"]
    
    # 获取参数
    strategy_id = data.get("strategy_id")
    exchange = data.get("exchange", "binance")
    symbol = data.get("symbol", "BTCUSDT")
    interval = data.get("interval", "15m")
    limit = data.get("limit", 500)
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
    
    # 运行回测
    engine = BacktestEngine(strategy_instance, initial_capital)
    result = engine.run(klines)
    
    return {"code": 0, "data": result}


@router.get("/ai/signals")
async def get_ai_signals(
    credentials=Depends(JWTBearer())
):
    """获取 AI 交易信号列表"""
    # 解析用户ID
    token = credentials.credentials
    payload = jwt.decode(token, os.getenv("SECRET_KEY"), algorithms=["HS256"])
    user_id = payload["user_id"]
    
    # 监控的交易对
    symbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT"]
    signals = []
    analyst = get_analyst()
    
    for symbol in symbols:
        try:
            # 获取行情
            source = market_manager.get_source("binance")
            klines = await source.get_klines(symbol, "15m", limit=100)
            
            if not klines:
                continue
            
            # 转换为 DataFrame
            df = pd.DataFrame([{
                "timestamp": k["open_time"],
                "open": k["open"],
                "high": k["high"],
                "low": k["low"],
                "close": k["close"],
                "volume": k["volume"]
            } for k in klines])
            
            # 计算指标
            df = add_all_indicators(df)
            
            # 提取最新一行的指标数据
            latest_indicators = {}
            if not df.empty:
                last_row = df.iloc[-1]
                for col in df.columns:
                    if col not in ['timestamp', 'open', 'high', 'low', 'close', 'volume']:
                        val = last_row[col]
                        if pd.notna(val):
                            latest_indicators[col] = float(val)
            
            # AI 分析
            analysis = await analyst.analyze_market(symbol, klines, latest_indicators)
            signal = await analyst.generate_signal(symbol, analysis)
            
            signals.append({
                "symbol": symbol,
                "analysis": analysis,
                "signal": signal,
                "timestamp": datetime.now().isoformat()
            })
        except Exception as e:
            # 单个交易对分析失败不影响其他
            continue
    
    return {"code": 0, "data": signals}


@router.post("/ai/risk-check")
async def ai_risk_check(
    data: dict,
    credentials=Depends(JWTBearer())
):
    """AI 风控检查"""
    # 解析用户ID
    token = credentials.credentials
    payload = jwt.decode(token, os.getenv("SECRET_KEY"), algorithms=["HS256"])
    user_id = payload["user_id"]
    
    risk_manager = RiskManager()
    
    # 检查持仓限制
    position_value = data.get("position_value", 0)
    position_ok = await risk_manager.check_position_limit(user_id, position_value)
    
    # 检查日内亏损限制
    loss_ok = await risk_manager.check_daily_loss_limit(user_id)
    
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
