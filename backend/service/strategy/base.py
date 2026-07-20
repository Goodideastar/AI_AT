# backend/service/strategy/base.py
from abc import ABC, abstractmethod
from typing import Dict, List, Optional
from datetime import datetime


class StrategyBase(ABC):
    """策略基类"""

    def __init__(self, parameters: Dict):
        self.parameters = parameters
        self.positions: List[Dict] = []

    @abstractmethod
    def on_init(self):
        """策略初始化"""
        pass

    @abstractmethod
    def on_bar(self, bar: Dict) -> Optional[Dict]:
        """
        K线更新回调

        Args:
            bar: {"open", "high", "low", "close", "volume", "timestamp"}

        Returns:
            交易信号: {"action": "buy"/"sell", "quantity": float, "price": float}
        """
        pass

    @abstractmethod
    def on_trade(self, trade: Dict):
        """成交回调"""
        pass

    def get_state(self) -> Dict:
        """获取策略状态"""
        return {
            "parameters": self.parameters,
            "positions": self.positions
        }
