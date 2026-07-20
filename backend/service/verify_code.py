import random
import string
import os
import smtplib
import logging
from email.mime.text import MIMEText
from config.redis import redis_client

logger = logging.getLogger(__name__)

# 验证码 Redis key 前缀，避免与其他业务 key 冲突
VERIFY_CODE_PREFIX = "verify_code:"


def generate_verify_code(email: str):
    verify_code = "".join(random.choices(string.digits, k=6))
    redis_client.set(f"{VERIFY_CODE_PREFIX}{email}", verify_code, ex=60 * 5)
    logger.info(f"[验证码] 生成验证码: email={email}")
    return verify_code


def verify_verify_code(email: str, verify_code: str):
    stored_verify_code = redis_client.get(f"{VERIFY_CODE_PREFIX}{email}")
    if stored_verify_code is None:
        logger.warning(f"[验证码] 验证码不存在或已过期: email={email}")
        return False
    if stored_verify_code != verify_code:
        logger.warning(f"[验证码] 验证码错误: email={email}")
        return False
    logger.info(f"[验证码] 验证成功: email={email}")
    return True


def send_verify_code(email: str, verify_code: str):
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")

    if not all([smtp_host, smtp_user, smtp_password]):
        logger.error(f"[验证码] 邮箱服务未配置: smtp_host={smtp_host}, smtp_user={smtp_user}")
        return {"error": "未配置邮箱服务"}, 500

    msg = MIMEText(f"【AT项目】验证码 {verify_code} 用于注册验证，5分钟内有效，请勿于他人共享。", "plain", "utf-8")
    msg["Subject"] = "验证码"
    msg["From"] = smtp_user
    msg["To"] = email

    try:
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, [email], msg.as_string())
        server.quit()
        logger.info(f"[验证码] 发送成功: email={email}")
        return {"message": "验证码发送成功"}
    except Exception as e:
        logger.error(f"[验证码] 发送失败: email={email}, error={str(e)}")
        return {"error": f"发送失败: {str(e)}"}, 500
