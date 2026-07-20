from typing import Dict, Type
from service.strategy.base import StrategyBase
from service.strategy.ma_cross import MACrossStrategy
from service.strategy.intraday import IntradayStrategy


class StrategyRegistry:
    """策略注册表"""
    
    def __init__(self):
        self.strategies: Dict[str, Type[StrategyBase]] = {
            "ma_cross": MACrossStrategy,
            "intraday": IntradayStrategy
        }
    
    def register(self, name: str, strategy_class: Type[StrategyBase]):
        """注册策略"""
        self.strategies[name] = strategy_class
    
    def get(self, name: str) -> Type[StrategyBase]:
        """获取策略类"""
        if name not in self.strategies:
            raise ValueError(f"未知策略: {name}")
        return self.strategies[name]
    
    def list_strategies(self) -> list:
        """列出所有策略"""
        return list(self.strategies.keys())


strategy_registry = StrategyRegistry()
