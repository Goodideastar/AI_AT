# backend/service/market/manager.py
from typing import Dict, Optional
from service.market.base import MarketDataSource
from service.market.binance import BinanceDataSource
from service.market.okx import OKXDataSource


class MarketDataManager:
    """行情数据管理器"""

    def __init__(self):
        self.sources: Dict[str, MarketDataSource] = {
            "binance": BinanceDataSource(),
            "okx": OKXDataSource()
        }
    
    def get_source(self, exchange: str) -> MarketDataSource:
        """获取数据源"""
        if exchange not in self.sources:
            raise ValueError(f"不支持的交易所: {exchange}")
        return self.sources[exchange]
    
    async def close_all(self):
        """关闭所有数据源"""
        for source in self.sources.values():
            if hasattr(source, 'close'):
                await source.close()


# 全局单例
market_manager = MarketDataManager()
