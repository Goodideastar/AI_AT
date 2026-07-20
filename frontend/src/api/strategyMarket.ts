import api from './index'
import type { Strategy } from './strategy'

// 策略分享项
export interface StrategyShare {
  id: number
  user_id: number
  strategy_id: number
  title: string
  description?: string
  is_public: boolean
  subscribe_count: number
  rating: number
  created_at: string
  // 详情接口会额外返回
  strategy?: Strategy
  is_subscribed?: boolean
}

// 策略市场 API
export const strategyMarketApi = {
  // 获取策略市场分享列表
  listShares: (page = 1, pageSize = 20) =>
    api.get('/strategy-market/shares', { params: { page, page_size: pageSize } }),

  // 获取策略分享详情
  getShare: (id: number) => api.get(`/strategy-market/shares/${id}`),

  // 创建策略分享
  createShare: (data: { strategy_id: number; title: string; description?: string }) =>
    api.post('/strategy-market/shares', data),

  // 订阅策略分享
  subscribe: (id: number) => api.post(`/strategy-market/shares/${id}/subscribe`),

  // 取消订阅策略分享
  unsubscribe: (id: number) => api.delete(`/strategy-market/shares/${id}/subscribe`),

  // 获取我订阅的策略列表
  mySubscriptions: (page = 1, pageSize = 20) =>
    api.get('/strategy-market/my-subscriptions', { params: { page, page_size: pageSize } }),

  // 获取我分享的策略列表
  myShares: (page = 1, pageSize = 20) =>
    api.get('/strategy-market/my-shares', { params: { page, page_size: pageSize } }),
}
