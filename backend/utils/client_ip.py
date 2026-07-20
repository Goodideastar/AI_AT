"""
客户端 IP 获取工具

安全策略：
- 生产环境通过 Nginx 反向代理，Nginx 已配置 `proxy_set_header X-Forwarded-For $remote_addr;`
  （用 $remote_addr 直接覆盖，而非 $proxy_add_x_forwarded_for 追加）
  因此 X-Forwarded-For 头中只有一个值，即真实客户端 IP，客户端无法伪造
- 开发环境直连后端时，X-Forwarded-For 不存在，回退到 request.client.host

优先级：X-Forwarded-For → X-Real-IP → request.client.host → "unknown"
"""
from fastapi import Request
import logging

logger = logging.getLogger(__name__)


def get_client_ip(request: Request) -> str:
    """
    从请求中获取客户端真实 IP。

    在反向代理场景下，依赖 Nginx 设置的 X-Forwarded-For 头。
    Nginx 配置必须是 `proxy_set_header X-Forwarded-For $remote_addr;`
    （覆盖而非追加），否则客户端可伪造此头绕过 IP 限流。

    Args:
        request: FastAPI Request 对象

    Returns:
        客户端 IP 字符串，无法获取时返回 "unknown"
    """
    # 1. 优先取 X-Forwarded-For（Nginx 已覆盖为真实客户端 IP）
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # 取第一个值并去除空白（兼容多级代理场景，取最原始客户端）
        ip = forwarded_for.split(",")[0].strip()
        if ip:
            return ip

    # 2. 回退到 X-Real-IP（Nginx 设置的直接对端 IP）
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    # 3. 直连场景：取 TCP 连接的对端地址
    if request.client and request.client.host:
        return request.client.host

    # 4. 无法获取
    logger.warning("无法获取客户端 IP，请求头: %s", dict(request.headers))
    return "unknown"
