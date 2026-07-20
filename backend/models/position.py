from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from models.user import Base


class Position(Base):
    """持仓"""
    __tablename__ = "positions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    symbol = Column(String(20), nullable=False)
    exchange = Column(String(20), nullable=False)
    quantity = Column(Float, nullable=False)
    avg_price = Column(Float, nullable=False)
    unrealized_pnl = Column(Float, default=0)
    realized_pnl = Column(Float, default=0)
    opened_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    __table_args__ = (
        # 同一用户同一交易对只保留一条持仓记录（与 executor._update_position 逻辑匹配）
        UniqueConstraint('user_id', 'symbol', 'exchange', name='uq_position_user_symbol_exchange'),
    )
