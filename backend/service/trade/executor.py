# backend/service/trade/executor.py
from typing import Dict
from sqlalchemy.orm import Session
from models.order import Order, OrderSide, OrderType, OrderStatus


class OrderExecutor:
    """订单执行器"""
    
    def __init__(self, db: Session):
        self.db = db
    
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
        """执行订单"""
        # 创建订单记录
        order = Order(
            user_id=user_id,
            strategy_id=strategy_id,
            symbol=symbol,
            exchange=exchange,
            side=OrderSide(side),
            order_type=OrderType(order_type),
            price=price,
            quantity=quantity,
            status=OrderStatus.PENDING
        )
        
        self.db.add(order)
        self.db.commit()
        self.db.refresh(order)
        
        # TODO: 调用交易所API下单
        # 这里简化处理，直接标记为已成交
        order.status = OrderStatus.FILLED
        order.filled_quantity = quantity
        order.filled_price = price or 0  # 市价单需要获取实际成交价
        
        self.db.commit()
        
        return {
            "order_id": order.id,
            "status": order.status.value
        }
