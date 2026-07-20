from sqlalchemy import Column, Integer, String, JSON, DateTime, Boolean
from sqlalchemy.sql import func
from models.user import Base


class Strategy(Base):
    """交易策略"""
    __tablename__ = "strategies"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500))
    strategy_type = Column(String(50), nullable=False)  # grid, ma_cross, rsi
    parameters = Column(JSON, nullable=False)  # {"period": 20, "threshold": 70}
    symbols = Column(JSON, nullable=False)  # ["BTCUSDT", "ETHUSDT"]
    exchange = Column(String(20), nullable=False)
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
