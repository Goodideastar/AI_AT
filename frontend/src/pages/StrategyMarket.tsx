import { useState, useEffect, useCallback } from 'react';
import { strategyMarketApi, StrategyShare } from '../api/strategyMarket';
import { strategyApi, Strategy } from '../api/strategy';

type TabKey = 'market' | 'subscriptions' | 'shares';

// 市场列表项：后端列表接口额外返回 is_owner，但不返回 is_subscribed
interface MarketShareItem {
  id: number;
  user_id: number;
  strategy_id: number;
  title: string;
  description?: string;
  subscribe_count: number;
  rating: number;
  created_at: string;
  is_owner: boolean;
  // 列表接口不返回，本地维护订阅状态
  is_subscribed?: boolean;
}

// 我的订阅列表项（后端实际返回结构）
interface MySubscriptionItem {
  subscription_id: number;
  share_id: number;
  strategy_id: number;
  title: string;
  description?: string;
  subscribe_count: number;
  rating: number;
  subscribed_at: string;
}

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', { hour12: false });
}

function renderStars(rating: number) {
  const rounded = Math.max(0, Math.min(5, Math.round(rating || 0)));
  return (
    <span className="text-yellow-400">
      {'★'.repeat(rounded)}
      <span className="text-gray-600">{'★'.repeat(5 - rounded)}</span>
    </span>
  );
}

export default function StrategyMarket() {
  const [activeTab, setActiveTab] = useState<TabKey>('market');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [shares, setShares] = useState<MarketShareItem[]>([]);
  const [mySubscriptions, setMySubscriptions] = useState<MySubscriptionItem[]>([]);
  const [myShares, setMyShares] = useState<StrategyShare[]>([]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // 发布策略弹窗
  const [showPublishForm, setShowPublishForm] = useState(false);
  const [myStrategies, setMyStrategies] = useState<Strategy[]>([]);
  const [publishStrategyId, setPublishStrategyId] = useState<number | ''>('');
  const [publishTitle, setPublishTitle] = useState('');
  const [publishDescription, setPublishDescription] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const loadMarket = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await strategyMarketApi.listShares(p, PAGE_SIZE);
      const data = res.data?.data || {};
      const list: MarketShareItem[] = data.list || [];
      // 列表接口不返回 is_subscribed，本地初始化为 false
      list.forEach((item) => {
        if (item.is_subscribed === undefined) item.is_subscribed = false;
      });
      setShares(list);
      setTotalPages(Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE)));
      setPage(p);
    } catch (err: any) {
      setError(err.response?.data?.detail || '加载市场列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMySubscriptions = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await strategyMarketApi.mySubscriptions(p, PAGE_SIZE);
      const data = res.data?.data || {};
      setMySubscriptions(data.list || []);
      setTotalPages(Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE)));
      setPage(p);
    } catch (err: any) {
      setError(err.response?.data?.detail || '加载订阅列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMyShares = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await strategyMarketApi.myShares(p, PAGE_SIZE);
      const data = res.data?.data || {};
      setMyShares(data.list || []);
      setTotalPages(Math.max(1, Math.ceil((data.total || 0) / PAGE_SIZE)));
      setPage(p);
    } catch (err: any) {
      setError(err.response?.data?.detail || '加载我的分享失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 切换 Tab 时加载第一页
  useEffect(() => {
    if (activeTab === 'market') loadMarket(1);
    else if (activeTab === 'subscriptions') loadMySubscriptions(1);
    else loadMyShares(1);
  }, [activeTab, loadMarket, loadMySubscriptions, loadMyShares]);

  const loadCurrentTab = (p: number) => {
    if (activeTab === 'market') return loadMarket(p);
    if (activeTab === 'subscriptions') return loadMySubscriptions(p);
    return loadMyShares(p);
  };

  const handleSubscribe = async (shareId: number) => {
    try {
      await strategyMarketApi.subscribe(shareId);
      setShares((prev) =>
        prev.map((s) =>
          s.id === shareId
            ? { ...s, is_subscribed: true, subscribe_count: (s.subscribe_count || 0) + 1 }
            : s
        )
      );
    } catch (err: any) {
      setError(err.response?.data?.detail || '订阅失败');
    }
  };

  const handleUnsubscribe = async (shareId: number) => {
    try {
      await strategyMarketApi.unsubscribe(shareId);
      setShares((prev) =>
        prev.map((s) =>
          s.id === shareId
            ? { ...s, is_subscribed: false, subscribe_count: Math.max(0, (s.subscribe_count || 0) - 1) }
            : s
        )
      );
    } catch (err: any) {
      setError(err.response?.data?.detail || '取消订阅失败');
    }
  };

  const handleUnsubscribeFromList = async (shareId: number) => {
    try {
      await strategyMarketApi.unsubscribe(shareId);
      setMySubscriptions((prev) => prev.filter((s) => s.share_id !== shareId));
    } catch (err: any) {
      setError(err.response?.data?.detail || '取消订阅失败');
    }
  };

  const openPublishForm = async () => {
    setShowPublishForm(true);
    setPublishError(null);
    setPublishStrategyId('');
    setPublishTitle('');
    setPublishDescription('');
    try {
      const res = await strategyApi.listMine();
      // /strategies/my 返回 { code, data: [...] }，data 直接是数组
      const data = res.data?.data;
      const list: Strategy[] = Array.isArray(data) ? data : [];
      setMyStrategies(list);
    } catch (err: any) {
      setPublishError(err.response?.data?.detail || '加载策略列表失败');
    }
  };

  const handlePublish = async () => {
    if (!publishStrategyId || !publishTitle.trim()) {
      setPublishError('请选择策略并填写标题');
      return;
    }
    setPublishing(true);
    setPublishError(null);
    try {
      await strategyMarketApi.createShare({
        strategy_id: Number(publishStrategyId),
        title: publishTitle.trim(),
        description: publishDescription.trim() || undefined,
      });
      setShowPublishForm(false);
      // 发布后切到"我分享的"并刷新
      setActiveTab('shares');
    } catch (err: any) {
      setPublishError(err.response?.data?.detail || '发布失败');
    } finally {
      setPublishing(false);
    }
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'market', label: '市场浏览' },
    { key: 'subscriptions', label: '我的订阅' },
    { key: 'shares', label: '我分享的' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">策略市场</h1>

        {/* Tab 导航 */}
        <div className="flex gap-4 border-b border-gray-700 mb-6">
          {tabs.map((tab) => (
            <div
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={
                activeTab === tab.key
                  ? 'text-blue-400 border-b-2 border-blue-400 pb-2 cursor-pointer'
                  : 'text-gray-400 pb-2 cursor-pointer hover:text-white'
              }
            >
              {tab.label}
            </div>
          ))}
          {/* 发布按钮：仅在"我分享的"Tab 下显示 */}
          {activeTab === 'shares' && (
            <button
              onClick={openPublishForm}
              className="ml-auto bg-blue-600 hover:bg-blue-700 rounded px-4 py-2 text-sm font-medium transition-colors"
            >
              + 发布策略
            </button>
          )}
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* 加载提示 */}
        {loading && (
          <div className="text-gray-400 text-center py-8">加载中...</div>
        )}

        {/* 内容区 */}
        {!loading && (
          <>
            {activeTab === 'market' && (
              <div className="space-y-4">
                {shares.length === 0 ? (
                  <div className="text-gray-400 text-center py-8">暂无公开策略</div>
                ) : (
                  shares.map((share) => (
                    <ShareCard
                      key={share.id}
                      share={share}
                      showSubscribe
                      onSubscribe={handleSubscribe}
                      onUnsubscribe={handleUnsubscribe}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === 'subscriptions' && (
              <div className="space-y-4">
                {mySubscriptions.length === 0 ? (
                  <div className="text-gray-400 text-center py-8">暂无订阅</div>
                ) : (
                  mySubscriptions.map((sub) => (
                    <div key={sub.subscription_id} className="bg-gray-800 rounded-lg p-6">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-bold">{sub.title}</h3>
                        <button
                          onClick={() => handleUnsubscribeFromList(sub.share_id)}
                          className="bg-gray-600 hover:bg-gray-700 rounded px-4 py-2 text-sm font-medium transition-colors"
                        >
                          取消订阅
                        </button>
                      </div>
                      {sub.description && (
                        <p className="text-gray-300 mb-4">{sub.description}</p>
                      )}
                      <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                        <span>订阅数：{sub.subscribe_count}</span>
                        <span>评分：{renderStars(sub.rating)}</span>
                        <span>订阅于：{formatDate(sub.subscribed_at)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'shares' && (
              <div className="space-y-4">
                {myShares.length === 0 ? (
                  <div className="text-gray-400 text-center py-8">
                    暂未分享任何策略，点击右上角"发布策略"
                  </div>
                ) : (
                  myShares.map((share) => (
                    <ShareCard key={share.id} share={share} showSubscribe={false} />
                  ))
                )}
              </div>
            )}

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-6">
                <button
                  onClick={() => loadCurrentTab(page - 1)}
                  disabled={page <= 1}
                  className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded px-4 py-2 text-sm transition-colors"
                >
                  上一页
                </button>
                <span className="text-gray-400 text-sm">
                  第 {page} / {totalPages} 页
                </span>
                <button
                  onClick={() => loadCurrentTab(page + 1)}
                  disabled={page >= totalPages}
                  className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 rounded px-4 py-2 text-sm transition-colors"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 发布策略弹窗 */}
      {showPublishForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">发布策略</h2>

            {publishError && (
              <div className="bg-red-900/50 border border-red-700 rounded p-2 mb-4">
                <p className="text-red-400 text-sm">{publishError}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">选择策略</label>
                <select
                  value={publishStrategyId}
                  onChange={(e) => setPublishStrategyId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                >
                  <option value="">请选择策略</option>
                  {myStrategies.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {myStrategies.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">暂无可分享的策略</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">标题</label>
                <input
                  type="text"
                  value={publishTitle}
                  onChange={(e) => setPublishTitle(e.target.value)}
                  placeholder="给策略起个吸引人的标题"
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">描述</label>
                <textarea
                  value={publishDescription}
                  onChange={(e) => setPublishDescription(e.target.value)}
                  placeholder="描述策略特点、适用场景等"
                  rows={4}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPublishForm(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 rounded px-4 py-2 font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded px-4 py-2 font-medium transition-colors"
              >
                {publishing ? '发布中...' : '发布'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 策略卡片组件（市场浏览 / 我分享的 共用）
interface ShareCardProps {
  share: MarketShareItem | StrategyShare;
  showSubscribe: boolean;
  onSubscribe?: (id: number) => void;
  onUnsubscribe?: (id: number) => void;
}

function ShareCard({ share, showSubscribe, onSubscribe, onUnsubscribe }: ShareCardProps) {
  const isOwner = (share as MarketShareItem).is_owner === true;
  const isSubscribed = (share as MarketShareItem).is_subscribed === true;

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-xl font-bold">{share.title}</h3>
        <div className="flex items-center gap-2">
          {isOwner && (
            <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-1 rounded">
              我的策略
            </span>
          )}
          {showSubscribe && !isOwner && (
            isSubscribed ? (
              <button
                onClick={() => onUnsubscribe?.(share.id)}
                className="bg-gray-600 hover:bg-gray-700 rounded px-4 py-2 text-sm font-medium transition-colors"
              >
                取消订阅
              </button>
            ) : (
              <button
                onClick={() => onSubscribe?.(share.id)}
                className="bg-blue-600 hover:bg-blue-700 rounded px-4 py-2 text-sm font-medium transition-colors"
              >
                订阅
              </button>
            )
          )}
        </div>
      </div>

      {share.description && (
        <p className="text-gray-300 mb-4">{share.description}</p>
      )}

      <div className="flex flex-wrap gap-4 text-sm text-gray-400">
        <span>订阅数：{share.subscribe_count}</span>
        <span>评分：{renderStars(share.rating)}</span>
        <span>发布于：{formatDate(share.created_at)}</span>
      </div>
    </div>
  );
}
