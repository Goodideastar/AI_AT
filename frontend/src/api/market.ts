import api from './index'

export interface Ticker {
  symbol: string
  exchange: string
  last_price: number
  bid: number
  ask: number
  volume_24h: number
  high_24h: number
  low_24h: number
  timestamp: string
}

export interface Kline {
  symbol: string
  exchange: string
  interval: string
  open_time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  close_time: string
}

export interface OrderBook {
  symbol: string
  exchange: string
  bids: [number, number][]
  asks: [number, number][]
}

export const marketApi = {
  // 获取实时行情
  getTicker: async (symbol: string, exchange = 'binance') => {
    const response = await api.get(`/market/ticker/${symbol}`, {
      params: { exchange }
    })
    return response.data.data as Ticker
  },

  // 获取 K 线数据
  getKlines: async (symbol: string, interval = '1h', limit = 100, exchange = 'binance') => {
    const response = await api.get(`/market/klines/${symbol}`, {
      params: { exchange, interval, limit }
    })
    return response.data.data as Kline[]
  },

  // 获取订单簿
  getOrderBook: async (symbol: string, limit = 20, exchange = 'binance') => {
    const response = await api.get(`/market/orderbook/${symbol}`, {
      params: { exchange, limit }
    })
    return response.data.data as OrderBook
  }
}
