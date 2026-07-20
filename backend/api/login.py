from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from config.redis import redis_client
from config.sqlalchemy import SessionLocal
from models.user import User
from security.jwt import create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from service.captcha import verify_digit_captcha
from utils.client_ip import get_client_ip
import re
import json
import bcrypt
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class LoginRequest(BaseModel):
    username: str
    password: str
    captcha_id: str
    captcha_code: str

def _incr_rate_key(key: str, limit: int, window: int) -> bool:
    """
    原子 INCR 限流：返回 True 表示被限制。
    避免 get-then-incr 竞态：先 INCR 再判断，首次 INCR 时设置过期。
    """
    current = redis_client.incr(key)
    if current == 1:
        redis_client.expire(key, window)
    return current > limit

def check_login_rate_limit(username: str, client_ip: str) -> bool:
    """
    检查登录频率限制，返回 True 表示被限制。
    同时按用户名和 IP 双维度限流，防止单 IP 轮换用户名爆破。
    """
    # 用户名维度：5 次 / 5 分钟
    if _incr_rate_key(f"login_attempts:{username}", limit=5, window=300):
        return True
    # IP 维度：20 次 / 5 分钟（允许同一 NAT 后多用户正常登录）
    if _incr_rate_key(f"login_attempts_ip:{client_ip}", limit=20, window=300):
        return True
    return False

def reset_login_attempts(username: str):
    """登录成功后重置尝试次数"""
    redis_client.delete(f"login_attempts:{username}")

@router.post("/login")
async def login(data: LoginRequest, request: Request):
    session = SessionLocal()
    try:
        username = data.username
        password = data.password
        captcha_id = data.captcha_id
        captcha_code = data.captcha_code
        client_ip = get_client_ip(request)

        # 1. 校验图形验证码（最先，防止无效请求）
        if not captcha_id or not captcha_code:
            logger.warning(f"[登录] 缺少验证码参数: username={username}")
            raise HTTPException(status_code=400, detail="请输入验证码")

        if not verify_digit_captcha(captcha_id, captcha_code):
            logger.warning(f"[登录] 验证码错误: username={username}, ip={client_ip}")
            raise HTTPException(status_code=400, detail="验证码错误")

        if re.search(r"[;'\s]", username) or re.search(r"[;'\s]", password):
            raise HTTPException(status_code=400, detail="用户名或密码包含特殊字符")

        if check_login_rate_limit(username, client_ip):
            raise HTTPException(status_code=429, detail="登录尝试过于频繁，请稍后重试")

        user = session.query(User).filter_by(username=username).first()
        if not user:
            raise HTTPException(status_code=400, detail="用户名不存在")

        if not bcrypt.checkpw(password.encode('utf-8'), user.password.encode('utf-8')):
            raise HTTPException(status_code=400, detail="密码错误")

        reset_login_attempts(username)

        access_token = create_access_token(data={"username": user.username, "user_id": user.id})

        redis_client.set(access_token, json.dumps({"username": user.username}), ex=ACCESS_TOKEN_EXPIRE_MINUTES * 60)

        logger.info(f"[登录] 登录成功: username={username}, ip={client_ip}")
        return {"username": user.username, "message": "登录成功","token": access_token}
    finally:
        session.close()
