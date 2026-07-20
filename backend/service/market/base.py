from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from datetime import datetime


class MarketDataSource(ABC):
    """行情数据源基类"""

    def __init__(self, exchange: str):
        self.exchange = exchange

    @abstractmethod
    async def get_ticker(self, symbol: str) -> Dict:
        """获取实时行情"""
        pass

    @abstractmethod
    async def get_klines(
        self,
        symbol: str,
        interval: str,
        start_time: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict]:
        """获取K线数据"""
        pass

    @abstractmethod
    async def get_orderbook(self, symbol: str, limit: int = 20) -> Dict:
        """获取订单簿"""
        pass

    @abstractmethod
    async def get_trades(self, symbol: str, limit: int = 100) -> List[Dict]:
        """获取最近成交"""
        pass
