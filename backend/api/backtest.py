# backend/api/backtest.py
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Dict
from datetime import datetime
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
    credentials=Depends(JWTBearer()),
    db: Session = Depends(get_db)
):
    """运行回测"""
    import jwt
    import os
    
    # 解析用户ID
    token = credentials.credentials
    payload = jwt.decode(token, os.getenv("SECRET_KEY"), algorithms=["HS256"])
    user_id = payload["user_id"]
    
    # 获取策略配置
    strategy_id = data["strategy_id"]
    strategy_config = db.query(Strategy).filter(
        Strategy.id == strategy_id,
        Strategy.user_id == user_id
    ).first()
    
    if not strategy_config:
        raise HTTPException(status_code=404, detail="策略不存在")
    
    # 获取策略类
    strategy_class = strategy_registry.get(strategy_config.strategy_type)
    strategy_instance = strategy_class(strategy_config.parameters)
    
    # 获取历史数据
    exchange = data.get("exchange", "binance")
    symbol = data.get("symbol", "BTCUSDT")
    interval = data.get("interval", "1h")
    limit = data.get("limit", 1000)
    
    source = market_manager.get_source(exchange)
    klines = await source.get_klines(symbol, interval, limit=limit)
    
    if not klines:
        raise HTTPException(status_code=400, detail="无法获取历史数据")
    
    # 运行回测
    initial_capital = data.get("initial_capital", 10000)
    engine = BacktestEngine(strategy_instance, initial_capital)
    result = engine.run(klines)
    
    return {"code": 0, "data": result}
