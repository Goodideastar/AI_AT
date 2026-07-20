from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from config.redis import redis_client
from config.sqlalchemy import SessionLocal
from models.user import User
from security.jwt import create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from service.captcha import verify_digit_captcha
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

def check_login_rate_limit(username: str) -> bool:
    """检查登录频率限制，返回 True 表示被限制"""
    key = f"login_attempts:{username}"
    current = redis_client.get(key)
    if current and int(current) >= 5:
        return True
    pipe = redis_client.pipeline()
    pipe.incr(key)
    pipe.expire(key, 300)
    pipe.execute()
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

        # 1. 校验图形验证码（最先，防止无效请求）
        if not captcha_id or not captcha_code:
            logger.warning(f"[登录] 缺少验证码参数: username={username}")
            raise HTTPException(status_code=400, detail="请输入验证码")

        if not verify_digit_captcha(captcha_id, captcha_code):
            logger.warning(f"[登录] 验证码错误: username={username}")
            raise HTTPException(status_code=400, detail="验证码错误")

        if re.search(r"[;'\s]", username) or re.search(r"[;'\s]", password):
            raise HTTPException(status_code=400, detail="用户名或密码包含特殊字符")

        if check_login_rate_limit(username):
            raise HTTPException(status_code=429, detail="登录尝试过于频繁，请5分钟后重试")

        user = session.query(User).filter_by(username=username).first()
        if not user:
            raise HTTPException(status_code=400, detail="用户名不存在")

        if not bcrypt.checkpw(password.encode('utf-8'), user.password.encode('utf-8')):
            raise HTTPException(status_code=400, detail="密码错误")

        reset_login_attempts(username)

        access_token = create_access_token(data={"username": user.username, "user_id": user.id})

        redis_client.set(access_token, json.dumps({"username": user.username}), ex=ACCESS_TOKEN_EXPIRE_MINUTES * 60)

        logger.info(f"[登录] 登录成功: username={username}")
        return {"username": user.username, "message": "登录成功","token": access_token}
    finally:
        session.close()
