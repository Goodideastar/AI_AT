import logging
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from service.captcha import generate_captcha, verify_captcha, generate_digit_captcha
from api.register import check_rate_limit

logger = logging.getLogger(__name__)

router = APIRouter()


class GenerateRequest(BaseModel):
    pass  # 无需参数


class VerifyRequest(BaseModel):
    captcha_id: str
    x: int


@router.post("/captcha/generate")
async def captcha_generate(request: Request):
    """生成滑动拼图验证码（无需鉴权）。"""
    # IP 级限流：每 IP 每分钟最多 10 次
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    else:
        client_ip = request.headers.get("X-Real-IP") or (request.client.host if request.client else "unknown")

    if check_rate_limit(f"captcha_gen:{client_ip}", limit=10, window=60):
        raise HTTPException(status_code=429, detail="操作过于频繁，请稍后再试")

    try:
        data = generate_captcha()
        logger.info(f"[验证码] 生成成功: id={data['captcha_id']}")
        return data
    except Exception as e:
        logger.error(f"[验证码] 生成失败: {str(e)}")
        raise HTTPException(status_code=500, detail="验证码生成失败")


@router.post("/captcha/verify")
async def captcha_verify(data: VerifyRequest):
    """验证滑动坐标（无需鉴权）。"""
    success = verify_captcha(data.captcha_id, data.x)
    if success:
        return {"success": True, "message": "验证通过"}
    else:
        return {"success": False, "message": "验证失败，请重试"}


@router.post("/captcha/login/generate")
async def captcha_login_generate(request: Request):
    """生成 4 位数字图形验证码（用于登录，无需鉴权）。"""
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    else:
        client_ip = request.headers.get("X-Real-IP") or (request.client.host if request.client else "unknown")

    if check_rate_limit(f"login_captcha_gen:{client_ip}", limit=20, window=60):
        raise HTTPException(status_code=429, detail="操作过于频繁，请稍后再试")

    try:
        data = generate_digit_captcha()
        logger.info(f"[验证码] 数字验证码生成成功: id={data['captcha_id']}")
        return data
    except Exception as e:
        logger.error(f"[验证码] 数字验证码生成失败: {str(e)}")
        raise HTTPException(status_code=500, detail="验证码生成失败")
