from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from config.redis import redis_client
from config.sqlalchemy import SessionLocal
from models.user import User
from security.jwt import JWTBearer
import bcrypt
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class DestroyRequest(BaseModel):
    password: str


def _incr_rate_key(key: str, limit: int, window: int) -> bool:
    """原子 INCR 限流：返回 True 表示被限制。"""
    current = redis_client.incr(key)
    if current == 1:
        redis_client.expire(key, window)
    return current > limit


@router.post("/destroy")
async def destroy_user(
    data: DestroyRequest,
    credentials: dict = Depends(JWTBearer()),
):
    session = SessionLocal()
    try:
        token = credentials.get("token")
        username = credentials.get("username")

        if not username:
            raise HTTPException(status_code=401, detail="无效的Token")

        # 频率限制：3 次 / 10 分钟（防止密码暴力破解）
        if _incr_rate_key(f"destroy_attempts:{username}", limit=3, window=600):
            logger.warning(f"[注销] 频率超限: username={username}")
            raise HTTPException(status_code=429, detail="注销尝试过于频繁，请稍后再试")

        logger.info(f"[注销] 开始注销用户: username={username}")

        # 使用行锁防止并发删除
        user = session.query(User).filter_by(username=username).with_for_update().first()
        if not user:
            logger.warning(f"[注销] 用户不存在: username={username}")
            raise HTTPException(status_code=400, detail="用户不存在")

        # 验证密码
        if not bcrypt.checkpw(data.password.encode('utf-8'), user.password.encode('utf-8')):
            logger.warning(f"[注销] 密码验证失败: username={username}")
            raise HTTPException(status_code=400, detail="密码错误")

        # 删除用户记录
        session.delete(user)
        session.commit()

        # 删除 Redis 中的 token
        redis_client.delete(token)

        logger.info(f"[注销] 用户注销成功: username={username}")
        return {"message": "用户注销成功"}
    finally:
        session.close()
