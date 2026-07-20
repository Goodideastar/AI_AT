import api from './index'

// 策略实体
export interface Strategy {
  id: number
  name: string
  description?: string
  strategy_type: string
  parameters: Record<string, any>
  symbols: string[]
  exchange: string
  is_active: boolean
  created_at: string
}

// 策略管理 API
export const strategyApi = {
  // 获取策略类型列表
  listTypes: () => api.get('/strategies'),

  // 创建策略
  create: (data: Partial<Strategy>) => api.post('/strategies', data),

  // 获取当前用户的策略列表
  listMine: () => api.get('/strategies/my'),

  // 启用/停用策略
  toggle: (id: number) => api.put(`/strategies/${id}/toggle`),
}
