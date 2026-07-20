# backend/api/trade.py
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from config.sqlalchemy import SessionLocal
from config.redis import redis_client
from models.order import Order
from models.position import Position
from security.jwt import JWTBearer
from service.trade.executor import OrderExecutor
from utils.client_ip import get_client_ip
import logging

logger = logging.getLogger(__name__)

router = APIRouter(tags=["trade"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _incr_rate_key(key: str, limit: int, window: int) -> bool:
    """原子 INCR 限流：返回 True 表示被限制。"""
    current = redis_client.incr(key)
    if current == 1:
        redis_client.expire(key, window)
    return current > limit


class PlaceOrderRequest(BaseModel):
    """下单请求参数（Pydantic 校验）"""
    symbol: str = Field(..., min_length=1, description="交易对，如 BTCUSDT")
    exchange: str = Field("binance", description="交易所：binance / okx")
    side: str = Field(..., description="买卖方向：buy / sell")
    order_type: str = Field(..., description="订单类型：market / limit")
    quantity: float = Field(..., gt=0, description="下单数量，必须 > 0")
    price: float | None = Field(None, gt=0, description="限价单价格；市价单可为空")
    strategy_id: int | None = Field(None, description="关联策略 ID，可选")


@router.post("/trade/order")
async def place_order(
    payload: PlaceOrderRequest,
    request: Request,
    credentials: dict = Depends(JWTBearer()),
    db: Session = Depends(get_db),
):
    """下单

    流程：
        1. 频率限制（防刷单）
        2. Pydantic 校验（已在路由层完成）
        3. 调用 OrderExecutor：内部完成风控校验 + 行情取价 + 单事务原子写入
    """
    user_id = credentials.get("user_id")
    client_ip = get_client_ip(request)

    # 1. 频率限制：10 次 / 60 秒（同一用户）
    if _incr_rate_key(f"trade_order:{user_id}", limit=10, window=60):
        logger.warning("[下单] 频率超限: user_id=%s, ip=%s", user_id, client_ip)
        raise HTTPException(status_code=429, detail="下单过于频繁，请稍后再试")

    # 2. 业务校验：限价单必须有 price（Pydantic 无法做条件校验，这里补一道）
    if payload.order_type == "limit" and (payload.price is None or payload.price <= 0):
        raise HTTPException(status_code=400, detail="限价单必须提供有效的 price")
    if payload.side not in ("buy", "sell"):
        raise HTTPException(status_code=400, detail="side 只能是 buy 或 sell")
    if payload.order_type not in ("market", "limit"):
        raise HTTPException(status_code=400, detail="order_type 只能是 market 或 limit")

    # 3. 调用执行器
    executor = OrderExecutor(db)
    try:
        result = await executor.execute_order(
            user_id=user_id,
            symbol=payload.symbol,
            exchange=payload.exchange,
            side=payload.side,
            order_type=payload.order_type,
            quantity=payload.quantity,
            price=payload.price,
            strategy_id=payload.strategy_id,
        )
        return {"code": 0, "data": result}
    except ValueError as e:
        # 业务错误（风控拒绝、行情获取失败等）→ 400
        logger.info("[下单] 拒绝: user_id=%s, reason=%s", user_id, str(e))
        raise HTTPException(status_code=400, detail=str(e))
    except IntegrityError as e:
        logger.error("[下单] 数据库约束冲突: user_id=%s, err=%s", user_id, str(e))
        raise HTTPException(status_code=409, detail="订单写入冲突")
    except Exception as e:
        logger.exception("[下单] 未预期错误: user_id=%s", user_id)
        raise HTTPException(status_code=500, detail="服务器内部错误")


@router.get("/trade/orders")
async def get_orders(
    credentials: dict = Depends(JWTBearer()),
    db: Session = Depends(get_db),
):
    """获取订单列表"""
    user_id = credentials.get("user_id")
    orders = (
        db.query(Order)
        .filter(Order.user_id == user_id)
        .order_by(Order.created_at.desc())
        .limit(100)
        .all()
    )
    return {
        "code": 0,
        "data": [
            {
                "id": o.id,
                "symbol": o.symbol,
                "exchange": o.exchange,
                "side": o.side.value,
                "order_type": o.order_type.value,
                "quantity": o.quantity,
                "filled_quantity": o.filled_quantity,
                "price": o.price,
                "filled_price": o.filled_price,
                "status": o.status.value,
                "created_at": o.created_at.isoformat(),
            }
            for o in orders
        ],
    }


@router.get("/trade/positions")
async def get_positions(
    credentials: dict = Depends(JWTBearer()),
    db: Session = Depends(get_db),
):
    """获取持仓列表"""
    user_id = credentials.get("user_id")
    positions = db.query(Position).filter(Position.user_id == user_id).all()
    return {
        "code": 0,
        "data": [
            {
                "id": p.id,
                "symbol": p.symbol,
                "exchange": p.exchange,
                "quantity": p.quantity,
                "avg_price": p.avg_price,
                "unrealized_pnl": p.unrealized_pnl,
                "realized_pnl": p.realized_pnl,
                "opened_at": p.opened_at.isoformat() if p.opened_at else None,
            }
            for p in positions
        ],
    }
