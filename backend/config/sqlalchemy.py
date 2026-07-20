#数据库配置
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# 数据库连接配置
DB_URL = os.getenv("DB_URL")
if not DB_URL:
    raise ValueError("DB_URL environment variable is not set")

# 创建数据库引擎
engine = create_engine(DB_URL)

# 创建会话工厂
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
