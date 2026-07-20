from fastapi import APIRouter, HTTPException, status, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from config.sqlalchemy import SessionLocal
from models.user import User
from service.verify_code import generate_verify_code, send_verify_code, verify_verify_code
from service.captcha import consume_captcha
from config.redis import redis_client
from security.jwt import create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from utils.client_ip import get_client_ip
from service.trade.risk_manager import ensure_user_account
import re
import bcrypt
import logging
import json
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter()

def check_rate_limit(key: str, limit: int = 5, window: int = 300) -> bool:
    """
    检查频率限制，返回 True 表示被限制。
    使用 INCR 原子操作避免 get-then-incr 的竞态条件：
    先 INCR 拿到当前计数，再判断是否超限，首次 INCR 时设置过期时间。
    """
    redis_key = f"rate_limit:{key}"
    current = redis_client.incr(redis_key)
    if current == 1:
        # 首次创建 key，设置过期时间
        redis_client.expire(redis_key, window)
    return current > limit

class SendVerifyCodeRequest(BaseModel):
    username: str
    email: str
    captcha_id: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    confirm_password: str
    email: str
    verify_code: str

@router.post("/send_verify_code")
async def send_verify_code_api(data: SendVerifyCodeRequest):
    email = data.email
    if not email or not re.match(r"^[\w\.-]+@[\w\.-]+\.\w+$", email):
        raise HTTPException(status_code=400, detail="邮箱格式错误")

    # 先查重：用户名/邮箱已注册则直接拒绝（在消费滑动验证码之前，不浪费用户的拼图）
    session = SessionLocal()
    try:
        existing_user = session.query(User).filter_by(username=data.username).first()
        existing_email = session.query(User).filter_by(email=email).first()
    finally:
        session.close()
    if existing_user:
        logger.warning(f"[验证码] 用户名已注册: username={data.username}")
        raise HTTPException(status_code=400, detail="该用户名已注册，请更换后重试")
    if existing_email:
        logger.warning(f"[验证码] 邮箱已注册: email={email}")
        raise HTTPException(status_code=400, detail="该邮箱已注册，请更换后重试")

    # 校验滑动验证码（必须先通过滑动验证才能发送邮件验证码）
    if not consume_captcha(data.captcha_id):
        logger.warning(f"[验证码] 滑动验证未通过或已过期: email={email}, captcha_id={data.captcha_id}")
        raise HTTPException(status_code=400, detail="请先完成滑动验证")

    if check_rate_limit(f"send_code:{email}", limit=1, window=60):
        raise HTTPException(status_code=429, detail="请稍后再试")
    
    verify_code = generate_verify_code(email)
    result = send_verify_code(email, verify_code)
    
    if isinstance(result, tuple) and result[1] == 500:
        raise HTTPException(status_code=500, detail=result[0]["error"])
    
    return {"message": "验证码发送成功"}

@router.post("/register")
async def register(request: Request, data: RegisterRequest):
    session = SessionLocal()
    try:
        username = data.username
        password = data.password
        confirm_password = data.confirm_password
        email = data.email
        verify_code = data.verify_code
        
        # 获取客户端 IP 地址（支持反向代理，已防伪造）
        client_ip = get_client_ip(request)
        
        # 1. 频率限制（最先）
        logger.info(f"[注册] 检查频率限制: username={username}, email={email}, ip={client_ip}")
        if check_rate_limit(f"register:{username}", limit=3, window=3600):
            logger.warning(f"[注册] 频率限制触发: username={username}")
            raise HTTPException(status_code=429, detail="请稍后再试")
        
        # 2. 验证码验证（防止恶意请求）
        logger.info(f"[注册] 验证验证码: email={email}")
        if not verify_code or not verify_verify_code(email, verify_code):
            logger.warning(f"[注册] 验证码验证失败: email={email}")
            raise HTTPException(status_code=400, detail="验证码错误")
        logger.info(f"[注册] 验证码验证通过: email={email}")
        
        # 3. 基础格式验证（无数据库查询）
        logger.info(f"[注册] 开始基础格式验证")
        if not username or len(username) < 3 or len(username) > 20:
            logger.warning(f"[注册] 用户名格式错误: username={username}")
            raise HTTPException(status_code=400, detail="用户名长度需在3-20个字符之间")
        
        if not password or len(password) < 6:
            logger.warning(f"[注册] 密码长度不足: username={username}")
            raise HTTPException(status_code=400, detail="密码长度不能少于6位")
        
        if password != confirm_password:
            logger.warning(f"[注册] 密码不一致: username={username}")
            raise HTTPException(status_code=400, detail="确认密码与密码不一致")
        
        if not email or not re.match(r"^[\w\.-]+@[\w\.-]+\.\w+$", email):
            logger.warning(f"[注册] 邮箱格式错误: email={email}")
            raise HTTPException(status_code=400, detail="邮箱格式错误")
        
        # 4. 数据库查询（最后）
        logger.info(f"[注册] 检查用户名和邮箱是否已存在")
        existing_user = session.query(User).filter_by(username=username).first()
        if existing_user:
            logger.warning(f"[注册] 用户名已存在: username={username}")
            raise HTTPException(status_code=400, detail="用户名已存在")
        
        existing_email = session.query(User).filter_by(email=email).first()
        if existing_email:
            logger.warning(f"[注册] 邮箱已存在: email={email}")
            raise HTTPException(status_code=400, detail="邮箱已存在")
        
        # 5. 创建用户
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12))
        now = datetime.now()
        new_user = User(
            username=username,
            password=hashed_password.decode('utf-8'),
            email=email,
            ip_address=client_ip,
            status=1,  # 默认启用
            created_at=now,
            updated_at=now
        )
        session.add(new_user)
        session.commit()
        session.refresh(new_user)
        
        # 6. 生成 token 并存储到 Redis
        access_token = create_access_token(data={"username": new_user.username, "user_id": new_user.id})
        redis_client.set(access_token, json.dumps({"username": new_user.username}), ex=ACCESS_TOKEN_EXPIRE_MINUTES * 60)

        # 7. 初始化用户风控账户（user_account:{user_id}）
        ensure_user_account(new_user.id)
        
        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content={
                "message": "注册成功",               
                "username": new_user.username,
                "token": access_token
            }
        )
    finally:
        session.close()