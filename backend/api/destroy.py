from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel
from config.redis import redis_client
from config.sqlalchemy import SessionLocal
from models.user import User
from security.jwt import JWTBearer, SECRET_KEY, ALGORITHM
import jwt
import bcrypt
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class DestroyRequest(BaseModel):
    password: str


@router.post("/destroy")
async def destroy_user(
    data: DestroyRequest,
    credentials: HTTPAuthorizationCredentials = Depends(JWTBearer()),
):
    session = SessionLocal()
    try:
        token = credentials.credentials
        # 从 JWT payload 中获取用户名
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("username")

        if not username:
            raise HTTPException(status_code=401, detail="无效的Token")

        logger.info(f"[注销] 开始注销用户: username={username}")

        user = session.query(User).filter_by(username=username).first()
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
        return {"message": "用户注销成功"}, 200
    finally:
        session.close()
