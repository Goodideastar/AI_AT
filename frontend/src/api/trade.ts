import api from './index'

// 订单实体
export interface Order {
  id: number
  symbol: string
  side: string
  order_type: string
  quantity: number
  filled_quantity: number
  price?: number
  filled_price?: number
  status: string
  created_at: string
}

// 持仓实体
export interface Position {
  id: number
  symbol: string
  quantity: number
  avg_price: number
  unrealized_pnl: number
  realized_pnl: number
}

// 下单请求参数
export interface PlaceOrderRequest {
  symbol: string
  exchange: string
  side: string
  order_type: string
  quantity: number
  price?: number
  strategy_id?: number
}

// 交易 API
export const tradeApi = {
  // 下单
  placeOrder: (data: PlaceOrderRequest) => api.post('/trade/order', data),

  // 获取订单列表
  getOrders: () => api.get('/trade/orders'),

  // 获取持仓列表
  getPositions: () => api.get('/trade/positions'),
}
