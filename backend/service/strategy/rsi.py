# backend/service/strategy/rsi.py
"""
RSI（相对强弱指标）策略

使用 RSI 指标判断超买超卖状态产生交易信号。
入场条件：RSI < 超卖阈值（默认30）时买入
出场条件：RSI > 超买阈值（默认70）时卖出
"""

import logging
from typing import Dict, Optional
from collections import deque

from service.strategy.base import StrategyBase

logger = logging.getLogger(__name__)


class RSIStrategy(StrategyBase):
    """RSI 策略"""

    DEFAULT_PARAMS = {
        "rsi_period": 14,        # RSI 周期
        "oversold": 30,          # 超卖阈值
        "overbought": 70,        # 超买阈值
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
        logger.info("RSI 策略初始化，参数：%s", self.parameters)
        self._closes.clear()
        self._entry_price = None

    def on_bar(self, bar: Dict) -> Optional[Dict]:
        """K 线更新回调"""
        close = float(bar["close"])
        self._closes.append(close)

        period = self.parameters["rsi_period"]
        if len(self._closes) < period + 1:
            return None

        rsi = self._calc_rsi(period)
        if rsi is None:
            return None

        signal = None
        oversold = self.parameters["oversold"]
        overbought = self.parameters["overbought"]

        # 出场逻辑优先
        if self._entry_price is not None:
            exit_reason = None
            if close <= self._entry_price * (1 - self.parameters["stop_loss_pct"]):
                exit_reason = "止损"
            elif close >= self._entry_price * (1 + self.parameters["take_profit_pct"]):
                exit_reason = "止盈"
            elif rsi >= overbought:
                exit_reason = "RSI超买"

            if exit_reason:
                logger.info(
                    "出场信号 [%s]，入场价=%.4f，当前价=%.4f，RSI=%.2f",
                    exit_reason, self._entry_price, close, rsi,
                )
                signal = {"action": "sell", "quantity": 1.0, "price": close}
                self._entry_price = None

        # 入场逻辑
        if self._entry_price is None and signal is None:
            if rsi <= oversold:
                logger.info("入场信号，当前价=%.4f，RSI=%.2f", close, rsi)
                signal = {"action": "buy", "quantity": 1.0, "price": close}
                self._entry_price = close

        return signal

    def on_trade(self, trade: Dict):
        """成交回调"""
        logger.info("成交回报：%s", trade)

    def _calc_rsi(self, period: int) -> Optional[float]:
        """计算 RSI（Wilder 平滑法）"""
        data = list(self._closes)
        if len(data) < period + 1:
            return None

        gains = 0.0
        losses = 0.0
        for i in range(1, period + 1):
            delta = data[i] - data[i - 1]
            if delta >= 0:
                gains += delta
            else:
                losses -= delta
        avg_gain = gains / period
        avg_loss = losses / period

        for i in range(period + 1, len(data)):
            delta = data[i] - data[i - 1]
            if delta >= 0:
                avg_gain = (avg_gain * (period - 1) + delta) / period
                avg_loss = (avg_loss * (period - 1)) / period
            else:
                avg_gain = (avg_gain * (period - 1)) / period
                avg_loss = (avg_loss * (period - 1) - delta) / period

        if avg_loss == 0:
            return 100.0
        rs = avg_gain / avg_loss
        return 100.0 - 100.0 / (1.0 + rs)
