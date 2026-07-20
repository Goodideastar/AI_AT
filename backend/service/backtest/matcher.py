# backend/service/backtest/matcher.py
from typing import Dict, Optional


class OrderMatcher:
    """订单撮合器"""
    
    def __init__(self, commission_rate: float = 0.001):
        self.commission_rate = commission_rate
    
    def match(
        self,
        signal: Dict,
        bar: Dict,
        capital: float
    ) -> Optional[Dict]:
        """撮合订单"""
        action = signal["action"]
        quantity = signal["quantity"]
        price = bar["close"]  # 简化：使用收盘价成交
        
        # 计算手续费
        commission = quantity * price * self.commission_rate
        
        # 计算盈亏（简化：假设之前有持仓）
        pnl = -commission  # 开仓只有手续费
        
        return {
            "action": action,
            "quantity": quantity,
            "price": price,
            "commission": commission,
            "pnl": pnl,
            "timestamp": bar.get("timestamp", bar.get("open_time"))
        }
