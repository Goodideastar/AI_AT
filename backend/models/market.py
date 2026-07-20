from sqlalchemy import Column, Integer, String, Float, DateTime, Index
from sqlalchemy.sql import func
from models.user import Base


class Ticker(Base):
    """实时行情快照"""
    __tablename__ = "tickers"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(20), nullable=False, index=True)  # BTCUSDT
    exchange = Column(String(20), nullable=False)  # binance, okx
    last_price = Column(Float, nullable=False)
    bid = Column(Float)
    ask = Column(Float)
    volume_24h = Column(Float)
    high_24h = Column(Float)
    low_24h = Column(Float)
    timestamp = Column(DateTime, default=func.now(), index=True)
    
    __table_args__ = (
        Index('idx_symbol_exchange', 'symbol', 'exchange'),
    )


class Kline(Base):
    """K线数据"""
    __tablename__ = "klines"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(20), nullable=False)
    exchange = Column(String(20), nullable=False)
    interval = Column(String(5), nullable=False)  # 1m, 5m, 1h, 1d
    open_time = Column(DateTime, nullable=False)
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(Float, nullable=False)
    close_time = Column(DateTime, nullable=False)
    
    __table_args__ = (
        Index('idx_kline_lookup', 'symbol', 'exchange', 'interval', 'open_time', unique=True),
    )
