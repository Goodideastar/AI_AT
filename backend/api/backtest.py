# backend/api/backtest.py
import asyncio
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from config.sqlalchemy import SessionLocal
from models.strategy import Strategy
from security.jwt import JWTBearer
from service.market.manager import market_manager
from service.strategy.registry import strategy_registry
from service.backtest.engine import BacktestEngine

router = APIRouter(tags=["backtest"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/backtest/run")
async def run_backtest(
    data: dict,
    credentials: dict = Depends(JWTBearer()),
    db: Session = Depends(get_db)
):
    """运行回测"""
    user_id = credentials.get("user_id")

    # 获取策略配置（strategy_id 可选，未提供则返回 400）
    strategy_id = data.get("strategy_id")
    if not strategy_id:
        raise HTTPException(status_code=400, detail="缺少 strategy_id 参数")
    strategy_config = db.query(Strategy).filter(
        Strategy.id == strategy_id,
        Strategy.user_id == user_id
    ).first()

    if not strategy_config:
        raise HTTPException(status_code=404, detail="策略不存在")

    # 获取策略类
    strategy_class = strategy_registry.get(strategy_config.strategy_type)
    strategy_instance = strategy_class(strategy_config.parameters)

    # 获取历史数据（限制 limit ≤ 1000，避免交易所 400 错误）
    exchange = data.get("exchange", "binance")
    symbol = data.get("symbol", "BTCUSDT")
    interval = data.get("interval", "1h")
    raw_limit = int(data.get("limit", 1000))
    limit = max(1, min(raw_limit, 1000))

    source = market_manager.get_source(exchange)
    klines = await source.get_klines(symbol, interval, limit=limit)

    if not klines:
        raise HTTPException(status_code=400, detail="无法获取历史数据")

    # 运行回测（CPU 密集，放到线程池避免阻塞事件循环）
    initial_capital = data.get("initial_capital", 10000)
    engine = BacktestEngine(strategy_instance, initial_capital, interval=interval)
    result = await asyncio.to_thread(engine.run, klines)

    return {"code": 0, "data": result}

