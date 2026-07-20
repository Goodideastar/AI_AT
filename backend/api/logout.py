# 退出登录接口
import logging
from fastapi import APIRouter, HTTPException, Depends
from security.jwt import JWTBearer
from config.redis import redis_client

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/logout")
async def logout(credentials: dict = Depends(JWTBearer())):
    """退出登录"""
    token = credentials.get("token")

    # 检查 token 是否存在于 Redis
    stored_token = redis_client.get(token)
    if not stored_token:
        raise HTTPException(status_code=401, detail="未登录或 token 已过期")

    # 从 Redis 中删除 token
    try:
        redis_client.delete(token)
        logger.info(f"用户退出登录成功，token已删除")
        return {"message": "退出登录成功"}
    except Exception as e:
        logger.error(f"删除 token 失败: {e}")
        raise HTTPException(status_code=500, detail="退出登录失败")
