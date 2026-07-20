# backend/service/market/binance.py
import httpx
from typing import List, Dict, Optional
from datetime import datetime
from service.market.base import MarketDataSource


class BinanceDataSource(MarketDataSource):
    """Binance 数据源"""

    BASE_URL = "https://api.binance.com/api/v3"

    def __init__(self):
        super().__init__("binance")
        self.client = httpx.AsyncClient(timeout=10.0)

    async def get_ticker(self, symbol: str) -> Dict:
        """获取24小时行情"""
        resp = await self.client.get(
            f"{self.BASE_URL}/ticker/24hr",
            params={"symbol": symbol}
        )
        data = resp.json()
        return {
            "symbol": data["symbol"],
            "exchange": self.exchange,
            "last_price": float(data["lastPrice"]),
            "bid": float(data["bidPrice"]),
            "ask": float(data["askPrice"]),
            "volume_24h": float(data["volume"]),
            "high_24h": float(data["highPrice"]),
            "low_24h": float(data["lowPrice"]),
            "timestamp": datetime.fromtimestamp(data["closeTime"] / 1000)
        }

    async def get_klines(
        self,
        symbol: str,
        interval: str,
        start_time: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict]:
        """获取K线数据"""
        params = {
            "symbol": symbol,
            "interval": interval,
            "limit": limit
        }
        if start_time:
            params["startTime"] = int(start_time.timestamp() * 1000)

        resp = await self.client.get(
            f"{self.BASE_URL}/klines",
            params=params
        )
        data = resp.json()

        return [
            {
                "symbol": symbol,
                "exchange": self.exchange,
                "interval": interval,
                "open_time": datetime.fromtimestamp(k[0] / 1000),
                "open": float(k[1]),
                "high": float(k[2]),
                "low": float(k[3]),
                "close": float(k[4]),
                "volume": float(k[5]),
                "close_time": datetime.fromtimestamp(k[6] / 1000)
            }
            for k in data
        ]

    async def get_orderbook(self, symbol: str, limit: int = 20) -> Dict:
        """获取订单簿"""
        resp = await self.client.get(
            f"{self.BASE_URL}/depth",
            params={"symbol": symbol, "limit": limit}
        )
        data = resp.json()
        return {
            "symbol": symbol,
            "exchange": self.exchange,
            "bids": [[float(p), float(q)] for p, q in data["bids"]],
            "asks": [[float(p), float(q)] for p, q in data["asks"]]
        }

    async def get_trades(self, symbol: str, limit: int = 100) -> List[Dict]:
        """获取最近成交"""
        resp = await self.client.get(
            f"{self.BASE_URL}/trades",
            params={"symbol": symbol, "limit": limit}
        )
        data = resp.json()
        return [
            {
                "symbol": symbol,
                "exchange": self.exchange,
                "price": float(t["price"]),
                "quantity": float(t["qty"]),
                "side": t["isBuyerMaker"] and "sell" or "buy",
                "timestamp": datetime.fromtimestamp(t["time"] / 1000)
            }
            for t in data
        ]

    async def close(self):
        await self.client.aclose()
