import api from './index';

// 复用 index.ts 中的共享 axios 实例：
// - 统一 baseURL（VITE_API_URL || '/api'）
// - 统一 token 注入（synapse_token）
// - 统一 401 响应拦截（清除 token 并跳转首页）

export interface AIAnalysisRequest {
  symbol: string;
  exchange?: string;
  interval?: string;
  limit?: number;
}

export interface AIAnalysisResponse {
  code: number;
  data: {
    symbol: string;
    exchange: string;
    interval: string;
    analysis: {
      trend: string;
      trend_strength: string;
      support_levels: number[];
      resistance_levels: number[];
      key_observations: string;
      suggestion: string;
      reason: string;
    };
    signal: {
      direction: string;
      entry_price: number;
      stop_loss: number;
      target_price: number;
      confidence: number;
      reason: string;
    };
    timestamp: string;
  };
}

export interface AISignal {
  symbol: string;
  analysis: {
    trend: string;
    trend_strength: string;
    support_levels: number[];
    resistance_levels: number[];
    key_observations: string;
    suggestion: string;
    reason: string;
  };
  signal: {
    direction: string;
    entry_price: number;
    stop_loss: number;
    target_price: number;
    confidence: number;
    reason: string;
  };
  timestamp: string;
}

export interface RiskCheckRequest {
  position_value: number;
  capital: number;
  entry_price: number;
  stop_price: number;
}

export interface RiskCheckResponse {
  code: number;
  data: {
    position_limit_ok: boolean;
    daily_loss_limit_ok: boolean;
    suggested_position_size: number;
    risk_level: string;
  };
}

export const aiApi = {
  // AI 市场分析
  analyze: async (data: AIAnalysisRequest): Promise<AIAnalysisResponse> => {
    const response = await api.post('/ai/analyze', data);
    return response.data;
  },

  // 获取 AI 信号列表
  getSignals: async (): Promise<{ code: number; data: AISignal[] }> => {
    const response = await api.get('/ai/signals');
    return response.data;
  },

  // AI 策略回测
  backtest: async (data: {
    strategy_id?: number;
    exchange?: string;
    symbol?: string;
    interval?: string;
    limit?: number;
    initial_capital?: number;
  }) => {
    const response = await api.post('/ai/backtest', data);
    return response.data;
  },

  // AI 风控检查
  riskCheck: async (data: RiskCheckRequest): Promise<RiskCheckResponse> => {
    const response = await api.post('/ai/risk-check', data);
    return response.data;
  },
};
