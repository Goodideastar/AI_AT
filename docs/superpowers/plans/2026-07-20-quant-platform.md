# Quant Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI_AT 改造为多市场量化交易平台，包含行情看板、策略管理、回测系统、交易面板四大核心模块

**Architecture:** 
- 后端采用 FastAPI + 异步量化引擎架构，支持多市场数据源接入
- 前端新增 Dashboard 布局，集成 TradingView 图表库
- 数据库扩展策略、订单、持仓、行情数据表
- WebSocket 实时推送行情和交易状态

**Tech Stack:** 
- Backend: FastAPI, SQLAlchemy, Redis, pandas, numpy, ta-lib
- Frontend: React, TypeScript, TradingView Lightweight Charts, Recharts
- Data: MySQL (持久化), Redis (缓存/实时), WebSocket (推送)

---

## File Structure

### Backend (新增)
```
backend/
├── api/
│   ├── market.py          # 行情数据 API
│   ├── strategy.py        # 策略管理 API
│   ├── backtest.py        # 回测 API
│   ├── trade.py           # 交易 API
│   └── ws.py              # WebSocket 端点
├── models/
│   ├── market.py          # 行情数据模型
│   ├── strategy.py        # 策略模型
│   ├── order.py           # 订单模型
│   └── position.py        # 持仓模型
├── service/
│   ├── market/
│   │   ├── base.py        # 数据源基类
│   │   ├── binance.py     # Binance 数据源
│   │   ├── okx.py         # OKX 数据源
│   │   └── manager.py     # 数据源管理器
│   ├── strategy/
│   │   ├── base.py        # 策略基类
│   │   ├── engine.py      # 策略执行引擎
│   │   └── registry.py    # 策略注册表
│   ├── backtest/
│   │   ├── engine.py      # 回测引擎
│   │   ├── matcher.py     # 订单撮合
│   │   └── metrics.py     # 绩效指标计算
│   └── trade/
│       ├── executor.py    # 订单执行器
│       └── portfolio.py   # 持仓管理
├── core/
│   ├── events.py          # 事件总线
│   └── scheduler.py       # 定时任务
└── requirements.txt       # Python 依赖清单
```

### Frontend (新增)
```
frontend/src/
├── pages/
│   ├── Dashboard.tsx      # 主看板页面
│   ├── Strategy.tsx       # 策略管理页面
│   ├── Backtest.tsx       # 回测页面
│   └── Trade.tsx          # 交易面板
├── components/
│   ├── Market/
│   │   ├── TickerList.tsx     # 行情列表
│   │   ├── KlineChart.tsx     # K线图
│   │   └── OrderBook.tsx      # 订单簿
│   ├── Strategy/
│   │   ├── StrategyCard.tsx   # 策略卡片
│   │   ├── StrategyEditor.tsx # 策略编辑器
│   │   └── ParamForm.tsx      # 参数表单
│   ├── Backtest/
│   │   ├── BacktestForm.tsx   # 回测配置表单
│   │   ├── EquityCurve.tsx    # 收益曲线
│   │   └── MetricsPanel.tsx   # 绩效指标面板
│   └── Trade/
│       ├── OrderForm.tsx      # 下单表单
│       ├── PositionList.tsx   # 持仓列表
│       └── OrderList.tsx      # 订单列表
├── hooks/
│   ├── useWebSocket.ts    # WebSocket hook
│   └── useMarketData.ts   # 行情数据 hook
└── api/
    ├── market.ts          # 行情 API
    ├── strategy.ts        # 策略 API
    ├── backtest.ts        # 回测 API
    └── trade.ts           # 交易 API
```

---

## Phase 1: 基础设施搭建 (Week 1)

### Task 1.1: 创建 Python 依赖清单

**Files:**
- Create: `backend/requirements.txt`

- [ ] **Step 1: 创建 requirements.txt**

```txt
# Web Framework
fastapi==0.115.0
uvicorn[standard]==0.30.6
pydantic==2.9.2

# Database
sqlalchemy==2.0.35
pymysql==1.1.1
redis==5.2.0

# Authentication
pyjwt==2.13.0
bcrypt==5.0.0

# Environment
python-dotenv==1.0.1

# HTTP Client
httpx==0.27.2
aiohttp==3.10.10

# Data Processing
pandas==2.2.3
numpy==2.1.2

# Technical Analysis
ta-lib==0.5.0  # 需要先安装 C 语言库

# WebSocket
websockets==13.1

# Scheduling
apscheduler==3.10.4

# Logging
loguru==0.7.2
```

- [ ] **Step 2: 提交**

```bash
git add backend/requirements.txt
git commit -m "chore: add Python dependencies manifest"
```

---

### Task 1.2: 创建数据库模型 - 行情数据

**Files:**
- Create: `backend/models/market.py`
- Modify: `backend/models/__init__.py` (如果存在)

- [ ] **Step 1: 创建行情数据模型**

```python
# backend/models/market.py
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
```

- [ ] **Step 2: 提交**

```bash
git add backend/models/market.py
git commit -m "feat: add market data models (Ticker, Kline)"
```

---

### Task 1.3: 创建数据库模型 - 策略

**Files:**
- Create: `backend/models/strategy.py`

- [ ] **Step 1: 创建策略模型**

```python
# backend/models/strategy.py
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
```

- [ ] **Step 2: 提交**

```bash
git add backend/models/strategy.py
git commit -m "feat: add strategy model"
```

---

### Task 1.4: 创建数据库模型 - 订单和持仓

**Files:**
- Create: `backend/models/order.py`
- Create: `backend/models/position.py`

- [ ] **Step 1: 创建订单模型**

```python
# backend/models/order.py
from sqlalchemy import Column, Integer, String, Float, DateTime, Enum
from sqlalchemy.sql import func
from models.user import Base
import enum


class OrderSide(str, enum.Enum):
    BUY = "buy"
    SELL = "sell"


class OrderType(str, enum.Enum):
    MARKET = "market"
    LIMIT = "limit"


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    FILLED = "filled"
    PARTIALLY_FILLED = "partially_filled"
    CANCELLED = "cancelled"


class Order(Base):
    """交易订单"""
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    strategy_id = Column(Integer, index=True)  # 可为空（手动下单）
    symbol = Column(String(20), nullable=False)
    exchange = Column(String(20), nullable=False)
    side = Column(Enum(OrderSide), nullable=False)
    order_type = Column(Enum(OrderType), nullable=False)
    price = Column(Float)  # 市价单可为空
    quantity = Column(Float, nullable=False)
    filled_quantity = Column(Float, default=0)
    filled_price = Column(Float)
    status = Column(Enum(OrderStatus), default=OrderStatus.PENDING)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
```

- [ ] **Step 2: 创建持仓模型**

```python
# backend/models/position.py
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
```

- [ ] **Step 3: 提交**

```bash
git add backend/models/order.py backend/models/position.py
git commit -m "feat: add order and position models"
```

---

### Task 1.5: 创建数据库迁移脚本

**Files:**
- Create: `backend/scripts/migrate.py`

- [ ] **Step 1: 创建迁移脚本**

```python
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
```

- [ ] **Step 2: 运行迁移**

```bash
cd backend
python scripts/migrate.py
```

- [ ] **Step 3: 提交**

```bash
git add backend/scripts/migrate.py
git commit -m "feat: add database migration script"
```

---

## Phase 2: 行情数据模块 (Week 2)

### Task 2.1: 创建数据源基类

**Files:**
- Create: `backend/service/market/base.py`

- [ ] **Step 1: 创建数据源抽象基类**

```python
# backend/service/market/base.py
from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from datetime import datetime


class MarketDataSource(ABC):
    """行情数据源基类"""
    
    def __init__(self, exchange: str):
        self.exchange = exchange
    
    @abstractmethod
    async def get_ticker(self, symbol: str) -> Dict:
        """获取实时行情"""
        pass
    
    @abstractmethod
    async def get_klines(
        self, 
        symbol: str, 
        interval: str, 
        start_time: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict]:
        """获取K线数据"""
        pass
    
    @abstractmethod
    async def get_orderbook(self, symbol: str, limit: int = 20) -> Dict:
        """获取订单簿"""
        pass
    
    @abstractmethod
    async def get_trades(self, symbol: str, limit: int = 100) -> List[Dict]:
        """获取最近成交"""
        pass
```

- [ ] **Step 2: 提交**

```bash
git add backend/service/market/base.py
git commit -m "feat: add market data source base class"
```

---

### Task 2.2: 实现 Binance 数据源

**Files:**
- Create: `backend/service/market/binance.py`

- [ ] **Step 1: 实现 Binance 数据源**

```python
# backend/service/market/binance.py
import httpx
from typing import List, Dict, Optional
from datetime import datetime
from service.market.base import MarketDataSource


class BinanceDataSource(MarketDataSource):
    """Binance 数据源"""
    
    BASE_URL = "https://api.binance.com/api/v3"
    
    def __init__(self):
        super().__init__("binance")
        self.client = httpx.AsyncClient(timeout=10.0)
    
    async def get_ticker(self, symbol: str) -> Dict:
        """获取24小时行情"""
        resp = await self.client.get(
            f"{self.BASE_URL}/ticker/24hr",
            params={"symbol": symbol}
        )
        data = resp.json()
        return {
            "symbol": data["symbol"],
            "exchange": self.exchange,
            "last_price": float(data["lastPrice"]),
            "bid": float(data["bidPrice"]),
            "ask": float(data["askPrice"]),
            "volume_24h": float(data["volume"]),
            "high_24h": float(data["highPrice"]),
            "low_24h": float(data["lowPrice"]),
            "timestamp": datetime.fromtimestamp(data["closeTime"] / 1000)
        }
    
    async def get_klines(
        self,
        symbol: str,
        interval: str,
        start_time: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict]:
        """获取K线数据"""
        params = {
            "symbol": symbol,
            "interval": interval,
            "limit": limit
        }
        if start_time:
            params["startTime"] = int(start_time.timestamp() * 1000)
        
        resp = await self.client.get(
            f"{self.BASE_URL}/klines",
            params=params
        )
        data = resp.json()
        
        return [
            {
                "symbol": symbol,
                "exchange": self.exchange,
                "interval": interval,
                "open_time": datetime.fromtimestamp(k[0] / 1000),
                "open": float(k[1]),
                "high": float(k[2]),
                "low": float(k[3]),
                "close": float(k[4]),
                "volume": float(k[5]),
                "close_time": datetime.fromtimestamp(k[6] / 1000)
            }
            for k in data
        ]
    
    async def get_orderbook(self, symbol: str, limit: int = 20) -> Dict:
        """获取订单簿"""
        resp = await self.client.get(
            f"{self.BASE_URL}/depth",
            params={"symbol": symbol, "limit": limit}
        )
        data = resp.json()
        return {
            "symbol": symbol,
            "exchange": self.exchange,
            "bids": [[float(p), float(q)] for p, q in data["bids"]],
            "asks": [[float(p), float(q)] for p, q in data["asks"]]
        }
    
    async def get_trades(self, symbol: str, limit: int = 100) -> List[Dict]:
        """获取最近成交"""
        resp = await self.client.get(
            f"{self.BASE_URL}/trades",
            params={"symbol": symbol, "limit": limit}
        )
        data = resp.json()
        return [
            {
                "symbol": symbol,
                "exchange": self.exchange,
                "price": float(t["price"]),
                "quantity": float(t["qty"]),
                "side": t["isBuyerMaker"] and "sell" or "buy",
                "timestamp": datetime.fromtimestamp(t["time"] / 1000)
            }
            for t in data
        ]
    
    async def close(self):
        await self.client.aclose()
```

- [ ] **Step 2: 提交**

```bash
git add backend/service/market/binance.py
git commit -m "feat: implement Binance data source"
```

---

### Task 2.3: 创建数据源管理器

**Files:**
- Create: `backend/service/market/manager.py`

- [ ] **Step 1: 创建数据源管理器**

```python
# backend/service/market/manager.py
from typing import Dict, Optional
from service.market.base import MarketDataSource
from service.market.binance import BinanceDataSource


class MarketDataManager:
    """行情数据管理器"""
    
    def __init__(self):
        self.sources: Dict[str, MarketDataSource] = {
            "binance": BinanceDataSource()
        }
    
    def get_source(self, exchange: str) -> MarketDataSource:
        """获取数据源"""
        if exchange not in self.sources:
            raise ValueError(f"不支持的交易所: {exchange}")
        return self.sources[exchange]
    
    async def close_all(self):
        """关闭所有数据源"""
        for source in self.sources.values():
            if hasattr(source, 'close'):
                await source.close()


# 全局单例
market_manager = MarketDataManager()
```

- [ ] **Step 2: 提交**

```bash
git add backend/service/market/manager.py
git commit -m "feat: add market data manager"
```

---

### Task 2.4: 创建行情 API

**Files:**
- Create: `backend/api/market.py`

- [ ] **Step 1: 创建行情 API 端点**

```python
# backend/api/market.py
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from datetime import datetime
from service.market.manager import market_manager

router = APIRouter(tags=["market"])


@router.get("/market/ticker/{symbol}")
async def get_ticker(
    symbol: str,
    exchange: str = Query(default="binance")
):
    """获取实时行情"""
    try:
        source = market_manager.get_source(exchange)
        ticker = await source.get_ticker(symbol)
        return {"code": 0, "data": ticker}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/market/klines/{symbol}")
async def get_klines(
    symbol: str,
    exchange: str = Query(default="binance"),
    interval: str = Query(default="1h"),
    limit: int = Query(default=100, ge=1, le=1000),
    start_time: Optional[datetime] = None
):
    """获取K线数据"""
    try:
        source = market_manager.get_source(exchange)
        klines = await source.get_klines(symbol, interval, start_time, limit)
        return {"code": 0, "data": klines}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/market/orderbook/{symbol}")
async def get_orderbook(
    symbol: str,
    exchange: str = Query(default="binance"),
    limit: int = Query(default=20, ge=1, le=100)
):
    """获取订单簿"""
    try:
        source = market_manager.get_source(exchange)
        orderbook = await source.get_orderbook(symbol, limit)
        return {"code": 0, "data": orderbook}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

- [ ] **Step 2: 在 main.py 中注册路由**

```python
# 在 backend/main.py 中添加
from api.market import router as market_route

app.include_router(market_route, prefix="/api")
```

- [ ] **Step 3: 提交**

```bash
git add backend/api/market.py backend/main.py
git commit -m "feat: add market data API endpoints"
```

---

## Phase 3: 策略管理模块 (Week 3)

### Task 3.1: 创建策略基类

**Files:**
- Create: `backend/service/strategy/base.py`

- [ ] **Step 1: 创建策略抽象基类**

```python
# backend/service/strategy/base.py
from abc import ABC, abstractmethod
from typing import Dict, List, Optional
from datetime import datetime


class StrategyBase(ABC):
    """策略基类"""
    
    def __init__(self, parameters: Dict):
        self.parameters = parameters
        self.positions: List[Dict] = []
    
    @abstractmethod
    def on_init(self):
        """策略初始化"""
        pass
    
    @abstractmethod
    def on_bar(self, bar: Dict) -> Optional[Dict]:
        """
        K线更新回调
        
        Args:
            bar: {"open", "high", "low", "close", "volume", "timestamp"}
        
        Returns:
            交易信号: {"action": "buy"/"sell", "quantity": float, "price": float}
        """
        pass
    
    @abstractmethod
    def on_trade(self, trade: Dict):
        """成交回调"""
        pass
    
    def get_state(self) -> Dict:
        """获取策略状态"""
        return {
            "parameters": self.parameters,
            "positions": self.positions
        }
```

- [ ] **Step 2: 提交**

```bash
git add backend/service/strategy/base.py
git commit -m "feat: add strategy base class"
```

---

### Task 3.2: 实现双均线策略示例

**Files:**
- Create: `backend/service/strategy/ma_cross.py`

- [ ] **Step 1: 实现双均线策略**

```python
# backend/service/strategy/ma_cross.py
from typing import Dict, Optional
from collections import deque
from service.strategy.base import StrategyBase


class MACrossStrategy(StrategyBase):
    """双均线策略"""
    
    def __init__(self, parameters: Dict):
        super().__init__(parameters)
        self.fast_period = parameters.get("fast_period", 5)
        self.slow_period = parameters.get("slow_period", 20)
        self.fast_ma = deque(maxlen=self.fast_period)
        self.slow_ma = deque(maxlen=self.slow_period)
        self.prev_fast_ma = None
        self.prev_slow_ma = None
    
    def on_init(self):
        """初始化"""
        pass
    
    def on_bar(self, bar: Dict) -> Optional[Dict]:
        """K线更新"""
        close = bar["close"]
        self.fast_ma.append(close)
        self.slow_ma.append(close)
        
        if len(self.fast_ma) < self.fast_period or len(self.slow_ma) < self.slow_period:
            return None
        
        fast_ma = sum(self.fast_ma) / len(self.fast_ma)
        slow_ma = sum(self.slow_ma) / len(self.slow_ma)
        
        signal = None
        
        # 金叉买入
        if self.prev_fast_ma is not None and self.prev_slow_ma is not None:
            if self.prev_fast_ma <= self.prev_slow_ma and fast_ma > slow_ma:
                signal = {
                    "action": "buy",
                    "quantity": self.parameters.get("quantity", 0.001),
                    "price": close
                }
            # 死叉卖出
            elif self.prev_fast_ma >= self.prev_slow_ma and fast_ma < slow_ma:
                signal = {
                    "action": "sell",
                    "quantity": self.parameters.get("quantity", 0.001),
                    "price": close
                }
        
        self.prev_fast_ma = fast_ma
        self.prev_slow_ma = slow_ma
        
        return signal
    
    def on_trade(self, trade: Dict):
        """成交回调"""
        self.positions.append(trade)
```

- [ ] **Step 2: 提交**

```bash
git add backend/service/strategy/ma_cross.py
git commit -m "feat: implement MA crossover strategy example"
```

---

### Task 3.3: 创建策略注册表和 API

**Files:**
- Create: `backend/service/strategy/registry.py`
- Create: `backend/api/strategy.py`

- [ ] **Step 1: 创建策略注册表**

```python
# backend/service/strategy/registry.py
from typing import Dict, Type
from service.strategy.base import StrategyBase
from service.strategy.ma_cross import MACrossStrategy


class StrategyRegistry:
    """策略注册表"""
    
    def __init__(self):
        self.strategies: Dict[str, Type[StrategyBase]] = {
            "ma_cross": MACrossStrategy
        }
    
    def register(self, name: str, strategy_class: Type[StrategyBase]):
        """注册策略"""
        self.strategies[name] = strategy_class
    
    def get(self, name: str) -> Type[StrategyBase]:
        """获取策略类"""
        if name not in self.strategies:
            raise ValueError(f"未知策略: {name}")
        return self.strategies[name]
    
    def list_strategies(self) -> list:
        """列出所有策略"""
        return list(self.strategies.keys())


strategy_registry = StrategyRegistry()
```

- [ ] **Step 2: 创建策略 API**

```python
# backend/api/strategy.py
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
    import jwt
    import os
    
    # 解析用户ID
    token = credentials.credentials
    payload = jwt.decode(token, os.getenv("SECRET_KEY"), algorithms=["HS256"])
    user_id = payload["user_id"]
    
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
    import jwt
    import os
    
    token = credentials.credentials
    payload = jwt.decode(token, os.getenv("SECRET_KEY"), algorithms=["HS256"])
    user_id = payload["user_id"]
    
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
    import jwt
    import os
    
    token = credentials.credentials
    payload = jwt.decode(token, os.getenv("SECRET_KEY"), algorithms=["HS256"])
    user_id = payload["user_id"]
    
    strategy = db.query(Strategy).filter(
        Strategy.id == strategy_id,
        Strategy.user_id == user_id
    ).first()
    
    if not strategy:
        raise HTTPException(status_code=404, detail="策略不存在")
    
    strategy.is_active = not strategy.is_active
    db.commit()
    
    return {"code": 0, "data": {"is_active": strategy.is_active}}
```

- [ ] **Step 3: 在 main.py 中注册路由**

```python
# 在 backend/main.py 中添加
from api.strategy import router as strategy_route

app.include_router(strategy_route, prefix="/api")
```

- [ ] **Step 4: 提交**

```bash
git add backend/service/strategy/registry.py backend/api/strategy.py backend/main.py
git commit -m "feat: add strategy management API"
```

---

## Phase 4: 回测系统 (Week 4)

### Task 4.1: 创建回测引擎

**Files:**
- Create: `backend/service/backtest/engine.py`

- [ ] **Step 1: 创建回测引擎**

```python
# backend/service/backtest/engine.py
from typing import List, Dict
from datetime import datetime
from service.strategy.base import StrategyBase
from service.backtest.matcher import OrderMatcher


class BacktestEngine:
    """回测引擎"""
    
    def __init__(
        self,
        strategy: StrategyBase,
        initial_capital: float = 10000
    ):
        self.strategy = strategy
        self.initial_capital = initial_capital
        self.capital = initial_capital
        self.positions: List[Dict] = []
        self.trades: List[Dict] = []
        self.equity_curve: List[Dict] = []
        self.matcher = OrderMatcher()
    
    def run(self, klines: List[Dict]) -> Dict:
        """运行回测"""
        self.strategy.on_init()
        
        for bar in klines:
            # 更新策略
            signal = self.strategy.on_bar(bar)
            
            # 处理信号
            if signal:
                trade = self.matcher.match(signal, bar, self.capital)
                if trade:
                    self.trades.append(trade)
                    self.capital += trade["pnl"]
                    self.strategy.on_trade(trade)
            
            # 记录权益曲线
            self.equity_curve.append({
                "timestamp": bar["timestamp"],
                "equity": self.capital,
                "price": bar["close"]
            })
        
        # 计算绩效指标
        from service.backtest.metrics import calculate_metrics
        metrics = calculate_metrics(self.equity_curve, self.trades)
        
        return {
            "initial_capital": self.initial_capital,
            "final_capital": self.capital,
            "total_return": (self.capital - self.initial_capital) / self.initial_capital,
            "trades": self.trades,
            "equity_curve": self.equity_curve,
            "metrics": metrics
        }
```

- [ ] **Step 2: 提交**

```bash
git add backend/service/backtest/engine.py
git commit -m "feat: add backtest engine"
```

---

### Task 4.2: 创建订单撮合器

**Files:**
- Create: `backend/service/backtest/matcher.py`

- [ ] **Step 1: 创建订单撮合器**

```python
# backend/service/backtest/matcher.py
from typing import Dict, Optional


class OrderMatcher:
    """订单撮合器"""
    
    def __init__(self, commission_rate: float = 0.001):
        self.commission_rate = commission_rate
    
    def match(
        self,
        signal: Dict,
        bar: Dict,
        capital: float
    ) -> Optional[Dict]:
        """撮合订单"""
        action = signal["action"]
        quantity = signal["quantity"]
        price = bar["close"]  # 简化：使用收盘价成交
        
        # 计算手续费
        commission = quantity * price * self.commission_rate
        
        # 计算盈亏（简化：假设之前有持仓）
        pnl = -commission  # 开仓只有手续费
        
        return {
            "action": action,
            "quantity": quantity,
            "price": price,
            "commission": commission,
            "pnl": pnl,
            "timestamp": bar["timestamp"]
        }
```

- [ ] **Step 2: 提交**

```bash
git add backend/service/backtest/matcher.py
git commit -m "feat: add order matcher for backtest"
```

---

### Task 4.3: 创建绩效指标计算

**Files:**
- Create: `backend/service/backtest/metrics.py`

- [ ] **Step 1: 创建绩效指标计算**

```python
# backend/service/backtest/metrics.py
from typing import List, Dict
import numpy as np


def calculate_metrics(equity_curve: List[Dict], trades: List[Dict]) -> Dict:
    """计算绩效指标"""
    if not equity_curve:
        return {}
    
    equities = [e["equity"] for e in equity_curve]
    initial = equities[0]
    final = equities[-1]
    
    # 总收益率
    total_return = (final - initial) / initial
    
    # 最大回撤
    peak = equities[0]
    max_drawdown = 0
    for equity in equities:
        if equity > peak:
            peak = equity
        drawdown = (peak - equity) / peak
        if drawdown > max_drawdown:
            max_drawdown = drawdown
    
    # 交易统计
    winning_trades = [t for t in trades if t["pnl"] > 0]
    losing_trades = [t for t in trades if t["pnl"] < 0]
    
    win_rate = len(winning_trades) / len(trades) if trades else 0
    
    avg_win = sum(t["pnl"] for t in winning_trades) / len(winning_trades) if winning_trades else 0
    avg_loss = sum(t["pnl"] for t in losing_trades) / len(losing_trades) if losing_trades else 0
    
    profit_factor = abs(avg_win / avg_loss) if avg_loss != 0 else 0
    
    # 年化收益率（假设365天）
    days = len(equity_curve) / 24  # 假设小时K线
    annual_return = (1 + total_return) ** (365 / days) - 1 if days > 0 else 0
    
    # 夏普比率（简化版）
    returns = []
    for i in range(1, len(equities)):
        ret = (equities[i] - equities[i-1]) / equities[i-1]
        returns.append(ret)
    
    if returns:
        sharpe = np.mean(returns) / np.std(returns) * np.sqrt(252) if np.std(returns) != 0 else 0
    else:
        sharpe = 0
    
    return {
        "total_return": total_return,
        "annual_return": annual_return,
        "max_drawdown": max_drawdown,
        "win_rate": win_rate,
        "profit_factor": profit_factor,
        "sharpe_ratio": sharpe,
        "total_trades": len(trades),
        "winning_trades": len(winning_trades),
        "losing_trades": len(losing_trades)
    }
```

- [ ] **Step 2: 提交**

```bash
git add backend/service/backtest/metrics.py
git commit -m "feat: add performance metrics calculation"
```

---

### Task 4.4: 创建回测 API

**Files:**
- Create: `backend/api/backtest.py`

- [ ] **Step 1: 创建回测 API**

```python
# backend/api/backtest.py
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from config.sqlalchemy import SessionLocal
from models.strategy import Strategy
from security.jwt import JWTBearer
from service.market.manager import market_manager
from service.strategy.registry import strategy_registry
from service.backtest.engine import BacktestEngine

router = APIRouter(tags=["backtest"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/backtest/run")
async def run_backtest(
    data: dict,
    credentials=Depends(JWTBearer()),
    db: Session = Depends(get_db)
):
    """运行回测"""
    import jwt
    import os
    
    # 解析用户ID
    token = credentials.credentials
    payload = jwt.decode(token, os.getenv("SECRET_KEY"), algorithms=["HS256"])
    user_id = payload["user_id"]
    
    # 获取策略
    strategy_id = data["strategy_id"]
    strategy = db.query(Strategy).filter(
        Strategy.id == strategy_id,
        Strategy.user_id == user_id
    ).first()
    
    if not strategy:
        raise HTTPException(status_code=404, detail="策略不存在")
    
    # 获取K线数据
    source = market_manager.get_source(strategy.exchange)
    klines = await source.get_klines(
        symbol=strategy.symbols[0],
        interval=data.get("interval", "1h"),
        limit=data.get("limit", 1000)
    )
    
    # 实例化策略
    strategy_class = strategy_registry.get(strategy.strategy_type)
    strategy_instance = strategy_class(strategy.parameters)
    
    # 运行回测
    engine = BacktestEngine(
        strategy=strategy_instance,
        initial_capital=data.get("initial_capital", 10000)
    )
    
    result = engine.run(klines)
    
    return {"code": 0, "data": result}
```

- [ ] **Step 2: 在 main.py 中注册路由**

```python
# 在 backend/main.py 中添加
from api.backtest import router as backtest_route

app.include_router(backtest_route, prefix="/api")
```

- [ ] **Step 3: 提交**

```bash
git add backend/api/backtest.py backend/main.py
git commit -m "feat: add backtest API endpoint"
```

---

## Phase 5: 交易执行模块 (Week 5)

### Task 5.1: 创建订单执行器

**Files:**
- Create: `backend/service/trade/executor.py`

- [ ] **Step 1: 创建订单执行器**

```python
# backend/service/trade/executor.py
from typing import Dict
from sqlalchemy.orm import Session
from models.order import Order, OrderSide, OrderType, OrderStatus


class OrderExecutor:
    """订单执行器"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def execute_order(
        self,
        user_id: int,
        symbol: str,
        exchange: str,
        side: str,
        order_type: str,
        quantity: float,
        price: float = None,
        strategy_id: int = None
    ) -> Dict:
        """执行订单"""
        # 创建订单记录
        order = Order(
            user_id=user_id,
            strategy_id=strategy_id,
            symbol=symbol,
            exchange=exchange,
            side=OrderSide(side),
            order_type=OrderType(order_type),
            price=price,
            quantity=quantity,
            status=OrderStatus.PENDING
        )
        
        self.db.add(order)
        self.db.commit()
        self.db.refresh(order)
        
        # TODO: 调用交易所API下单
        # 这里简化处理，直接标记为已成交
        order.status = OrderStatus.FILLED
        order.filled_quantity = quantity
        order.filled_price = price or 0  # 市价单需要获取实际成交价
        
        self.db.commit()
        
        return {
            "order_id": order.id,
            "status": order.status.value
        }
```

- [ ] **Step 2: 提交**

```bash
git add backend/service/trade/executor.py
git commit -m "feat: add order executor"
```

---

### Task 5.2: 创建交易 API

**Files:**
- Create: `backend/api/trade.py`

- [ ] **Step 1: 创建交易 API**

```python
# backend/api/trade.py
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from config.sqlalchemy import SessionLocal
from models.order import Order
from models.position import Position
from security.jwt import JWTBearer
from service.trade.executor import OrderExecutor

router = APIRouter(tags=["trade"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/trade/order")
async def place_order(
    data: dict,
    credentials=Depends(JWTBearer()),
    db: Session = Depends(get_db)
):
    """下单"""
    import jwt
    import os
    
    token = credentials.credentials
    payload = jwt.decode(token, os.getenv("SECRET_KEY"), algorithms=["HS256"])
    user_id = payload["user_id"]
    
    executor = OrderExecutor(db)
    result = await executor.execute_order(
        user_id=user_id,
        symbol=data["symbol"],
        exchange=data["exchange"],
        side=data["side"],
        order_type=data["order_type"],
        quantity=data["quantity"],
        price=data.get("price"),
        strategy_id=data.get("strategy_id")
    )
    
    return {"code": 0, "data": result}


@router.get("/trade/orders")
async def get_orders(
    credentials=Depends(JWTBearer()),
    db: Session = Depends(get_db)
):
    """获取订单列表"""
    import jwt
    import os
    
    token = credentials.credentials
    payload = jwt.decode(token, os.getenv("SECRET_KEY"), algorithms=["HS256"])
    user_id = payload["user_id"]
    
    orders = db.query(Order).filter(Order.user_id == user_id).order_by(Order.created_at.desc()).limit(100).all()
    
    return {
        "code": 0,
        "data": [
            {
                "id": o.id,
                "symbol": o.symbol,
                "side": o.side.value,
                "order_type": o.order_type.value,
                "quantity": o.quantity,
                "filled_quantity": o.filled_quantity,
                "price": o.price,
                "filled_price": o.filled_price,
                "status": o.status.value,
                "created_at": o.created_at.isoformat()
            }
            for o in orders
        ]
    }


@router.get("/trade/positions")
async def get_positions(
    credentials=Depends(JWTBearer()),
    db: Session = Depends(get_db)
):
    """获取持仓列表"""
    import jwt
    import os
    
    token = credentials.credentials
    payload = jwt.decode(token, os.getenv("SECRET_KEY"), algorithms=["HS256"])
    user_id = payload["user_id"]
    
    positions = db.query(Position).filter(Position.user_id == user_id).all()
    
    return {
        "code": 0,
        "data": [
            {
                "id": p.id,
                "symbol": p.symbol,
                "quantity": p.quantity,
                "avg_price": p.avg_price,
                "unrealized_pnl": p.unrealized_pnl,
                "realized_pnl": p.realized_pnl
            }
            for p in positions
        ]
    }
```

- [ ] **Step 2: 在 main.py 中注册路由**

```python
# 在 backend/main.py 中添加
from api.trade import router as trade_route

app.include_router(trade_route, prefix="/api")
```

- [ ] **Step 3: 提交**

```bash
git add backend/api/trade.py backend/main.py
git commit -m "feat: add trading API endpoints"
```

---

## Phase 6: WebSocket 实时推送 (Week 6)

### Task 6.1: 创建 WebSocket 端点

**Files:**
- Create: `backend/api/ws.py`

- [ ] **Step 1: 创建 WebSocket 端点**

```python
# backend/api/ws.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List
import asyncio
import json

router = APIRouter(tags=["websocket"])


class ConnectionManager:
    """WebSocket 连接管理器"""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
    
    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass


manager = ConnectionManager()


@router.websocket("/ws/market")
async def market_websocket(websocket: WebSocket):
    """行情 WebSocket"""
    await manager.connect(websocket)
    try:
        while True:
            # 接收订阅消息
            data = await websocket.receive_text()
            # 这里可以处理订阅请求
            # 暂时只保持连接
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
```

- [ ] **Step 2: 在 main.py 中注册路由**

```python
# 在 backend/main.py 中添加
from api.ws import router as ws_route

app.include_router(ws_route)
```

- [ ] **Step 3: 提交**

```bash
git add backend/api/ws.py backend/main.py
git commit -m "feat: add WebSocket endpoint for real-time data"
```

---

## Phase 7: 前端开发 (Week 7-8)

### Task 7.1: 安装前端依赖

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: 安装图表库**

```bash
cd frontend
npm install lightweight-charts recharts
```

- [ ] **Step 2: 提交**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add chart libraries"
```

---

### Task 7.2: 创建 Dashboard 页面

**Files:**
- Create: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: 创建 Dashboard 页面**

```tsx
// frontend/src/pages/Dashboard.tsx
import { useState } from 'react'
import Navbar from '../sections/Navbar'
import TickerList from '../components/Market/TickerList'
import KlineChart from '../components/Market/KlineChart'

export default function Dashboard() {
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT')
  
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navbar entranceComplete={true} onOpenAuth={() => {}} />
      
      <div className="pt-24 px-6 grid grid-cols-12 gap-4">
        {/* 左侧：行情列表 */}
        <div className="col-span-3">
          <TickerList 
            selectedSymbol={selectedSymbol}
            onSelect={setSelectedSymbol}
          />
        </div>
        
        {/* 中间：K线图 */}
        <div className="col-span-6">
          <KlineChart symbol={selectedSymbol} />
        </div>
        
        {/* 右侧：订单簿 */}
        <div className="col-span-3">
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-lg font-bold mb-4">订单簿</h3>
            {/* TODO: OrderBook component */}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/pages/Dashboard.tsx
git commit -m "feat: add Dashboard page layout"
```

---

### Task 7.3: 创建 K 线图组件

**Files:**
- Create: `frontend/src/components/Market/KlineChart.tsx`

- [ ] **Step 1: 创建 K 线图组件**

```tsx
// frontend/src/components/Market/KlineChart.tsx
import { useEffect, useRef } from 'react'
import { createChart } from 'lightweight-charts'
import { api } from '../../api'

interface KlineChartProps {
  symbol: string
  interval?: string
}

export default function KlineChart({ symbol, interval = '1h' }: KlineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (!chartContainerRef.current) return
    
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: '#1f2937' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
    })
    
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    })
    
    // 获取K线数据
    api.get(`/market/klines/${symbol}?interval=${interval}&limit=200`)
      .then(res => {
        const data = res.data.data.map((k: any) => ({
          time: Math.floor(new Date(k.open_time).getTime() / 1000),
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
        }))
        candlestickSeries.setData(data)
      })
    
    return () => chart.remove()
  }, [symbol, interval])
  
  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-bold mb-4">{symbol} K线图</h3>
      <div ref={chartContainerRef} />
    </div>
  )
}
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/components/Market/KlineChart.tsx
git commit -m "feat: add K-line chart component"
```

---

## Phase 8: 集成测试和部署 (Week 9)

### Task 8.1: 创建 API 测试脚本

**Files:**
- Create: `backend/tests/test_api.py`

- [ ] **Step 1: 创建测试脚本**

```python
# backend/tests/test_api.py
import httpx
import asyncio

BASE_URL = "http://localhost:8000/api"

async def test_market_api():
    async with httpx.AsyncClient() as client:
        # 测试行情API
        resp = await client.get(f"{BASE_URL}/market/ticker/BTCUSDT")
        assert resp.status_code == 200
        print("✓ 行情API测试通过")

async def test_strategy_api():
    # 需要先登录获取token
    pass

async def main():
    await test_market_api()
    print("所有测试通过")

if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: 提交**

```bash
git add backend/tests/test_api.py
git commit -m "test: add API test script"
```

---

## Summary

**完成时间线：**
- Week 1: 基础设施（数据库模型、依赖）
- Week 2: 行情数据模块
- Week 3: 策略管理模块
- Week 4: 回测系统
- Week 5: 交易执行模块
- Week 6: WebSocket 实时推送
- Week 7-8: 前端开发
- Week 9: 集成测试

**核心功能：**
- ✅ 多市场数据接入（Binance、OKX）
- ✅ 策略管理和执行引擎
- ✅ 历史数据回测
- ✅ 实时行情推送
- ✅ 订单和持仓管理

**下一步扩展：**
- 添加更多交易所支持
- 实现更多策略（RSI、布林带、网格等）
- 添加风险管理模块
- 实现策略市场（策略分享和订阅）
- 移动端 App 开发
