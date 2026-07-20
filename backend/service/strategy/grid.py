# backend/service/strategy/grid.py
"""
网格交易策略

在设定的价格区间内按等间距分布网格，价格触及下沿买入，触及上沿卖出。
适用于震荡市场，通过反复低买高卖获利。
"""

import logging
from typing import Dict, Optional, List

from service.strategy.base import StrategyBase

logger = logging.getLogger(__name__)


class GridStrategy(StrategyBase):
    """网格交易策略"""

    DEFAULT_PARAMS = {
        "lower_price": 0.0,       # 网格下沿价格
        "upper_price": 0.0,       # 网格上沿价格
        "grid_count": 10,         # 网格数量
        "quantity_per_grid": 0.001,  # 每格交易数量
    }

    def __init__(self, parameters: Optional[Dict] = None):
        merged = dict(self.DEFAULT_PARAMS)
        if parameters:
            merged.update(parameters)
        super().__init__(merged)

        self._grid_levels: List[float] = []  # 网格价位列表
        self._filled_grids: set = set()      # 已买入的网格索引
        self._initialized = False

    def on_init(self):
        """策略初始化"""
        logger.info("网格策略初始化，参数：%s", self.parameters)
        self._grid_levels = []
        self._filled_grids = set()
        self._initialized = False

    def _init_grid(self):
        """初始化网格价位"""
        lower = self.parameters["lower_price"]
        upper = self.parameters["upper_price"]
        count = self.parameters["grid_count"]

        if lower <= 0 or upper <= 0 or upper <= lower or count <= 0:
            logger.warning("网格参数无效：lower=%s, upper=%s, count=%s", lower, upper, count)
            return

        step = (upper - lower) / count
        self._grid_levels = [lower + i * step for i in range(count + 1)]
        self._initialized = True
        logger.info("网格初始化完成，共 %d 个价位", len(self._grid_levels))

    def on_bar(self, bar: Dict) -> Optional[Dict]:
        """K 线更新回调"""
        if not self._initialized:
            self._init_grid()
            if not self._initialized:
                return None

        close = float(bar["close"])
        quantity = self.parameters["quantity_per_grid"]

        signal = None

        # 从下往上扫描，寻找第一个未填充且价格已触及的网格
        for i, level in enumerate(self._grid_levels):
            if i in self._filled_grids:
                continue

            # 价格跌破该网格水平 → 买入
            if close <= level:
                logger.info(
                    "网格买入：网格 %d @ %.4f，当前价=%.4f",
                    i, level, close,
                )
                signal = {"action": "buy", "quantity": quantity, "price": close}
                self._filled_grids.add(i)
                break

        # 如果没有买入信号，检查是否需要卖出（价格回升到上一格）
        if signal is None and self._filled_grids:
            for i in sorted(self._filled_grids, reverse=True):
                # 价格回升到上一网格水平 → 卖出
                if i + 1 < len(self._grid_levels) and close >= self._grid_levels[i + 1]:
                    logger.info(
                        "网格卖出：网格 %d @ %.4f，当前价=%.4f",
                        i, self._grid_levels[i + 1], close,
                    )
                    signal = {"action": "sell", "quantity": quantity, "price": close}
                    self._filled_grids.discard(i)
                    break

        return signal

    def on_trade(self, trade: Dict):
        """成交回调"""
        logger.info("成交回报：%s", trade)

    def get_state(self) -> Dict:
        """获取策略状态"""
        state = super().get_state()
        state.update({
            "grid_levels": self._grid_levels,
            "filled_grids": list(self._filled_grids),
            "initialized": self._initialized,
        })
        return state
