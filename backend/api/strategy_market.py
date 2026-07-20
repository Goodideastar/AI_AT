import logging
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from config.sqlalchemy import SessionLocal
from models.strategy import Strategy
from models.strategy_market import StrategyShare, StrategySubscription
from security.jwt import JWTBearer

logger = logging.getLogger(__name__)

router = APIRouter(tags=["strategy_market"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/strategy-market/shares")
async def publish_share(
    data: dict,
    credentials=Depends(JWTBearer()),
    db: Session = Depends(get_db)
):
    """发布策略到市场"""
    user_id = credentials["user_id"]

    strategy_id = data.get("strategy_id")
    title = data.get("title")
    description = data.get("description")
    is_public = data.get("is_public", True)

    if not strategy_id or not title:
        raise HTTPException(status_code=400, detail="策略ID和标题不能为空")

    try:
        # 验证策略属于当前用户
        strategy = db.query(Strategy).filter(
            Strategy.id == strategy_id,
            Strategy.user_id == user_id
        ).first()
        if not strategy:
            raise HTTPException(status_code=404, detail="策略不存在或无权分享")

        # 检查是否已分享
        existing = db.query(StrategyShare).filter(
            StrategyShare.strategy_id == strategy_id,
            StrategyShare.user_id == user_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="该策略已分享到市场")

        share = StrategyShare(
            user_id=user_id,
            strategy_id=strategy_id,
            title=title,
            description=description,
            is_public=is_public,
            subscribe_count=0,
            rating=0
        )
        db.add(share)
        db.commit()
        db.refresh(share)

        logger.info(f"用户 {user_id} 发布策略 {strategy_id} 到市场，分享ID: {share.id}")

        return {
            "code": 0,
            "data": {
                "id": share.id,
                "strategy_id": share.strategy_id,
                "title": share.title,
                "description": share.description,
                "is_public": share.is_public,
                "subscribe_count": share.subscribe_count,
                "rating": share.rating,
                "created_at": share.created_at.isoformat()
            }
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"发布策略到市场失败: {e}")
        raise HTTPException(status_code=500, detail="服务器内部错误")


@router.get("/strategy-market/shares")
async def list_shares(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    credentials=Depends(JWTBearer()),
    db: Session = Depends(get_db)
):
    """获取市场策略列表（分页）"""
    user_id = credentials["user_id"]

    try:
        offset = (page - 1) * page_size
        query = db.query(StrategyShare).filter(StrategyShare.is_public == True)
        total = query.count()
        shares = query.order_by(desc(StrategyShare.created_at)).offset(offset).limit(page_size).all()

        return {
            "code": 0,
            "data": {
                "total": total,
                "page": page,
                "page_size": page_size,
                "list": [
                    {
                        "id": s.id,
                        "user_id": s.user_id,
                        "strategy_id": s.strategy_id,
                        "title": s.title,
                        "description": s.description,
                        "subscribe_count": s.subscribe_count,
                        "rating": s.rating,
                        "created_at": s.created_at.isoformat(),
                        "is_owner": s.user_id == user_id
                    }
                    for s in shares
                ]
            }
        }
    except Exception as e:
        logger.error(f"获取市场策略列表失败: {e}")
        raise HTTPException(status_code=500, detail="服务器内部错误")


@router.get("/strategy-market/shares/{share_id}")
async def get_share_detail(
    share_id: int,
    credentials=Depends(JWTBearer()),
    db: Session = Depends(get_db)
):
    """获取策略分享详情"""
    user_id = credentials["user_id"]

    try:
        share = db.query(StrategyShare).filter(StrategyShare.id == share_id).first()
        if not share:
            raise HTTPException(status_code=404, detail="策略分享不存在")

        # 非公开且非本人不可访问
        if not share.is_public and share.user_id != user_id:
            raise HTTPException(status_code=403, detail="无权访问该策略")

        # 查询当前用户是否已订阅
        subscription = db.query(StrategySubscription).filter(
            StrategySubscription.user_id == user_id,
            StrategySubscription.share_id == share_id,
            StrategySubscription.status == 1
        ).first()

        return {
            "code": 0,
            "data": {
                "id": share.id,
                "user_id": share.user_id,
                "strategy_id": share.strategy_id,
                "title": share.title,
                "description": share.description,
                "is_public": share.is_public,
                "subscribe_count": share.subscribe_count,
                "rating": share.rating,
                "created_at": share.created_at.isoformat(),
                "is_owner": share.user_id == user_id,
                "is_subscribed": subscription is not None
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取策略分享详情失败: {e}")
        raise HTTPException(status_code=500, detail="服务器内部错误")


@router.post("/strategy-market/shares/{share_id}/subscribe")
async def subscribe_share(
    share_id: int,
    credentials=Depends(JWTBearer()),
    db: Session = Depends(get_db)
):
    """订阅策略"""
    user_id = credentials["user_id"]

    try:
        share = db.query(StrategyShare).filter(StrategyShare.id == share_id).first()
        if not share:
            raise HTTPException(status_code=404, detail="策略分享不存在")

        # 非公开策略不可被订阅
        if not share.is_public:
            raise HTTPException(status_code=403, detail="该策略不可订阅")

        # 不能订阅自己的策略
        if share.user_id == user_id:
            raise HTTPException(status_code=400, detail="不能订阅自己分享的策略")

        # 检查是否已订阅
        existing = db.query(StrategySubscription).filter(
            StrategySubscription.user_id == user_id,
            StrategySubscription.share_id == share_id
        ).first()

        if existing and existing.status == 1:
            raise HTTPException(status_code=400, detail="已订阅该策略")

        if existing:
            # 已取消订阅，重新激活
            existing.status = 1
            existing.subscribed_at = func.now()
        else:
            subscription = StrategySubscription(
                user_id=user_id,
                share_id=share_id,
                status=1
            )
            db.add(subscription)

        # 订阅数 +1
        share.subscribe_count = (share.subscribe_count or 0) + 1
        db.commit()

        logger.info(f"用户 {user_id} 订阅策略分享 {share_id}")

        return {
            "code": 0,
            "data": {
                "share_id": share_id,
                "subscribe_count": share.subscribe_count
            }
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"订阅策略失败: {e}")
        raise HTTPException(status_code=500, detail="服务器内部错误")


@router.delete("/strategy-market/shares/{share_id}/subscribe")
async def unsubscribe_share(
    share_id: int,
    credentials=Depends(JWTBearer()),
    db: Session = Depends(get_db)
):
    """取消订阅策略"""
    user_id = credentials["user_id"]

    try:
        share = db.query(StrategyShare).filter(StrategyShare.id == share_id).first()
        if not share:
            raise HTTPException(status_code=404, detail="策略分享不存在")

        subscription = db.query(StrategySubscription).filter(
            StrategySubscription.user_id == user_id,
            StrategySubscription.share_id == share_id,
            StrategySubscription.status == 1
        ).first()

        if not subscription:
            raise HTTPException(status_code=400, detail="未订阅该策略")

        subscription.status = 0
        # 订阅数 -1，最小为 0
        share.subscribe_count = max((share.subscribe_count or 0) - 1, 0)
        db.commit()

        logger.info(f"用户 {user_id} 取消订阅策略分享 {share_id}")

        return {
            "code": 0,
            "data": {
                "share_id": share_id,
                "subscribe_count": share.subscribe_count
            }
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"取消订阅策略失败: {e}")
        raise HTTPException(status_code=500, detail="服务器内部错误")


@router.get("/strategy-market/my-subscriptions")
async def get_my_subscriptions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    credentials=Depends(JWTBearer()),
    db: Session = Depends(get_db)
):
    """获取我的订阅列表"""
    user_id = credentials["user_id"]

    try:
        offset = (page - 1) * page_size
        query = db.query(StrategySubscription).filter(
            StrategySubscription.user_id == user_id,
            StrategySubscription.status == 1
        )
        total = query.count()
        subscriptions = query.order_by(desc(StrategySubscription.subscribed_at)).offset(offset).limit(page_size).all()

        result = []
        for sub in subscriptions:
            share = db.query(StrategyShare).filter(StrategyShare.id == sub.share_id).first()
            if share:
                result.append({
                    "subscription_id": sub.id,
                    "share_id": share.id,
                    "strategy_id": share.strategy_id,
                    "title": share.title,
                    "description": share.description,
                    "subscribe_count": share.subscribe_count,
                    "rating": share.rating,
                    "subscribed_at": sub.subscribed_at.isoformat()
                })

        return {
            "code": 0,
            "data": {
                "total": total,
                "page": page,
                "page_size": page_size,
                "list": result
            }
        }
    except Exception as e:
        logger.error(f"获取我的订阅列表失败: {e}")
        raise HTTPException(status_code=500, detail="服务器内部错误")


@router.get("/strategy-market/my-shares")
async def get_my_shares(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    credentials=Depends(JWTBearer()),
    db: Session = Depends(get_db)
):
    """获取我分享的策略"""
    user_id = credentials["user_id"]

    try:
        offset = (page - 1) * page_size
        query = db.query(StrategyShare).filter(StrategyShare.user_id == user_id)
        total = query.count()
        shares = query.order_by(desc(StrategyShare.created_at)).offset(offset).limit(page_size).all()

        return {
            "code": 0,
            "data": {
                "total": total,
                "page": page,
                "page_size": page_size,
                "list": [
                    {
                        "id": s.id,
                        "strategy_id": s.strategy_id,
                        "title": s.title,
                        "description": s.description,
                        "is_public": s.is_public,
                        "subscribe_count": s.subscribe_count,
                        "rating": s.rating,
                        "created_at": s.created_at.isoformat()
                    }
                    for s in shares
                ]
            }
        }
    except Exception as e:
        logger.error(f"获取我分享的策略失败: {e}")
        raise HTTPException(status_code=500, detail="服务器内部错误")
