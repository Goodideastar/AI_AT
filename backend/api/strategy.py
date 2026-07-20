from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List
from config.sqlalchemy import SessionLocal
from models.strategy import Strategy
from security.jwt import JWTBearer
from service.strategy.registry import strategy_registry

router = APIRouter(tags=["strategy"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/strategies")
async def list_strategies(
    credentials=Depends(JWTBearer())
):
    """列出可用策略类型"""
    return {
        "code": 0,
        "data": strategy_registry.list_strategies()
    }


@router.post("/strategies")
async def create_strategy(
    data: dict,
    credentials=Depends(JWTBearer()),
    db: Session = Depends(get_db)
):
    """创建策略"""
    # JWTBearer 返回的是已解码的 payload dict
    user_id = credentials["user_id"]
    
    strategy = Strategy(
        user_id=user_id,
        name=data["name"],
        description=data.get("description"),
        strategy_type=data["strategy_type"],
        parameters=data["parameters"],
        symbols=data["symbols"],
        exchange=data["exchange"],
        is_active=False
    )
    
    db.add(strategy)
    db.commit()
    db.refresh(strategy)
    
    return {"code": 0, "data": {"id": strategy.id}}


@router.get("/strategies/my")
async def get_my_strategies(
    credentials=Depends(JWTBearer()),
    db: Session = Depends(get_db)
):
    """获取我的策略列表"""
    # JWTBearer 返回的是已解码的 payload dict
    user_id = credentials["user_id"]
    
    strategies = db.query(Strategy).filter(Strategy.user_id == user_id).all()
    
    return {
        "code": 0,
        "data": [
            {
                "id": s.id,
                "name": s.name,
                "strategy_type": s.strategy_type,
                "symbols": s.symbols,
                "exchange": s.exchange,
                "is_active": s.is_active,
                "created_at": s.created_at.isoformat()
            }
            for s in strategies
        ]
    }


@router.put("/strategies/{strategy_id}/toggle")
async def toggle_strategy(
    strategy_id: int,
    credentials=Depends(JWTBearer()),
    db: Session = Depends(get_db)
):
    """启停策略"""
    # JWTBearer 返回的是已解码的 payload dict
    user_id = credentials["user_id"]
    
    strategy = db.query(Strategy).filter(
        Strategy.id == strategy_id,
        Strategy.user_id == user_id
    ).first()
    
    if not strategy:
        raise HTTPException(status_code=404, detail="策略不存在")
    
    strategy.is_active = not strategy.is_active
    db.commit()
    
    return {"code": 0, "data": {"is_active": strategy.is_active}}
