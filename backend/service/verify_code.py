import random
import string
import time
import os
import smtplib
import logging
from email.mime.text import MIMEText
from config.redis import redis_client

logger = logging.getLogger(__name__)

def generate_verify_code(email: str):
    verify_code = "".join(random.choices(string.digits, k=6))
    redis_client.set(email, verify_code, ex=60 * 5)
    logger.info(f"[验证码] 生成验证码: email={email}, code={verify_code}")
    return verify_code
    
def verify_verify_code(email: str, verify_code: str):
    stored_verify_code = redis_client.get(email)
    if stored_verify_code is None:
        logger.warning(f"[验证码] 验证码不存在或已过期: email={email}")
        return False
    if stored_verify_code != verify_code:
        logger.warning(f"[验证码] 验证码错误: email={email}")
        return False
    logger.info(f"[验证码] 验证成功: email={email}")
    return True

def verify_verify_code_expire(email: str):
    stored_verify_code = redis_client.get(email)
    if stored_verify_code is None:
        logger.warning(f"[验证码] 验证码不存在: email={email}")
        return False
    stored_verify_code = stored_verify_code.decode("utf-8")
    is_expired = time.time() - float(stored_verify_code) > 60 * 5
    if is_expired:
        logger.warning(f"[验证码] 验证码已过期: email={email}")
    return is_expired

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