# backend/service/strategy/intraday.py
"""
日内短线交易策略

使用 15 分钟 K 线，结合 EMA(20)、RSI(14)、MACD 指标产生交易信号。
入场条件：EMA 金叉 + RSI < 70 + MACD 柱状图转正
出场条件：EMA 死叉 或 RSI > 80 或达到止损/止盈
"""

import logging
from typing import Dict, List, Optional
from collections import deque

from service.strategy.base import StrategyBase

logger = logging.getLogger(__name__)


class IntradayStrategy(StrategyBase):
    """日内短线交易策略"""

    # 默认参数
    DEFAULT_PARAMS = {
        "ema_period": 20,        # EMA 周期
        "rsi_period": 14,        # RSI 周期
        "stop_loss_pct": 0.02,   # 止损比例 2%
        "take_profit_pct": 0.04, # 止盈比例 4%
        "macd_fast": 12,         # MACD 快线周期
        "macd_slow": 26,         # MACD 慢线周期
        "macd_signal": 9,        # MACD 信号线周期
    }

    def __init__(self, parameters: Optional[Dict] = None):
        # 合并默认参数与用户传入参数
        merged = dict(self.DEFAULT_PARAMS)
        if parameters:
            merged.update(parameters)
        super().__init__(merged)

        # K 线历史（收盘价），用于计算指标
        self._closes: deque = deque(maxlen=200)
        # 前一根 bar 的 EMA，用于判断金叉/死叉
        self._prev_ema: Optional[float] = None
        # 前一根 bar 的 MACD 柱状图值，用于判断转正/转负
        self._prev_hist: Optional[float] = None
        # 持仓入场价，用于止损/止盈判断；None 表示当前无持仓
        self._entry_price: Optional[float] = None

    # --------------------------------------------------------------------- #
    # 生命周期回调
    # --------------------------------------------------------------------- #
    def on_init(self):
        """策略初始化：清空历史状态"""
        logger.info("日内短线策略初始化，参数：%s", self.parameters)
        self._closes.clear()
        self._prev_ema = None
        self._prev_hist = None
        self._entry_price = None

    def on_bar(self, bar: Dict) -> Optional[Dict]:
        """
        K 线更新回调，返回交易信号或 None

        Args:
            bar: {"open", "high", "low", "close", "volume", "timestamp"}

        Returns:
            {"action": "buy"/"sell", "quantity": float, "price": float}
            或 None（无信号）
        """
        close = float(bar["close"])
        self._closes.append(close)

        # 历史数据不足，无法计算指标，等待更多 bar
        min_len = max(
            self.parameters["ema_period"],
            self.parameters["rsi_period"],
            self.parameters["macd_slow"] + self.parameters["macd_signal"],
        )
        if len(self._closes) < min_len:
            return None

        # 计算指标
        ema = self._calc_ema(self.parameters["ema_period"])
        rsi = self._calc_rsi(self.parameters["rsi_period"])
        macd_line, signal_line, hist = self._calc_macd()

        # 判断信号
        signal = None

        # --- 出场逻辑优先 ---
        if self._entry_price is not None:
            exit_reason = None
            # 止损
            if close <= self._entry_price * (1 - self.parameters["stop_loss_pct"]):
                exit_reason = "止损"
            # 止盈
            elif close >= self._entry_price * (1 + self.parameters["take_profit_pct"]):
                exit_reason = "止盈"
            # RSI > 80 超买出场
            elif rsi is not None and rsi > 80:
                exit_reason = "RSI超买"
            # EMA 死叉（当前 EMA < 前一根 EMA，且前一根 EMA 存在）
            elif self._prev_ema is not None and close < self._prev_ema and ema < self._prev_ema:
                # 简化判断：收盘价跌破 EMA 且 EMA 拐头向下视为死叉信号
                exit_reason = "EMA死叉"

            if exit_reason:
                logger.info(
                    "出场信号 [%s]，入场价=%.4f，当前价=%.4f，RSI=%.2f",
                    exit_reason, self._entry_price, close, rsi or 0,
                )
                signal = {"action": "sell", "quantity": 1.0, "price": close}
                self._entry_price = None

        # --- 入场逻辑 ---
        if self._entry_price is None and signal is None:
            # EMA 金叉：收盘价上穿 EMA（当前收盘 > EMA 且前一根收盘 <= 前一根 EMA）
            ema_cross_up = (
                self._prev_ema is not None
                and close > ema
                # 前一根 bar 的收盘价用 deque 中倒数第二个值近似
                and self._closes[-2] <= self._prev_ema
            )
            rsi_ok = rsi is not None and rsi < 70
            hist_turn_positive = (
                self._prev_hist is not None
                and self._prev_hist <= 0
                and hist > 0
            )

            if ema_cross_up and rsi_ok and hist_turn_positive:
                logger.info(
                    "入场信号，当前价=%.4f，EMA=%.4f，RSI=%.2f，MACD柱=%.4f",
                    close, ema, rsi or 0, hist,
                )
                signal = {"action": "buy", "quantity": 1.0, "price": close}
                self._entry_price = close

        # 更新前值，供下一根 bar 使用
        self._prev_ema = ema
        self._prev_hist = hist

        return signal

    def on_trade(self, trade: Dict):
        """成交回调：记录成交信息"""
        logger.info("成交回报：%s", trade)

    # --------------------------------------------------------------------- #
    # 指标计算
    # --------------------------------------------------------------------- #
    def _calc_ema(self, period: int) -> float:
        """计算 EMA（指数移动平均），使用 _closes 中最近 period 根之后的全部数据递推"""
        k = 2.0 / (period + 1)
        data = list(self._closes)
        # 用第一根作为初始 EMA
        ema = data[0]
        for price in data[1:]:
            ema = price * k + ema * (1 - k)
        return ema

    def _calc_rsi(self, period: int) -> Optional[float]:
        """计算 RSI（相对强弱指标）"""
        data = list(self._closes)
        if len(data) < period + 1:
            return None
        gains = 0.0
        losses = 0.0
        # 使用 Wilder 平滑：先取前 period 个变化的简单平均，再递推
        for i in range(1, period + 1):
            delta = data[i] - data[i - 1]
            if delta >= 0:
                gains += delta
            else:
                losses -= delta
        avg_gain = gains / period
        avg_loss = losses / period
        # 继续用后续数据平滑（如果有）
        for i in range(period + 1, len(data)):
            delta = data[i] - data[i - 1]
            if delta >= 0:
                avg_gain = (avg_gain * (period - 1) + delta) / period
                avg_loss = (avg_loss * (period - 1)) / period
            else:
                avg_gain = (avg_gain * (period - 1)) / period
                avg_loss = (avg_loss * (period - 1) - delta) / period
        if avg_loss == 0:
            return 100.0
        rs = avg_gain / avg_loss
        return 100.0 - 100.0 / (1.0 + rs)

    def _calc_macd(self):
        """
        计算 MACD
        返回：(macd_line, signal_line, histogram)
        """
        fast = self.parameters["macd_fast"]
        slow = self.parameters["macd_slow"]
        sig = self.parameters["macd_signal"]
        data = list(self._closes)

        # 计算快慢 EMA 序列
        ema_fast = self._ema_series(data, fast)
        ema_slow = self._ema_series(data, slow)
        # MACD 线 = 快 EMA - 慢 EMA
        macd_line_series = [f - s for f, s in zip(ema_fast, ema_slow)]
        # 信号线 = MACD 线的 EMA
        signal_series = self._ema_series(macd_line_series, sig)
        macd_line = macd_line_series[-1]
        signal_line = signal_series[-1]
        histogram = macd_line - signal_line
        return macd_line, signal_line, histogram

    @staticmethod
    def _ema_series(data: List[float], period: int) -> List[float]:
        """返回与 data 等长的 EMA 序列，前 period-1 个值用简单递推"""
        if not data:
            return []
        k = 2.0 / (period + 1)
        result = [data[0]]
        for price in data[1:]:
            result.append(price * k + result[-1] * (1 - k))
        return result
