from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime
from service.market.manager import market_manager

router = APIRouter(tags=["market"])


@router.get("/market/ticker/{symbol}")
async def get_ticker(
    symbol: str,
    exchange: str = Query(default="binance")
):
    """获取实时行情"""
    try:
        source = market_manager.get_source(exchange)
        ticker = await source.get_ticker(symbol)
        return {"code": 0, "data": ticker}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/market/klines/{symbol}")
async def get_klines(
    symbol: str,
    exchange: str = Query(default="binance"),
    interval: str = Query(default="1h"),
    limit: int = Query(default=100, ge=1, le=1000),
    start_time: Optional[datetime] = None
):
    """获取K线数据"""
    try:
        source = market_manager.get_source(exchange)
        klines = await source.get_klines(symbol, interval, start_time, limit)
        return {"code": 0, "data": klines}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/market/orderbook/{symbol}")
async def get_orderbook(
    symbol: str,
    exchange: str = Query(default="binance"),
    limit: int = Query(default=20, ge=1, le=100)
):
    """获取订单簿"""
    try:
        source = market_manager.get_source(exchange)
        orderbook = await source.get_orderbook(symbol, limit)
        return {"code": 0, "data": orderbook}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
