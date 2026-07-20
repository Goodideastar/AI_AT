from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    ip_address = Column(String(45), nullable=True)  # 支持 IPv6 最长 45 字符
    status = Column(Integer, default=1, nullable=False)  # 1: 启用, 0: 禁用
    created_at = Column(DateTime, default=func.now(), nullable=False)  # 创建时间
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)  # 更新时间