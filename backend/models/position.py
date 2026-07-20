from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from models.user import Base


class Position(Base):
    """持仓"""
    __tablename__ = "positions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    symbol = Column(String(20), nullable=False)
    exchange = Column(String(20), nullable=False)
    quantity = Column(Float, nullable=False)
    avg_price = Column(Float, nullable=False)
    unrealized_pnl = Column(Float, default=0)
    realized_pnl = Column(Float, default=0)
    opened_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
