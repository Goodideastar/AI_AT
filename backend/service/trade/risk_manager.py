# backend/service/trade/risk_manager.py
"""风险控制模块，负责在下单前/持仓中校验各类风控规则。"""
import json
import logging
from typing import Dict, Any

from config.redis import redis_client

logger = logging.getLogger(__name__)

# 风控常量
MAX_POSITION_RATIO = 0.30      # 单用户最大持仓占账户资金比例
MAX_DAILY_LOSS_RATIO = 0.05    # 单日最大亏损占账户资金比例
MAX_TRADE_RISK_RATIO = 0.02    # 单笔交易最大风险占账户资金比例
STOP_LOSS_RATIO = 0.05         # 强制止损线（持仓亏损比例）

# 新用户默认账户配置
DEFAULT_INITIAL_CAPITAL = 10000.0


def ensure_user_account(user_id: int, initial_capital: float = DEFAULT_INITIAL_CAPITAL) -> None:
    """
    初始化用户账户 Redis 键（仅当不存在时写入）。
    应在用户注册时调用，保证后续风控校验可读到账户信息。
    使用 SETNX 语义：已存在的账户不会被覆盖。
    """
    key = f"user_account:{user_id}"
    if redis_client.exists(key):
        return
    account = {
        "total_capital": float(initial_capital),
        "position_value": 0.0,
        "daily_loss": 0.0,
    }
    # SETNX 保证并发注册场景下也不会覆盖
    redis_client.setnx(key, json.dumps(account))
    logger.info("初始化用户账户: user_id=%s, initial_capital=%.2f", user_id, initial_capital)


class RiskManager:
    """风控管理器：基于 Redis 中的用户账户信息执行风控校验。"""

    def _get_user_account(self, user_id: int) -> Dict[str, Any]:
        """从 Redis 读取用户账户信息。

        约定 key: user_account:{user_id}
        存储格式: JSON 字符串，至少包含以下字段:
            - total_capital: 账户总资金
            - position_value: 当前持仓市值
            - daily_loss: 当日已实现亏损（正数表示亏损）

        若 key 不存在，自动以默认值初始化，避免风控始终拒绝。
        """
        key = f"user_account:{user_id}"
        raw = redis_client.get(key)
        if raw is None:
            logger.warning("用户账户信息缺失，自动初始化: user_id=%s", user_id)
            ensure_user_account(user_id)
            raw = redis_client.get(key)
            if raw is None:
                raise ValueError(f"用户账户信息初始化失败: {user_id}")
        return json.loads(raw)

    # ------------------------------------------------------------------
    # 1. 持仓上限校验
    # ------------------------------------------------------------------
    def check_position_limit(self, user_id: int, new_position_value: float) -> bool:
        """校验新增持仓后，总持仓是否超过账户资金的 30%。

        Args:
            user_id: 用户 ID
            new_position_value: 本次拟新增的持仓市值

        Returns:
            True 表示通过校验（可以下单），False 表示超限。
        """
        try:
            account = self._get_user_account(user_id)
        except ValueError:
            return False

        total_capital = float(account.get("total_capital", 0))
        if total_capital <= 0:
            logger.warning("用户账户资金异常, user_id=%s, total_capital=%s", user_id, total_capital)
            return False

        current_position = float(account.get("position_value", 0))
        max_allowed = total_capital * MAX_POSITION_RATIO

        if current_position + new_position_value > max_allowed:
            logger.info(
                "持仓超限拒绝: user_id=%s, 当前持仓=%.2f, 新增=%.2f, 上限=%.2f",
                user_id, current_position, new_position_value, max_allowed,
            )
            return False
        return True

    # ------------------------------------------------------------------
    # 2. 单日亏损上限校验
    # ------------------------------------------------------------------
    def check_daily_loss_limit(self, user_id: int) -> bool:
        """校验当日已实现亏损是否超过账户资金的 5%。

        Returns:
            True 表示未触及单日亏损上限（可继续交易），False 表示已触及。
        """
        try:
            account = self._get_user_account(user_id)
        except ValueError:
            return False

        total_capital = float(account.get("total_capital", 0))
        if total_capital <= 0:
            return False

        daily_loss = float(account.get("daily_loss", 0))
        max_daily_loss = total_capital * MAX_DAILY_LOSS_RATIO

        if daily_loss >= max_daily_loss:
            logger.info(
                "单日亏损上限触及: user_id=%s, 当日亏损=%.2f, 上限=%.2f",
                user_id, daily_loss, max_daily_loss,
            )
            return False
        return True

    # ------------------------------------------------------------------
    # 3. 单笔止损校验
    # ------------------------------------------------------------------
    def check_stop_loss(self, position: Dict[str, Any], current_price: float) -> bool:
        """校验持仓是否触发强制止损线（亏损 >= 5%）。

        Args:
            position: 持仓字典，需包含 entry_price（开仓均价）字段。
            current_price: 当前市场价格。

        Returns:
            True 表示未触发止损（持仓安全），False 表示已触发止损。
        """
        entry_price = float(position.get("entry_price", 0))
        if entry_price <= 0:
            logger.warning("持仓开仓价异常: %s", position)
            return True  # 数据异常时保守放行，由上层处理

        loss_ratio = (entry_price - current_price) / entry_price
        if loss_ratio >= STOP_LOSS_RATIO:
            logger.info(
                "触发强制止损: entry_price=%.4f, current_price=%.4f, 亏损比例=%.2f%%",
                entry_price, current_price, loss_ratio * 100,
            )
            return False
        return True

    # ------------------------------------------------------------------
    # 4. 仓位计算
    # ------------------------------------------------------------------
    def calculate_position_size(
        self,
        capital: float,
        risk_pct: float,
        entry_price: float,
        stop_price: float,
    ) -> float:
        """根据风险百分比和止损价计算合适的下单数量。

        逻辑: 本笔最大可承受亏损 = capital * risk_pct
              每单位亏损 = |entry_price - stop_price|
              下单数量 = 最大可承受亏损 / 每单位亏损

        Args:
            capital: 账户总资金
            risk_pct: 本笔风险占比（如 0.02 表示 2%）
            entry_price: 计划开仓价
            stop_price: 计划止损价

        Returns:
            计算得出的下单数量；若参数异常则返回 0。
        """
        if capital <= 0 or risk_pct <= 0 or entry_price <= 0 or stop_price <= 0:
            logger.warning("仓位计算参数异常: capital=%s, risk_pct=%s, entry=%s, stop=%s",
                           capital, risk_pct, entry_price, stop_price)
            return 0.0

        # 限制单笔风险不超过账户资金的 2%
        effective_risk = min(risk_pct, MAX_TRADE_RISK_RATIO)
        max_loss = capital * effective_risk

        per_unit_risk = abs(entry_price - stop_price)
        if per_unit_risk <= 0:
            logger.warning("开仓价与止损价相同，无法计算仓位")
            return 0.0

        size = max_loss / per_unit_risk
        logger.info(
            "仓位计算: capital=%.2f, risk=%.2f%%, 最大亏损=%.2f, 单位风险=%.4f, 数量=%.4f",
            capital, effective_risk * 100, max_loss, per_unit_risk, size,
        )
        return size
