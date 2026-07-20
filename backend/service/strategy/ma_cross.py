# backend/service/strategy/ma_cross.py
from typing import Dict, Optional
from collections import deque
from service.strategy.base import StrategyBase


class MACrossStrategy(StrategyBase):
    """双均线策略"""

    def __init__(self, parameters: Dict):
        super().__init__(parameters)
        self.fast_period = parameters.get("fast_period", 5)
        self.slow_period = parameters.get("slow_period", 20)
        self.fast_ma = deque(maxlen=self.fast_period)
        self.slow_ma = deque(maxlen=self.slow_period)
        self.prev_fast_ma = None
        self.prev_slow_ma = None

    def on_init(self):
        """初始化"""
        pass

    def on_bar(self, bar: Dict) -> Optional[Dict]:
        """K线更新"""
        close = bar["close"]
        self.fast_ma.append(close)
        self.slow_ma.append(close)

        if len(self.fast_ma) < self.fast_period or len(self.slow_ma) < self.slow_period:
            return None

        fast_ma = sum(self.fast_ma) / len(self.fast_ma)
        slow_ma = sum(self.slow_ma) / len(self.slow_ma)

        signal = None

        # 金叉买入
        if self.prev_fast_ma is not None and self.prev_slow_ma is not None:
            if self.prev_fast_ma <= self.prev_slow_ma and fast_ma > slow_ma:
                signal = {
                    "action": "buy",
                    "quantity": self.parameters.get("quantity", 0.001),
                    "price": close
                }
            # 死叉卖出
            elif self.prev_fast_ma >= self.prev_slow_ma and fast_ma < slow_ma:
                signal = {
                    "action": "sell",
                    "quantity": self.parameters.get("quantity", 0.001),
                    "price": close
                }

        self.prev_fast_ma = fast_ma
        self.prev_slow_ma = slow_ma

        return signal

    def on_trade(self, trade: Dict):
        """成交回调"""
        self.positions.append(trade)
