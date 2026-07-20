# backend/service/backtest/engine.py
from typing import List, Dict
from datetime import datetime
from service.strategy.base import StrategyBase
from service.backtest.matcher import OrderMatcher


class BacktestEngine:
    """回测引擎"""
    
    def __init__(
        self,
        strategy: StrategyBase,
        initial_capital: float = 10000
    ):
        self.strategy = strategy
        self.initial_capital = initial_capital
        self.capital = initial_capital
        self.positions: List[Dict] = []
        self.trades: List[Dict] = []
        self.equity_curve: List[Dict] = []
        self.matcher = OrderMatcher()
    
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
            
            # 记录权益曲线
            self.equity_curve.append({
                "timestamp": bar.get("timestamp", bar.get("open_time")),
                "equity": self.capital,
                "price": bar["close"]
            })
        
        # 计算绩效指标
        from service.backtest.metrics import calculate_metrics
        metrics = calculate_metrics(self.equity_curve, self.trades)
        
        return {
            "initial_capital": self.initial_capital,
            "final_capital": self.capital,
            "total_return": (self.capital - self.initial_capital) / self.initial_capital,
            "trades": self.trades,
            "equity_curve": self.equity_curve,
            "metrics": metrics
        }
