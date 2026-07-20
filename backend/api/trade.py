# backend/api/trade.py
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from config.sqlalchemy import SessionLocal
from models.order import Order
from models.position import Position
from security.jwt import JWTBearer
from service.trade.executor import OrderExecutor

router = APIRouter(tags=["trade"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/trade/order")
async def place_order(
    data: dict,
    credentials=Depends(JWTBearer()),
    db: Session = Depends(get_db)
):
    """下单"""
    import jwt
    import os
    
    token = credentials.credentials
    payload = jwt.decode(token, os.getenv("SECRET_KEY"), algorithms=["HS256"])
    user_id = payload["user_id"]
    
    executor = OrderExecutor(db)
    result = await executor.execute_order(
        user_id=user_id,
        symbol=data["symbol"],
        exchange=data["exchange"],
        side=data["side"],
        order_type=data["order_type"],
        quantity=data["quantity"],
        price=data.get("price"),
        strategy_id=data.get("strategy_id")
    )
    
    return {"code": 0, "data": result}


@router.get("/trade/orders")
async def get_orders(
    credentials=Depends(JWTBearer()),
    db: Session = Depends(get_db)
):
    """获取订单列表"""
    import jwt
    import os
    
    token = credentials.credentials
    payload = jwt.decode(token, os.getenv("SECRET_KEY"), algorithms=["HS256"])
    user_id = payload["user_id"]
    
    orders = db.query(Order).filter(Order.user_id == user_id).order_by(Order.created_at.desc()).limit(100).all()
    
    return {
        "code": 0,
        "data": [
            {
                "id": o.id,
                "symbol": o.symbol,
                "side": o.side.value,
                "order_type": o.order_type.value,
                "quantity": o.quantity,
                "filled_quantity": o.filled_quantity,
                "price": o.price,
                "filled_price": o.filled_price,
                "status": o.status.value,
                "created_at": o.created_at.isoformat()
            }
            for o in orders
        ]
    }


@router.get("/trade/positions")
async def get_positions(
    credentials=Depends(JWTBearer()),
    db: Session = Depends(get_db)
):
    """获取持仓列表"""
    import jwt
    import os
    
    token = credentials.credentials
    payload = jwt.decode(token, os.getenv("SECRET_KEY"), algorithms=["HS256"])
    user_id = payload["user_id"]
    
    positions = db.query(Position).filter(Position.user_id == user_id).all()
    
    return {
        "code": 0,
        "data": [
            {
                "id": p.id,
                "symbol": p.symbol,
                "quantity": p.quantity,
                "avg_price": p.avg_price,
                "unrealized_pnl": p.unrealized_pnl,
                "realized_pnl": p.realized_pnl
            }
            for p in positions
        ]
    }
