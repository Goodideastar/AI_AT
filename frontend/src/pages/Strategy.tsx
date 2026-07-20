import { useState, useEffect } from 'react';
import { strategyApi } from '../api/strategy';
import type { Strategy as StrategyData } from '../api/strategy';

export default function Strategy() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strategies, setStrategies] = useState<StrategyData[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [strategyTypes, setStrategyTypes] = useState<string[]>([]);

  // 创建表单状态
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    strategy_type: '',
    exchange: 'binance',
    symbols: '',
    parameters: '{}',
  });
  const [submitting, setSubmitting] = useState(false);

  // 加载策略列表
  const loadStrategies = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await strategyApi.listMine();
      setStrategies(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || '加载策略列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载策略类型
  const loadStrategyTypes = async () => {
    try {
      const response = await strategyApi.listTypes();
      setStrategyTypes(response.data.data);
    } catch (err: any) {
      // 策略类型加载失败不阻塞主流程
      console.error('加载策略类型失败', err);
    }
  };

  useEffect(() => {
    loadStrategies();
    loadStrategyTypes();
  }, []);

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      strategy_type: '',
      exchange: 'binance',
      symbols: '',
      parameters: '{}',
    });
  };

  // 创建策略
  const handleCreate = async () => {
    if (!formData.name.trim()) {
      setError('请输入策略名称');
      return;
    }
    if (!formData.strategy_type) {
      setError('请选择策略类型');
      return;
    }

    let paramsObj: Record<string, any> = {};
    try {
      paramsObj = JSON.parse(formData.parameters || '{}');
    } catch {
      setError('参数 JSON 格式错误');
      return;
    }

    const symbolsArr = formData.symbols
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (symbolsArr.length === 0) {
      setError('请输入至少一个交易对');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await strategyApi.create({
        name: formData.name.trim(),
        description: formData.description.trim(),
        strategy_type: formData.strategy_type,
        exchange: formData.exchange,
        symbols: symbolsArr,
        parameters: paramsObj,
      });
      setShowCreateForm(false);
      resetForm();
      await loadStrategies();
    } catch (err: any) {
      setError(err.response?.data?.detail || '创建策略失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 启停策略
  const handleToggle = async (id: number) => {
    try {
      const response = await strategyApi.toggle(id);
      const newActive: boolean = response.data.data.is_active;
      setStrategies((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_active: newActive } : s))
      );
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.detail || '操作失败');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* 顶部标题与操作 */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">策略管理</h1>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-600 hover:bg-blue-700 rounded px-4 py-2 font-medium transition-colors"
          >
            {showCreateForm ? '取消' : '创建策略'}
          </button>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* 创建表单 */}
        {showCreateForm && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">创建新策略</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-2">策略名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  placeholder="例如：MA交叉做多"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">策略类型</label>
                <select
                  value={formData.strategy_type}
                  onChange={(e) => setFormData({ ...formData, strategy_type: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                >
                  <option value="">请选择</option>
                  {strategyTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">交易所</label>
                <select
                  value={formData.exchange}
                  onChange={(e) => setFormData({ ...formData, exchange: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                >
                  <option value="binance">Binance</option>
                  <option value="okx">OKX</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">交易对（逗号分隔）</label>
                <input
                  type="text"
                  value={formData.symbols}
                  onChange={(e) => setFormData({ ...formData, symbols: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                  placeholder="BTCUSDT,ETHUSDT"
                />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">描述</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                rows={2}
                placeholder="策略说明（可选）"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">参数（JSON）</label>
              <textarea
                value={formData.parameters}
                onChange={(e) => setFormData({ ...formData, parameters: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 font-mono"
                rows={6}
                placeholder='{"fast": 5, "slow": 20}'
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  resetForm();
                  setError(null);
                }}
                className="bg-gray-600 hover:bg-gray-700 rounded px-4 py-2 font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded px-4 py-2 font-medium transition-colors"
              >
                {submitting ? '创建中...' : '提交'}
              </button>
            </div>
          </div>
        )}

        {/* 加载中 */}
        {loading && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6 text-center text-gray-400">
            加载中...
          </div>
        )}

        {/* 空状态 */}
        {!loading && strategies.length === 0 && (
          <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-400">
            暂无策略，点击"创建策略"开始
          </div>
        )}

        {/* 策略列表卡片网格 */}
        {!loading && strategies.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {strategies.map((s) => (
              <div key={s.id} className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-bold truncate">{s.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
                    s.is_active ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'
                  }`}>
                    {s.is_active ? '运行中' : '已停止'}
                  </span>
                </div>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex justify-between">
                    <span className="text-gray-400">类型</span>
                    <span>{s.strategy_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">交易所</span>
                    <span>{s.exchange}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">交易对</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {s.symbols?.map((sym) => (
                        <span key={sym} className="text-xs bg-gray-700 px-2 py-0.5 rounded">
                          {sym}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">创建时间</span>
                    <span>{new Date(s.created_at).toLocaleString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(s.id)}
                  className={`w-full mt-4 rounded px-4 py-2 font-medium transition-colors ${
                    s.is_active
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {s.is_active ? '停止' : '启动'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
