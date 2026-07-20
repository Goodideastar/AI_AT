from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from models.user import Base


class StrategyShare(Base):
    """策略市场分享表"""
    __tablename__ = "strategy_shares"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    strategy_id = Column(Integer, nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(String(1000))
    is_public = Column(Boolean, default=True, nullable=False)
    subscribe_count = Column(Integer, default=0, nullable=False)
    rating = Column(Integer, default=0, nullable=False)  # 评分 0-100
    created_at = Column(DateTime, default=func.now(), nullable=False)


class StrategySubscription(Base):
    """策略订阅表"""
    __tablename__ = "strategy_subscriptions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    share_id = Column(Integer, nullable=False, index=True)
    status = Column(Integer, default=1, nullable=False)  # 1: 已订阅, 0: 已取消
    subscribed_at = Column(DateTime, default=func.now(), nullable=False)
