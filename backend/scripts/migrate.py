# backend/scripts/migrate.py
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from config.sqlalchemy import engine
from models.user import Base as UserBase
from models.market import Base as MarketBase
from models.strategy import Base as StrategyBase
from models.order import Base as OrderBase
from models.position import Base as PositionBase

# 导入所有模型以注册元数据
from models import market, strategy, order, position

def migrate():
    """创建所有表"""
    print("开始创建数据库表...")
    
    # 使用 UserBase.metadata 因为所有模型都继承自它
    UserBase.metadata.create_all(bind=engine)
    
    print("✓ 数据库表创建完成")

if __name__ == "__main__":
    migrate()
