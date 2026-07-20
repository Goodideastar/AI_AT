from typing import List, Dict, Optional
import numpy as np


def calculate_metrics(
    equity_curve: List[Dict],
    trades: List[Dict],
    interval_seconds: Optional[int] = None
) -> Dict:
    """
    计算绩效指标。

    interval_seconds: 单根 K 线的秒数，用于推算年化。
        1m=60, 5m=300, 15m=900, 1h=3600, 4h=14400, 1d=86400。
        若为 None，按 1h(3600) 估算。
    """
    if not equity_curve:
        return {}

    equities = [e["equity"] for e in equity_curve]
    initial = equities[0]
    final = equities[-1]

    # 总收益率
    total_return = (final - initial) / initial if initial != 0 else 0.0

    # 最大回撤
    peak = equities[0]
    max_drawdown = 0.0
    for equity in equities:
        if equity > peak:
            peak = equity
        if peak > 0:
            drawdown = (peak - equity) / peak
            if drawdown > max_drawdown:
                max_drawdown = drawdown

    # 交易统计（profit_factor 使用总额而非平均值，符合标准定义）
    winning_trades = [t for t in trades if t.get("pnl", 0) > 0]
    losing_trades = [t for t in trades if t.get("pnl", 0) < 0]

    win_rate = len(winning_trades) / len(trades) if trades else 0.0

    gross_profit = sum(t["pnl"] for t in winning_trades)
    gross_loss = abs(sum(t["pnl"] for t in losing_trades))
    # profit_factor = gross_profit / gross_loss，标准定义
    profit_factor = (gross_profit / gross_loss) if gross_loss > 0 else (
        float("inf") if gross_profit > 0 else 0.0
    )

    # 年化收益率：基于 K 线周期推算年化天数
    if interval_seconds is None:
        interval_seconds = 3600  # 默认按 1h K 线
    seconds_per_year = 365 * 24 * 3600  # 加密货币 7×24 全年交易
    bars_per_year = seconds_per_year / interval_seconds if interval_seconds > 0 else 0
    n_bars = len(equity_curve)
    years = n_bars / bars_per_year if bars_per_year > 0 else 0

    if years > 0 and total_return > -1:
        annual_return = (1 + total_return) ** (1 / years) - 1
    else:
        annual_return = 0.0

    # 夏普比率：按每根 K 线收益率计算，年化使用 bars_per_year
    returns = []
    for i in range(1, len(equities)):
        prev = equities[i - 1]
        if prev != 0:
            returns.append((equities[i] - prev) / prev)

    if len(returns) >= 2:
        std = np.std(returns, ddof=1)  # 样本标准差
        if std > 0:
            sharpe = (np.mean(returns) / std) * np.sqrt(bars_per_year) if bars_per_year > 0 else 0.0
        else:
            sharpe = 0.0
    else:
        sharpe = 0.0

    return {
        "total_return": total_return,
        "annual_return": annual_return,
        "max_drawdown": max_drawdown,
        "win_rate": win_rate,
        "profit_factor": profit_factor,
        "sharpe_ratio": sharpe,
        "total_trades": len(trades),
        "winning_trades": len(winning_trades),
        "losing_trades": len(losing_trades)
    }
