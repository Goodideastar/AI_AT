import api from './index'

// 回测请求参数
export interface BacktestRequest {
  strategy_id?: number
  exchange?: string
  symbol?: string
  interval?: string
  limit?: number
  initial_capital?: number
}

// 回测绩效指标
export interface BacktestMetrics {
  total_return: number
  annual_return: number
  max_drawdown: number
  win_rate: number
  profit_factor: number
  sharpe_ratio: number
  total_trades: number
  winning_trades: number
  losing_trades: number
}

// 回测结果
export interface BacktestResult {
  initial_capital: number
  final_capital: number
  total_return: number
  trades: any[]
  equity_curve: any[]
  metrics: BacktestMetrics
}

// 回测 API
export const backtestApi = {
  // 执行回测
  run: (data: BacktestRequest) => api.post('/backtest/run', data),
}
