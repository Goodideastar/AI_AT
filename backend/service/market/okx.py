# backend/service/market/okx.py
import httpx
import logging
from typing import List, Dict, Optional
from datetime import datetime
from service.market.base import MarketDataSource

logger = logging.getLogger(__name__)


class OKXDataSource(MarketDataSource):
    """OKX 数据源"""

    BASE_URL = "https://www.okx.com/api/v5"

    # OKX 行情接口返回的常见计价币种，按长度倒序以便优先匹配（如 USDT 优先于 USD）
    QUOTE_CURRENCIES = ["USDT", "USDC", "BUSD", "TUSD", "FDUSD", "OKB", "ETH", "BTC"]

    # Binance 周期 → OKX bar 周期映射
    INTERVAL_MAP = {
        "1m": "1m",
        "3m": "3m",
        "5m": "5m",
        "15m": "15m",
        "30m": "30m",
        "1h": "1H",
        "2h": "2H",
        "4h": "4H",
        "6h": "6H",
        "12h": "12H",
        "1d": "1D",
        "1w": "1W",
        "1M": "1M",
    }

    def __init__(self):
        super().__init__("okx")
        self.client = httpx.AsyncClient(timeout=10.0)

    def _convert_symbol(self, symbol: str) -> str:
        """将通用交易对格式（如 BTCUSDT）转换为 OKX 格式（如 BTC-USDT）"""
        symbol = symbol.upper()
        for quote in self.QUOTE_CURRENCIES:
            if symbol.endswith(quote):
                base = symbol[:-len(quote)]
                if base:
                    return f"{base}-{quote}"
        # 未匹配到已知计价币种时，按经验返回原值并记录警告
        logger.warning("未能识别交易对 %s 的计价币种，原样传递给 OKX", symbol)
        return symbol

    def _convert_interval(self, interval: str) -> str:
        """将通用周期转换为 OKX bar 周期"""
        bar = self.INTERVAL_MAP.get(interval)
        if not bar:
            logger.warning("未知的 K 线周期 %s，原样传递给 OKX", interval)
            return interval
        return bar

    def _check_response(self, resp: httpx.Response, operation: str, symbol: str):
        """统一校验 OKX 响应：HTTP 状态码 + 业务 code"""
        if resp.status_code != 200:
            raise ValueError(f"OKX API HTTP 错误: {resp.status_code} - {resp.text}")
        data = resp.json()
        code = data.get("code")
        if code != "0":
            msg = data.get("msg", "未知错误")
            raise ValueError(f"OKX API 业务错误: code={code}, msg={msg}")
        if not data.get("data"):
            raise ValueError(f"OKX 返回空数据: {operation} - {symbol}")
        return data["data"]

    async def get_ticker(self, symbol: str) -> Dict:
        """获取24小时行情"""
        okx_symbol = self._convert_symbol(symbol)
        try:
            resp = await self.client.get(
                f"{self.BASE_URL}/market/ticker",
                params={"instId": okx_symbol}
            )
            data = self._check_response(resp, "ticker", symbol)[0]
            return {
                "symbol": symbol,
                "exchange": self.exchange,
                "last_price": float(data["last"]),
                "bid": float(data["bidPx"]),
                "ask": float(data["askPx"]),
                "volume_24h": float(data["vol24h"]),
                "high_24h": float(data["high24h"]),
                "low_24h": float(data["low24h"]),
                "timestamp": datetime.fromtimestamp(int(data["ts"]) / 1000)
            }
        except Exception as e:
            raise ValueError(f"获取行情失败: {symbol} - {e}")

    async def get_klines(
        self,
        symbol: str,
        interval: str,
        start_time: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict]:
        """获取K线数据"""
        okx_symbol = self._convert_symbol(symbol)
        bar = self._convert_interval(interval)
        try:
            params = {
                "instId": okx_symbol,
                "bar": bar,
                "limit": limit
            }
            # OKX 支持以毫秒时间戳作为 before / after 参数
            if start_time:
                params["after"] = int(start_time.timestamp() * 1000)

            resp = await self.client.get(
                f"{self.BASE_URL}/market/candles",
                params=params
            )
            # OKX K 线返回时间倒序，需反转为正序以与 Binance 保持一致
            raw = self._check_response(resp, "klines", symbol)
            raw = list(reversed(raw))

            return [
                {
                    "symbol": symbol,
                    "exchange": self.exchange,
                    "interval": interval,
                    # OKX 字段顺序: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
                    "open_time": datetime.fromtimestamp(int(k[0]) / 1000),
                    "open": float(k[1]),
                    "high": float(k[2]),
                    "low": float(k[3]),
                    "close": float(k[4]),
                    "volume": float(k[5]),
                    "close_time": datetime.fromtimestamp(int(k[0]) / 1000)
                }
                for k in raw
            ]
        except Exception as e:
            raise ValueError(f"获取K线失败: {symbol} - {e}")

    async def get_orderbook(self, symbol: str, limit: int = 20) -> Dict:
        """获取订单簿"""
        okx_symbol = self._convert_symbol(symbol)
        try:
            resp = await self.client.get(
                f"{self.BASE_URL}/market/books",
                params={"instId": okx_symbol, "sz": limit}
            )
            data = self._check_response(resp, "orderbook", symbol)[0]
            return {
                "symbol": symbol,
                "exchange": self.exchange,
                "bids": [[float(p), float(q)] for p, q in data["bids"]],
                "asks": [[float(p), float(q)] for p, q in data["asks"]]
            }
        except Exception as e:
            raise ValueError(f"获取订单簿失败: {symbol} - {e}")

    async def get_trades(self, symbol: str, limit: int = 100) -> List[Dict]:
        """获取最近成交"""
        okx_symbol = self._convert_symbol(symbol)
        try:
            resp = await self.client.get(
                f"{self.BASE_URL}/market/trades",
                params={"instId": okx_symbol, "limit": limit}
            )
            data = self._check_response(resp, "trades", symbol)
            return [
                {
                    "symbol": symbol,
                    "exchange": self.exchange,
                    "price": float(t["price"]),
                    "quantity": float(t["sz"]),
                    # OKX side 表示主动成交方向：buy=主动买入, sell=主动卖出
                    "side": t["side"],
                    "timestamp": datetime.fromtimestamp(int(t["ts"]) / 1000)
                }
                for t in data
            ]
        except Exception as e:
            raise ValueError(f"获取成交记录失败: {symbol} - {e}")

    async def close(self):
        """关闭客户端"""
        await self.client.aclose()
