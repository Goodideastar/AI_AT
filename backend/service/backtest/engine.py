# backend/service/backtest/engine.py
from typing import List, Dict, Optional
from service.strategy.base import StrategyBase
from service.backtest.matcher import OrderMatcher


# 常见 K 线周期 → 秒数映射
_INTERVAL_SECONDS = {
    "1m": 60, "3m": 180, "5m": 300, "15m": 900, "30m": 1800,
    "1h": 3600, "2h": 7200, "4h": 14400, "6h": 21600, "8h": 28800,
    "12h": 43200, "1d": 86400, "1w": 604800,
}


class BacktestEngine:
    """回测引擎"""

    def __init__(
        self,
        strategy: StrategyBase,
        initial_capital: float = 10000,
        interval: str = "1h"
    ):
        self.strategy = strategy
        self.initial_capital = initial_capital
        self.capital = initial_capital  # 已实现资金（含已平仓盈亏）
        self.trades: List[Dict] = []
        self.equity_curve: List[Dict] = []
        self.matcher = OrderMatcher()
        self.interval = interval
        self.interval_seconds: int = _INTERVAL_SECONDS.get(interval, 3600)

    def run(self, klines: List[Dict]) -> Dict:
        """运行回测"""
        self.strategy.on_init()

        for bar in klines:
            # 更新策略
            signal = self.strategy.on_bar(bar)

            # 处理信号
            if signal:
                trade = self.matcher.match(signal, bar, self.capital)
                if trade:
                    self.trades.append(trade)
                    self.capital += trade["pnl"]
                    self.strategy.on_trade(trade)

            # 记录权益曲线：已实现资金 + 未实现盈亏
            unrealized = self._unrealized_pnl(bar.get("close", 0))
            equity = self.capital + unrealized
            self.equity_curve.append({
                "timestamp": bar.get("timestamp", bar.get("open_time")),
                "equity": equity,
                "price": bar.get("close", 0)
            })

        # 计算绩效指标
        from service.backtest.metrics import calculate_metrics
        metrics = calculate_metrics(
            self.equity_curve,
            self.trades,
            interval_seconds=self.interval_seconds
        )

        return {
            "initial_capital": self.initial_capital,
            "final_capital": self.equity_curve[-1]["equity"] if self.equity_curve else self.capital,
            "total_return": (
                (self.equity_curve[-1]["equity"] - self.initial_capital) / self.initial_capital
                if self.equity_curve and self.initial_capital > 0
                else 0.0
            ),
            "trades": self.trades,
            "equity_curve": self.equity_curve,
            "metrics": metrics
        }

    def _unrealized_pnl(self, current_price: float) -> float:
        """计算当前持仓的未实现盈亏（用于权益曲线）"""
        if self.matcher.position_side is None or current_price <= 0:
            return 0.0
        qty = self.matcher.position_qty
        entry = self.matcher.entry_price
        if self.matcher.position_side == "long":
            return (current_price - entry) * qty
        else:  # short
            return (entry - current_price) * qty
