from typing import List, Dict
import numpy as np


def calculate_metrics(equity_curve: List[Dict], trades: List[Dict]) -> Dict:
    """计算绩效指标"""
    if not equity_curve:
        return {}

    equities = [e["equity"] for e in equity_curve]
    initial = equities[0]
    final = equities[-1]

    # 总收益率
    total_return = (final - initial) / initial

    # 最大回撤
    peak = equities[0]
    max_drawdown = 0
    for equity in equities:
        if equity > peak:
            peak = equity
        drawdown = (peak - equity) / peak
        if drawdown > max_drawdown:
            max_drawdown = drawdown

    # 交易统计
    winning_trades = [t for t in trades if t["pnl"] > 0]
    losing_trades = [t for t in trades if t["pnl"] < 0]

    win_rate = len(winning_trades) / len(trades) if trades else 0

    avg_win = sum(t["pnl"] for t in winning_trades) / len(winning_trades) if winning_trades else 0
    avg_loss = sum(t["pnl"] for t in losing_trades) / len(losing_trades) if losing_trades else 0

    profit_factor = abs(avg_win / avg_loss) if avg_loss != 0 else 0

    # 年化收益率（假设365天）
    days = len(equity_curve) / 24  # 假设小时K线
    annual_return = (1 + total_return) ** (365 / days) - 1 if days > 0 else 0

    # 夏普比率（简化版）
    returns = []
    for i in range(1, len(equities)):
        ret = (equities[i] - equities[i - 1]) / equities[i - 1]
        returns.append(ret)

    if returns:
        sharpe = np.mean(returns) / np.std(returns) * np.sqrt(252) if np.std(returns) != 0 else 0
    else:
        sharpe = 0

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
