# backend/service/trade/executor.py
from typing import Dict, Optional
import logging
from sqlalchemy.orm import Session
from models.order import Order, OrderSide, OrderType, OrderStatus
from models.position import Position
from service.market.manager import market_manager
from service.trade.risk_manager import RiskManager

logger = logging.getLogger(__name__)


class OrderExecutor:
    """订单执行器"""

    def __init__(self, db: Session):
        self.db = db
        self.risk_manager = RiskManager()

    async def execute_order(
        self,
        user_id: int,
        symbol: str,
        exchange: str,
        side: str,
        order_type: str,
        quantity: float,
        price: float = None,
        strategy_id: int = None
    ) -> Dict:
        """
        执行订单（模拟成交）。
        TODO: 接入真实交易所 API，目前仅更新本地订单和持仓表。
        """
        # ── 1. 解析成交价（市价单需实时拉取） ──
        filled_price: Optional[float] = None
        if order_type == "limit":
            if price is None or price <= 0:
                raise ValueError("限价单必须提供有效的 price")
            filled_price = float(price)
        else:
            # 市价单：从交易所获取最新价作为成交价（避免 0 污染持仓均价）
            try:
                source = market_manager.get_source(exchange)
                ticker = await source.get_ticker(symbol)
                filled_price = float(ticker.get("last_price", 0))
            except Exception as e:
                logger.error("市价单获取最新价失败: user=%s symbol=%s err=%s", user_id, symbol, e)
                raise ValueError(f"获取市场最新价失败: {e}")

            if filled_price <= 0:
                raise ValueError(f"获取到的市场最新价异常: {filled_price}")

        # ── 2. 下单前风控校验（持仓上限 + 单日亏损上限） ──
        new_position_value = filled_price * quantity
        if not self.risk_manager.check_position_limit(user_id, new_position_value):
            raise ValueError("持仓超限，拒绝下单（持仓市值超过账户资金的 30%）")
        if not self.risk_manager.check_daily_loss_limit(user_id):
            raise ValueError("当日亏损已达上限，拒绝下单（亏损超过账户资金的 5%）")

        # ── 3. 单事务原子写入：订单 + 持仓 ──
        try:
            order = Order(
                user_id=user_id,
                strategy_id=strategy_id,
                symbol=symbol,
                exchange=exchange,
                side=OrderSide(side),
                order_type=OrderType(order_type),
                price=price,
                quantity=quantity,
                status=OrderStatus.PENDING,
            )
            self.db.add(order)
            # flush 拿到 order.id（不提交事务，仍可与后续持仓写入一起回滚）
            self.db.flush()

            # 标记成交
            order.status = OrderStatus.FILLED
            order.filled_quantity = quantity
            order.filled_price = filled_price

            # 加行锁更新持仓（避免并发丢失更新）
            self._update_position(user_id, symbol, exchange, side, quantity, filled_price)

            # 一次性提交订单+持仓
            self.db.commit()
            self.db.refresh(order)

            return {
                "order_id": order.id,
                "status": order.status.value,
                "filled_price": order.filled_price,
            }
        except Exception as e:
            # 单事务回滚：订单和持仓都不会落库
            self.db.rollback()
            logger.error("订单执行失败已回滚: user=%s symbol=%s err=%s", user_id, symbol, e)
            raise ValueError(f"订单执行失败: {e}")

    def _update_position(
        self,
        user_id: int,
        symbol: str,
        exchange: str,
        side: str,
        quantity: float,
        filled_price: float,
    ) -> None:
        """根据成交更新持仓表（同一用户同一交易对合并为单条持仓）。

        调用方必须在事务内调用，并已加好行锁（with_for_update）。
        本方法不再自行 commit，由上层统一提交。
        """
        # 加行锁，串行化并发下单的持仓更新
        position = (
            self.db.query(Position)
            .filter(
                Position.user_id == user_id,
                Position.symbol == symbol,
                Position.exchange == exchange,
            )
            .with_for_update()
            .first()
        )

        if side == "buy":
            if position is None:
                # 新建多头持仓
                position = Position(
                    user_id=user_id,
                    symbol=symbol,
                    exchange=exchange,
                    quantity=quantity,
                    avg_price=filled_price,
                )
                self.db.add(position)
            else:
                # 合并持仓：计算新均价
                total_cost = position.avg_price * position.quantity + filled_price * quantity
                position.quantity += quantity
                position.avg_price = total_cost / position.quantity if position.quantity != 0 else filled_price
        elif side == "sell":
            if position is None:
                # 空头开仓（简化处理：记录为负持仓）
                position = Position(
                    user_id=user_id,
                    symbol=symbol,
                    exchange=exchange,
                    quantity=-quantity,
                    avg_price=filled_price,
                )
                self.db.add(position)
            else:
                # 平仓：计算已实现盈亏
                if position.quantity > 0:
                    # 多头平仓
                    realized_pnl = (filled_price - position.avg_price) * min(quantity, position.quantity)
                    position.realized_pnl = (position.realized_pnl or 0) + realized_pnl
                    position.quantity -= quantity
                    if position.quantity <= 0:
                        # 完全平仓，重置均价
                        position.avg_price = 0 if position.quantity == 0 else filled_price
                else:
                    # 空头加仓
                    position.quantity -= quantity
        # 不在此 commit，由上层事务统一提交
