import { useState, useEffect } from 'react';
import { backtestApi, BacktestResult } from '../api/backtest';
import { strategyApi, Strategy } from '../api/strategy';

export default function Backtest() {
  // 策略列表
  const [strategies, setStrategies] = useState<Strategy[]>([]);

  // 配置表单
  const [strategyId, setStrategyId] = useState<number | ''>('');
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setIntervalValue] = useState('1h');
  const [limit, setLimit] = useState(500);
  const [initialCapital, setInitialCapital] = useState(10000);

  // 结果状态
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);

  // 加载用户策略列表
  useEffect(() => {
    const loadStrategies = async () => {
      try {
        const response = await strategyApi.listMine();
        const list: Strategy[] = response.data?.data || [];
        setStrategies(list);
        if (list.length > 0) {
          setStrategyId(list[0].id);
        }
      } catch {
        // 静默失败，用户仍可继续配置
      }
    };
    loadStrategies();
  }, []);

  // 运行回测
  const handleRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await backtestApi.run({
        strategy_id: strategyId === '' ? undefined : Number(strategyId),
        exchange: 'binance',
        symbol,
        interval,
        limit,
        initial_capital: initialCapital,
      });
      setResult(response.data?.data ?? null);
    } catch (err: any) {
      setError(err.response?.data?.detail || '回测失败');
    } finally {
      setLoading(false);
    }
  };

  // 格式化辅助
  const formatPercent = (v?: number) => (v == null ? '-' : `${(v * 100).toFixed(2)}%`);
  const formatNumber = (v?: number, digits = 2) => (v == null ? '-' : v.toFixed(digits));

  const posNegColor = (v?: number) => {
    if (v == null) return '';
    return v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : '';
  };

  const metrics = result?.metrics;

  // 渲染收益曲线 SVG
  const renderEquityCurve = () => {
    if (!result?.equity_curve || result.equity_curve.length === 0) {
      return <p className="text-gray-400">暂无收益曲线数据</p>;
    }

    const equities: number[] = result.equity_curve.map((p: any) => Number(p.equity));
    // 把初始资金也纳入范围，保证基准线在视图内
    const max = Math.max(...equities, result.initial_capital);
    const min = Math.min(...equities, result.initial_capital);
    const range = max - min || 1;

    const width = 1000;
    const height = 300;
    const padding = 30;

    const xStep = (width - padding * 2) / Math.max(equities.length - 1, 1);

    const points = equities
      .map((eq, i) => {
        const x = padding + i * xStep;
        const y = padding + (1 - (eq - min) / range) * (height - padding * 2);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');

    const baselineY =
      padding + (1 - (result.initial_capital - min) / range) * (height - padding * 2);
    const isProfit = result.final_capital >= result.initial_capital;
    const lineColor = isProfit ? '#10b981' : '#ef4444';

    return (
      <>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: '300px' }}
        >
          {/* 基准线（初始资金水平线） */}
          <line
            x1={padding}
            y1={baselineY}
            x2={width - padding}
            y2={baselineY}
            stroke="#6b7280"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          {/* 权益曲线 */}
          <polyline points={points} fill="none" stroke={lineColor} strokeWidth="2" />
        </svg>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
          <span>初始资金: ${formatNumber(result.initial_capital)}</span>
          <span>最终资金: ${formatNumber(result.final_capital)}</span>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">策略回测</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：配置表单 */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">回测配置</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">策略</label>
                  <select
                    value={strategyId}
                    onChange={(e) => setStrategyId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  >
                    <option value="">-- 选择策略 --</option>
                    {strategies.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.strategy_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">交易对</label>
                  <select
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  >
                    <option value="BTCUSDT">BTC/USDT</option>
                    <option value="ETHUSDT">ETH/USDT</option>
                    <option value="BNBUSDT">BNB/USDT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">时间周期</label>
                  <select
                    value={interval}
                    onChange={(e) => setIntervalValue(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  >
                    <option value="5m">5分钟</option>
                    <option value="15m">15分钟</option>
                    <option value="1h">1小时</option>
                    <option value="4h">4小时</option>
                    <option value="1d">1天</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">K线数量</label>
                  <input
                    type="number"
                    min={50}
                    max={5000}
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">初始资金</label>
                  <input
                    type="number"
                    min={100}
                    value={initialCapital}
                    onChange={(e) => setInitialCapital(Number(e.target.value))}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  />
                </div>

                <button
                  onClick={handleRun}
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded px-4 py-2 font-medium transition-colors"
                >
                  {loading ? '回测中...' : '运行回测'}
                </button>
              </div>
            </div>
          </div>

          {/* 右侧：结果展示 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 错误提示 */}
            {error && (
              <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
                <p className="text-red-400">{error}</p>
              </div>
            )}

            {/* 占位提示 */}
            {!result && !error && (
              <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-400">
                请在左侧配置参数并运行回测
              </div>
            )}

            {result && (
              <>
                {/* 绩效指标 2x4 网格 */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-bold mb-4">绩效指标</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <MetricCard
                      label="总收益率"
                      value={formatPercent(metrics?.total_return)}
                      valueClass={posNegColor(metrics?.total_return)}
                    />
                    <MetricCard
                      label="年化收益率"
                      value={formatPercent(metrics?.annual_return)}
                      valueClass={posNegColor(metrics?.annual_return)}
                    />
                    <MetricCard
                      label="最大回撤"
                      value={formatPercent(metrics?.max_drawdown)}
                      valueClass="text-red-400"
                    />
                    <MetricCard
                      label="胜率"
                      value={formatPercent(metrics?.win_rate)}
                      valueClass={
                        metrics && metrics.win_rate >= 0.5 ? 'text-green-400' : 'text-red-400'
                      }
                    />
                    <MetricCard
                      label="盈亏比"
                      value={formatNumber(metrics?.profit_factor)}
                      valueClass={
                        metrics && metrics.profit_factor >= 1 ? 'text-green-400' : 'text-red-400'
                      }
                    />
                    <MetricCard
                      label="夏普比率"
                      value={formatNumber(metrics?.sharpe_ratio)}
                      valueClass={posNegColor(metrics?.sharpe_ratio)}
                    />
                    <MetricCard
                      label="总交易数"
                      value={metrics?.total_trades != null ? String(metrics.total_trades) : '-'}
                    />
                    <MetricCard
                      label="最终资金"
                      value={`$${formatNumber(result.final_capital)}`}
                      valueClass={posNegColor(result.final_capital - result.initial_capital)}
                    />
                  </div>
                </div>

                {/* 收益曲线图 */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-bold mb-4">收益曲线</h2>
                  {renderEquityCurve()}
                </div>

                {/* 交易记录表 */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-bold mb-4">交易记录</h2>
                  {result.trades && result.trades.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-gray-400 border-b border-gray-700">
                            <th className="text-left py-2 px-3">时间</th>
                            <th className="text-left py-2 px-3">方向</th>
                            <th className="text-right py-2 px-3">数量</th>
                            <th className="text-right py-2 px-3">价格</th>
                            <th className="text-right py-2 px-3">手续费</th>
                            <th className="text-right py-2 px-3">盈亏</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.trades.map((t: any, i: number) => (
                            <tr key={i} className="border-b border-gray-700">
                              <td className="py-2 px-3">{formatTradeTime(t.timestamp)}</td>
                              <td className="py-2 px-3">
                                <span
                                  className={
                                    t.action === 'buy' || t.action === 'long'
                                      ? 'text-green-400'
                                      : 'text-red-400'
                                  }
                                >
                                  {translateAction(t.action)}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right">{formatNumber(t.quantity)}</td>
                              <td className="py-2 px-3 text-right">${formatNumber(t.price)}</td>
                              <td className="py-2 px-3 text-right text-gray-400">
                                ${formatNumber(t.commission)}
                              </td>
                              <td
                                className={`py-2 px-3 text-right ${
                                  t.pnl > 0 ? 'text-green-400' : t.pnl < 0 ? 'text-red-400' : ''
                                }`}
                              >
                                ${formatNumber(t.pnl)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-400">暂无交易记录</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 绩效指标卡片
function MetricCard({
  label,
  value,
  valueClass = '',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-gray-700 rounded-lg p-4">
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className={`text-lg font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

// 翻译交易动作
function translateAction(action: string): string {
  const map: Record<string, string> = {
    buy: '买入',
    sell: '卖出',
    long: '做多',
    short: '做空',
    close_long: '平多',
    close_short: '平空',
  };
  return map[action] || action || '-';
}

// 格式化交易时间
function formatTradeTime(t: any): string {
  if (t == null || t === '') return '-';
  if (typeof t === 'number') {
    const ms = t > 1e12 ? t : t * 1000;
    const d = new Date(ms);
    if (isNaN(d.getTime())) return String(t);
    return d.toLocaleString('zh-CN', { hour12: false });
  }
  return String(t);
}
