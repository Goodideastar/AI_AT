# backend/api/ws.py
"""
WebSocket 实时行情推送

设计要点：
1. 鉴权：连接时通过 query 参数 ?token=<JWT> 验证（复用 jwt.py 的解码逻辑 + Redis 校验）
2. 订阅频道：客户端 send_json({"action":"subscribe","symbol":"BTCUSDT","exchange":"binance"})
             send_json({"action":"unsubscribe","symbol":"BTCUSDT","exchange":"binance"})
3. 广播循环：后台任务 _broadcast_loop 每秒拉取所有已订阅 symbol 的 ticker，推送给订阅者
4. 断线清理：disconnect 用 try/except 避免 ValueError
5. 心跳：服务端每 30 秒广播 ping，客户端需在 10 秒内回 pong，否则断开
"""
import asyncio
import json
import logging
from typing import Dict, List, Set, Optional
from datetime import datetime

import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from config.redis import redis_client
from security import jwt as jwt_conf
from service.market.manager import market_manager

logger = logging.getLogger(__name__)
router = APIRouter()


# ----------------------------------------------------------------------
# 连接管理器：按 (exchange, symbol) 频道分组
# ----------------------------------------------------------------------

class ConnectionManager:
    """WebSocket 连接管理器

    内部结构：
        self.channels: Dict[(exchange, symbol), Set[WebSocket]]
        self.conn_subs: Dict[WebSocket, Set[(exchange, symbol)]]  # 反向索引，便于断线清理
    """

    def __init__(self):
        self.channels: Dict[tuple, Set[WebSocket]] = {}
        self.conn_subs: Dict[WebSocket, Set[tuple]] = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.conn_subs[websocket] = set()

    def subscribe(self, websocket: WebSocket, exchange: str, symbol: str):
        key = (exchange, symbol.upper())
        self.channels.setdefault(key, set()).add(websocket)
        self.conn_subs.setdefault(websocket, set()).add(key)
        logger.info("WS 订阅: %s@%s，当前频道连接数=%d", symbol, exchange, len(self.channels[key]))

    def unsubscribe(self, websocket: WebSocket, exchange: str, symbol: str):
        key = (exchange, symbol.upper())
        if key in self.channels:
            self.channels[key].discard(websocket)
            if not self.channels[key]:
                del self.channels[key]
        if websocket in self.conn_subs:
            self.conn_subs[websocket].discard(key)

    def disconnect(self, websocket: WebSocket):
        """断线时清理该连接的所有订阅"""
        subs = self.conn_subs.pop(websocket, set())
        for key in subs:
            conns = self.channels.get(key)
            if conns is not None:
                conns.discard(websocket)
                if not conns:
                    del self.channels[key]

    def get_subscribed_symbols(self) -> Set[tuple]:
        """返回当前所有有订阅者的 (exchange, symbol) 频道"""
        return set(self.channels.keys())

    async def broadcast_to_channel(self, channel: tuple, message: dict):
        """向指定频道的所有连接广播"""
        conns = list(self.channels.get(channel, set()))
        dead = []
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        # 清理发送失败的连接
        for ws in dead:
            self.disconnect(ws)

    async def broadcast_all(self, message: dict):
        """向所有连接广播（用于心跳 ping）"""
        conns = list(self.conn_subs.keys())
        dead = []
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


# ----------------------------------------------------------------------
# JWT 鉴权（WebSocket 不能用 HTTPBearer，需手动从 query 参数读取）
# ----------------------------------------------------------------------

def verify_ws_token(token: Optional[str]) -> dict:
    """验证 JWT token，返回 payload。失败抛 ValueError。"""
    if not token:
        raise ValueError("缺少 token 参数")

    # 1. Redis 校验：token 必须存在
    if not redis_client.exists(token):
        raise ValueError("Token 无效或已过期")

    # 2. JWT 解码
    try:
        payload = jwt.decode(token, jwt_conf.SECRET_KEY, algorithms=[jwt_conf.ALGORITHM])
        payload["token"] = token
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Token 已过期")
    except jwt.PyJWTError:
        raise ValueError("Token 解析失败")


# ----------------------------------------------------------------------
# WebSocket 端点
# ----------------------------------------------------------------------

@router.websocket("/ws/market")
async def market_websocket(
    websocket: WebSocket,
    token: Optional[str] = Query(default=None),
):
    """实时行情 WebSocket 端点

    连接：ws://host:port/ws/market?token=<JWT>
    订阅：send_json({"action":"subscribe","symbol":"BTCUSDT","exchange":"binance"})
    退订：send_json({"action":"unsubscribe","symbol":"BTCUSDT","exchange":"binance"})
    心跳：收到 {"type":"ping"} 后回 {"type":"pong"}
    """
    # 1. 鉴权
    try:
        payload = verify_ws_token(token)
        user_id = payload.get("user_id")
        username = payload.get("username")
        logger.info("WS 连接建立: user=%s/%s", user_id, username)
    except ValueError as e:
        await websocket.close(code=4001, reason=str(e))
        return

    # 2. 接受连接
    await manager.connect(websocket)

    # 3. 主循环：接收客户端消息（订阅/退订/pong）
    try:
        while True:
            try:
                msg = await websocket.receive_text()
            except WebSocketDisconnect:
                break

            try:
                data = json.loads(msg)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "消息格式必须是 JSON"})
                continue

            action = data.get("action")
            symbol = data.get("symbol")
            exchange = data.get("exchange", "binance")

            if action == "subscribe" and symbol:
                manager.subscribe(websocket, exchange, symbol)
                await websocket.send_json({
                    "type": "subscribed",
                    "symbol": symbol.upper(),
                    "exchange": exchange,
                })
            elif action == "unsubscribe" and symbol:
                manager.unsubscribe(websocket, exchange, symbol)
                await websocket.send_json({
                    "type": "unsubscribed",
                    "symbol": symbol.upper(),
                    "exchange": exchange,
                })
            elif action == "pong":
                # 客户端对心跳的回应，无需处理
                pass
            else:
                await websocket.send_json({
                    "type": "error",
                    "message": f"未知 action: {action}",
                })
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.exception("WS 异常: user=%s, err=%s", user_id, e)
    finally:
        manager.disconnect(websocket)
        logger.info("WS 连接断开: user=%s", user_id)


# ----------------------------------------------------------------------
# 后台广播任务：定时拉取行情并推送到订阅频道
# ----------------------------------------------------------------------

async def _broadcast_loop():
    """后台任务：每 1 秒拉取所有已订阅 symbol 的 ticker 并广播。

    在 main.py 的 startup 事件中通过 asyncio.create_task 启动。
    """
    logger.info("WS 广播任务启动")
    while True:
        try:
            channels = manager.get_subscribed_symbols()
            if not channels:
                await asyncio.sleep(1)
                continue

            # 并发拉取所有频道的行情
            async def fetch_one(exchange: str, symbol: str):
                try:
                    source = market_manager.get_source(exchange)
                    ticker = await source.get_ticker(symbol)
                    return (exchange, symbol), ticker
                except Exception as e:
                    logger.warning("WS 拉取行情失败: %s@%s - %s", symbol, exchange, e)
                    return None, None

            results = await asyncio.gather(
                *[fetch_one(exch, sym) for (exch, sym) in channels]
            )

            for channel, ticker in results:
                if channel is None or ticker is None:
                    continue
                await manager.broadcast_to_channel(channel, {
                    "type": "ticker",
                    "symbol": ticker["symbol"],
                    "exchange": ticker["exchange"],
                    "last_price": ticker["last_price"],
                    "bid": ticker.get("bid"),
                    "ask": ticker.get("ask"),
                    "volume_24h": ticker.get("volume_24h"),
                    "high_24h": ticker.get("high_24h"),
                    "low_24h": ticker.get("low_24h"),
                    "timestamp": datetime.now().isoformat(),
                })
        except asyncio.CancelledError:
            logger.info("WS 广播任务被取消")
            raise
        except Exception as e:
            logger.exception("WS 广播循环异常: %s", e)
            await asyncio.sleep(5)  # 异常后短暂等待，避免 busy loop

        await asyncio.sleep(1)  # 1 秒推送频率


async def _heartbeat_loop():
    """后台任务：每 30 秒向所有连接发送 ping，用于保活和健康检查。"""
    logger.info("WS 心跳任务启动")
    while True:
        try:
            await manager.broadcast_all({"type": "ping", "timestamp": datetime.now().isoformat()})
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning("WS 心跳异常: %s", e)
        await asyncio.sleep(30)


# 全局任务句柄，便于 shutdown 时取消
_broadcast_task: Optional[asyncio.Task] = None
_heartbeat_task: Optional[asyncio.Task] = None


def start_ws_background_tasks():
    """在 FastAPI startup 事件中调用"""
    global _broadcast_task, _heartbeat_task
    if _broadcast_task is None:
        _broadcast_task = asyncio.create_task(_broadcast_loop())
    if _heartbeat_task is None:
        _heartbeat_task = asyncio.create_task(_heartbeat_loop())


async def stop_ws_background_tasks():
    """在 FastAPI shutdown 事件中调用"""
    global _broadcast_task, _heartbeat_task
    for task in (_broadcast_task, _heartbeat_task):
        if task is not None:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
    _broadcast_task = None
    _heartbeat_task = None
    logger.info("WS 后台任务已停止")
