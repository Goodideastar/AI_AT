# backend/service/backtest/matcher.py
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)


class OrderMatcher:
    """
    订单撮合器（有状态）。
    维护当前持仓：side、quantity、entry_price。
    - 开仓：pnl = -commission（仅手续费）
    - 平仓：pnl = (close_price - entry_price) * qty - commission（多头）
            pnl = (entry_price - close_price) * qty - commission（空头）
    - 反手：先平旧仓再开新仓
    """

    def __init__(self, commission_rate: float = 0.001):
        self.commission_rate = commission_rate
        # 当前持仓状态：None 表示空仓
        self.position_side: Optional[str] = None  # "long" / "short"
        self.position_qty: float = 0.0
        self.entry_price: float = 0.0

    def _reset_position(self) -> None:
        self.position_side = None
        self.position_qty = 0.0
        self.entry_price = 0.0

    def match(
        self,
        signal: Dict,
        bar: Dict,
        capital: float
    ) -> Optional[Dict]:
        """
        撮合订单。
        signal 需包含 action ∈ {"buy", "sell", "close"} 与 quantity。
        bar 提供成交价（默认用 close）。
        """
        action = signal.get("action")
        quantity = float(signal.get("quantity", 0))
        if quantity <= 0 or action is None:
            return None

        price = float(bar.get("close", 0))
        if price <= 0:
            return None

        commission = quantity * price * self.commission_rate
        timestamp = bar.get("timestamp", bar.get("open_time"))

        # 平仓动作：明确平掉当前持仓
        if action == "close":
            if self.position_side is None:
                return None
            pnl = self._calc_close_pnl(price, commission)
            closed_side = self.position_side
            self._reset_position()
            return {
                "action": "close",
                "side": closed_side,
                "quantity": quantity,
                "price": price,
                "commission": commission,
                "pnl": pnl,
                "timestamp": timestamp
            }

        # buy / sell 信号
        new_side = "long" if action == "buy" else "short"

        if self.position_side is None:
            # 空仓 → 开仓
            self.position_side = new_side
            self.position_qty = quantity
            self.entry_price = price
            return {
                "action": action,
                "side": new_side,
                "quantity": quantity,
                "price": price,
                "commission": commission,
                "pnl": -commission,  # 开仓只有手续费
                "timestamp": timestamp
            }

        if self.position_side == new_side:
            # 同向加仓：仅手续费，更新加权均价
            total_cost = self.entry_price * self.position_qty + price * quantity
            self.position_qty += quantity
            self.entry_price = total_cost / self.position_qty if self.position_qty > 0 else price
            return {
                "action": action,
                "side": new_side,
                "quantity": quantity,
                "price": price,
                "commission": commission,
                "pnl": -commission,
                "timestamp": timestamp
            }

        # 反向信号 → 平旧仓（可能部分平仓）
        close_qty = min(quantity, self.position_qty)
        close_commission = close_qty * price * self.commission_rate
        close_pnl = self._calc_close_pnl(price, close_commission, close_qty)
        closed_side = self.position_side

        # 若反向数量超过旧仓，则剩余部分开反向新仓
        remaining = quantity - close_qty
        if remaining > 0:
            self.position_side = new_side
            self.position_qty = remaining
            self.entry_price = price
            open_commission = remaining * price * self.commission_rate
            # 合并 pnl：平仓 pnl + 开仓手续费
            total_pnl = close_pnl - open_commission
            total_commission = close_commission + open_commission
            return {
                "action": action,
                "side": new_side,
                "quantity": quantity,
                "price": price,
                "commission": total_commission,
                "pnl": total_pnl,
                "timestamp": timestamp,
                "closed_side": closed_side,
                "closed_qty": close_qty
            }
        else:
            # 反向数量恰好等于旧仓 → 完全平仓
            self._reset_position()
            return {
                "action": "close",
                "side": closed_side,
                "quantity": close_qty,
                "price": price,
                "commission": close_commission,
                "pnl": close_pnl,
                "timestamp": timestamp
            }

    def _calc_close_pnl(
        self,
        close_price: float,
        commission: float,
        qty: Optional[float] = None
    ) -> float:
        """计算平仓盈亏。qty 默认为全部持仓。"""
        if self.position_side is None:
            return -commission
        close_qty = self.position_qty if qty is None else qty
        if self.position_side == "long":
            pnl = (close_price - self.entry_price) * close_qty - commission
        else:  # short
            pnl = (self.entry_price - close_price) * close_qty - commission
        return pnl
