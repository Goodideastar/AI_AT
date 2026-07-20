import { useState } from 'react';
import { aiApi, AISignal } from '../api/ai';

export default function AIAnalysis() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [interval, setIntervalValue] = useState('15m');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<AISignal | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await aiApi.analyze({
        symbol,
        exchange: 'binance',
        interval,
        limit: 100,
      });
      setAnalysis(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || '分析失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">AI 智能分析</h1>

        {/* 分析控制面板 */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded px-4 py-2 font-medium transition-colors"
              >
                {loading ? '分析中...' : '开始分析'}
              </button>
            </div>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* 分析结果 */}
        {analysis && (
          <div className="space-y-6">
            {/* 市场概况 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">市场概况</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-400">趋势</p>
                  <p className={`text-lg font-bold ${
                    analysis.analysis.trend === '上涨' ? 'text-green-400' :
                    analysis.analysis.trend === '下跌' ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {analysis.analysis.trend}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">趋势强度</p>
                  <p className="text-lg font-bold text-blue-400">
                    {analysis.analysis.trend_strength || '中'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">支撑位</p>
                  <p className="text-lg font-bold">
                    {analysis.analysis.support_levels?.[0]?.toFixed(2) || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">阻力位</p>
                  <p className="text-lg font-bold">
                    {analysis.analysis.resistance_levels?.[0]?.toFixed(2) || '-'}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-400 mb-2">关键观察</p>
                <p className="text-gray-300">{analysis.analysis.key_observations || '暂无'}</p>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-400 mb-2">AI 分析理由</p>
                <p className="text-gray-300">{analysis.analysis.reason || '暂无'}</p>
              </div>
            </div>

            {/* 交易信号 */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">交易信号</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-sm text-gray-400">方向</p>
                  <p className={`text-lg font-bold ${
                    analysis.signal.direction === 'long' ? 'text-green-400' :
                    analysis.signal.direction === 'short' ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {analysis.signal.direction === 'long' ? '做多' :
                     analysis.signal.direction === 'short' ? '做空' : '观望'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">入场价</p>
                  <p className="text-lg font-bold">${analysis.signal.entry_price?.toFixed(2) || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">止损价</p>
                  <p className="text-lg font-bold text-red-400">
                    ${analysis.signal.stop_loss?.toFixed(2) || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">目标价</p>
                  <p className="text-lg font-bold text-green-400">
                    ${analysis.signal.target_price?.toFixed(2) || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">风险收益比</p>
                  <p className="text-lg font-bold text-blue-400">
                    {(() => {
                      const entry = analysis.signal.entry_price || 0;
                      const stop = analysis.signal.stop_loss || 0;
                      const target = analysis.signal.target_price || 0;
                      if (entry && stop && target) {
                        const risk = Math.abs(entry - stop);
                        const reward = Math.abs(target - entry);
                        const ratio = risk > 0 ? reward / risk : 0;
                        return `1:${ratio.toFixed(2)}`;
                      }
                      return '-';
                    })()}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm text-gray-400 mb-2">信号理由</p>
                <p className="text-gray-300">{analysis.signal.reason || '暂无'}</p>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm text-gray-400 mb-1">信号信心度</p>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{ width: `${analysis.signal.confidence * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {(analysis.signal.confidence * 100).toFixed(1)}%
                  </p>
                </div>
                <button className="bg-green-600 hover:bg-green-700 rounded px-6 py-2 font-medium transition-colors">
                  执行交易
                </button>
              </div>
            </div>

            {/* 风险提示 */}
            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
              <p className="text-yellow-400 text-sm">
                ⚠️ AI 分析仅供参考，交易有风险，请谨慎决策。建议设置合理的止损位，控制仓位风险。
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
