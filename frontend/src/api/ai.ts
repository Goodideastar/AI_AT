import axios from 'axios';

// 使用相对路径，开发环境由 vite proxy 转发，生产环境由 Nginx 反代
// 空字符串表示请求发到当前域名，配合 Nginx /api 反代
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 添加请求拦截器，自动添加 token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

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
    const response = await api.post('/api/ai/analyze', data);
    return response.data;
  },

  // 获取 AI 信号列表
  getSignals: async (): Promise<{ code: number; data: AISignal[] }> => {
    const response = await api.get('/api/ai/signals');
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
    const response = await api.post('/api/ai/backtest', data);
    return response.data;
  },

  // AI 风控检查
  riskCheck: async (data: RiskCheckRequest): Promise<RiskCheckResponse> => {
    const response = await api.post('/api/ai/risk-check', data);
    return response.data;
  },
};
