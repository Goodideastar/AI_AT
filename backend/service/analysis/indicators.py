# backend/service/analysis/indicators.py
"""
常用技术指标计算模块

提供金融技术分析中常用的指标计算函数，支持 pandas DataFrame 输入。
所有函数返回 pandas Series 或 DataFrame，便于与原始数据合并。
"""

import numpy as np
import pandas as pd
from typing import Union


def sma(series: pd.Series, period: int) -> pd.Series:
    """
    简单移动平均线 (Simple Moving Average)

    计算给定周期内价格的算术平均值。

    参数:
        series: 价格序列（通常是收盘价）
        period: 计算周期

    返回:
        SMA 序列，前 period-1 个值为 NaN
    """
    if period < 1:
        raise ValueError("周期必须大于等于 1")
    return series.rolling(window=period, min_periods=period).mean()


def ema(series: pd.Series, period: int) -> pd.Series:
    """
    指数移动平均线 (Exponential Moving Average)

    对近期价格赋予更高权重的移动平均，比 SMA 对价格变化更敏感。

    参数:
        series: 价格序列（通常是收盘价）
        period: 计算周期

    返回:
        EMA 序列
    """
    if period < 1:
        raise ValueError("周期必须大于等于 1")
    return series.ewm(span=period, adjust=False).mean()


def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    """
    相对强弱指标 (Relative Strength Index)

    衡量价格变动的速度和幅度，用于判断超买或超卖状态。
    RSI > 70 通常视为超买，RSI < 30 通常视为超卖。

    参数:
        series: 价格序列（通常是收盘价）
        period: 计算周期，默认 14

    返回:
        RSI 序列，值域 [0, 100]
    """
    if period < 1:
        raise ValueError("周期必须大于等于 1")

    # 计算价格变化
    delta = series.diff()

    # 分离涨跌
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)

    # 使用 EMA 计算平均涨幅和平均跌幅（Wilder's smoothing method）
    avg_gain = gain.ewm(alpha=1/period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1/period, min_periods=period, adjust=False).mean()

    # 计算相对强度
    rs = avg_gain / avg_loss

    # 计算 RSI
    rsi_values = 100 - (100 / (1 + rs))

    return rsi_values


def macd(
    series: pd.Series,
    fast_period: int = 12,
    slow_period: int = 26,
    signal_period: int = 9
) -> pd.DataFrame:
    """
    移动平均收敛散度 (Moving Average Convergence Divergence)

    由快线（MACD线）、慢线（信号线）和柱状图组成，用于判断趋势和买卖信号。

    参数:
        series: 价格序列（通常是收盘价）
        fast_period: 快线 EMA 周期，默认 12
        slow_period: 慢线 EMA 周期，默认 26
        signal_period: 信号线 EMA 周期，默认 9

    返回:
        DataFrame 包含三列：
        - 'macd': MACD 线（快线 EMA - 慢线 EMA）
        - 'signal': 信号线（MACD 的 EMA）
        - 'histogram': 柱状图（MACD - 信号线）
    """
    if fast_period >= slow_period:
        raise ValueError("快线周期必须小于慢线周期")

    # 计算快慢 EMA
    fast_ema = ema(series, fast_period)
    slow_ema = ema(series, slow_period)

    # MACD 线
    macd_line = fast_ema - slow_ema

    # 信号线
    signal_line = ema(macd_line, signal_period)

    # 柱状图
    histogram = macd_line - signal_line

    return pd.DataFrame({
        'macd': macd_line,
        'signal': signal_line,
        'histogram': histogram
    }, index=series.index)


def bollinger_bands(
    series: pd.Series,
    period: int = 20,
    num_std: float = 2.0
) -> pd.DataFrame:
    """
    布林带 (Bollinger Bands)

    由中轨（SMA）、上轨（中轨 + N倍标准差）和下轨（中轨 - N倍标准差）组成，
    用于衡量价格波动性和判断超买超卖。

    参数:
        series: 价格序列（通常是收盘价）
        period: 中轨 SMA 周期，默认 20
        num_std: 标准差倍数，默认 2.0

    返回:
        DataFrame 包含三列：
        - 'middle': 中轨（SMA）
        - 'upper': 上轨
        - 'lower': 下轨
    """
    if period < 1:
        raise ValueError("周期必须大于等于 1")
    if num_std <= 0:
        raise ValueError("标准差倍数必须大于 0")

    # 中轨
    middle = sma(series, period)

    # 标准差
    std = series.rolling(window=period, min_periods=period).std()

    # 上下轨
    upper = middle + num_std * std
    lower = middle - num_std * std

    return pd.DataFrame({
        'middle': middle,
        'upper': upper,
        'lower': lower
    }, index=series.index)


def atr(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = 14
) -> pd.Series:
    """
    平均真实范围 (Average True Range)

    衡量市场波动性的指标，考虑了跳空缺口的影响。
    真实范围 (TR) = max(最高价-最低价, |最高价-昨收|, |最低价-昨收|)

    参数:
        high: 最高价序列
        low: 最低价序列
        close: 收盘价序列
        period: 计算周期，默认 14

    返回:
        ATR 序列
    """
    if period < 1:
        raise ValueError("周期必须大于等于 1")

    # 计算前一日的收盘价
    prev_close = close.shift(1)

    # 计算真实范围的三个组成部分
    tr1 = high - low                      # 当日最高价 - 当日最低价
    tr2 = (high - prev_close).abs()       # |当日最高价 - 昨日收盘价|
    tr3 = (low - prev_close).abs()        # |当日最低价 - 昨日收盘价|

    # 真实范围取三者最大值
    true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)

    # 使用 EMA 计算平均真实范围（Wilder's smoothing method）
    atr_values = true_range.ewm(alpha=1/period, min_periods=period, adjust=False).mean()

    return atr_values


def add_all_indicators(
    df: pd.DataFrame,
    close_col: str = 'close',
    high_col: str = 'high',
    low_col: str = 'low'
) -> pd.DataFrame:
    """
    为 DataFrame 添加所有常用技术指标

    便捷函数，一次性计算并添加所有指标到 DataFrame。

    参数:
        df: 包含 OHLC 数据的 DataFrame
        close_col: 收盘价列名，默认 'close'
        high_col: 最高价列名，默认 'high'
        low_col: 最低价列名，默认 'low'

    返回:
        添加了所有指标列的新 DataFrame
    """
    result = df.copy()

    close = result[close_col]
    high = result[high_col]
    low = result[low_col]

    # 移动平均线
    result['sma_20'] = sma(close, 20)
    result['sma_50'] = sma(close, 50)
    result['ema_12'] = ema(close, 12)
    result['ema_26'] = ema(close, 26)

    # RSI
    result['rsi_14'] = rsi(close, 14)

    # MACD
    macd_df = macd(close)
    result['macd'] = macd_df['macd']
    result['macd_signal'] = macd_df['signal']
    result['macd_hist'] = macd_df['histogram']

    # 布林带
    bb_df = bollinger_bands(close)
    result['bb_middle'] = bb_df['middle']
    result['bb_upper'] = bb_df['upper']
    result['bb_lower'] = bb_df['lower']

    # ATR
    result['atr_14'] = atr(high, low, close, 14)

    return result
