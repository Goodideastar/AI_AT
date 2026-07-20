# backend/service/strategy/bollinger.py
"""
布林带策略

利用布林带上下轨进行均值回归交易。
入场条件：价格跌破下轨（超卖）时买入
出场条件：价格触及上轨（超买）或回归中轨时卖出
"""

import logging
from typing import Dict, Optional
from collections import deque

from service.strategy.base import StrategyBase

logger = logging.getLogger(__name__)


class BollingerStrategy(StrategyBase):
    """布林带策略"""

    DEFAULT_PARAMS = {
        "period": 20,            # 中轨 SMA 周期
        "num_std": 2.0,          # 标准差倍数
        "stop_loss_pct": 0.03,   # 止损比例 3%
        "take_profit_pct": 0.06, # 止盈比例 6%
    }

    def __init__(self, parameters: Optional[Dict] = None):
        merged = dict(self.DEFAULT_PARAMS)
        if parameters:
            merged.update(parameters)
        super().__init__(merged)

        self._closes: deque = deque(maxlen=200)
        self._entry_price: Optional[float] = None

    def on_init(self):
        """策略初始化"""
        logger.info("布林带策略初始化，参数：%s", self.parameters)
        self._closes.clear()
        self._entry_price = None

    def on_bar(self, bar: Dict) -> Optional[Dict]:
        """K 线更新回调"""
        close = float(bar["close"])
        self._closes.append(close)

        period = self.parameters["period"]
        if len(self._closes) < period:
            return None

        middle, upper, lower = self._calc_bands(period)
        if middle is None:
            return None

        signal = None

        # 出场逻辑优先
        if self._entry_price is not None:
            exit_reason = None
            if close <= self._entry_price * (1 - self.parameters["stop_loss_pct"]):
                exit_reason = "止损"
            elif close >= self._entry_price * (1 + self.parameters["take_profit_pct"]):
                exit_reason = "止盈"
            elif close >= upper:
                exit_reason = "触及上轨"
            elif close >= middle:
                exit_reason = "回归中轨"

            if exit_reason:
                logger.info(
                    "出场信号 [%s]，入场价=%.4f，当前价=%.4f，上轨=%.4f，中轨=%.4f，下轨=%.4f",
                    exit_reason, self._entry_price, close, upper, middle, lower,
                )
                signal = {"action": "sell", "quantity": 1.0, "price": close}
                self._entry_price = None

        # 入场逻辑：价格跌破下轨
        if self._entry_price is None and signal is None:
            if close <= lower:
                logger.info(
                    "入场信号，当前价=%.4f，下轨=%.4f，中轨=%.4f",
                    close, lower, middle,
                )
                signal = {"action": "buy", "quantity": 1.0, "price": close}
                self._entry_price = close

        return signal

    def on_trade(self, trade: Dict):
        """成交回调"""
        logger.info("成交回报：%s", trade)

    def _calc_bands(self, period: int):
        """计算布林带三轨：中轨、上轨、下轨"""
        data = list(self._closes)
        if len(data) < period:
            return None, None, None

        window = data[-period:]
        middle = sum(window) / period

        # 计算标准差
        variance = sum((x - middle) ** 2 for x in window) / period
        std = variance ** 0.5

        num_std = self.parameters["num_std"]
        upper = middle + num_std * std
        lower = middle - num_std * std

        return middle, upper, lower
