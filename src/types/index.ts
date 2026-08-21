/**
 * AetherQuant Type Definitions
 */

export type MarketType = 'CN' | 'US';
export type MarketColorMode = 'CN' | 'US'; // CN: Red up, Green down. US: Green up, Red down.

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  market: MarketType;
  currency: 'CNY' | 'USD';
  volume: string;
  turnover: string;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  pe: number;
  pb: number;
  marketCap: string;
  industry: string;
  updatedAt: string;
}

export interface KLinePoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ma5?: number;
  ma20?: number;
  ma60?: number;
}

export interface FactorItem {
  id: string;
  name: string;
  code: string;
  category: '动量' | '价值' | '质量' | '成长' | '低波动' | '流动性' | '情绪' | '自定义';
  ic: number;
  rankIc: number;
  coverage: number;
  updatedAt: string;
  description: string;
  score?: number;
}

export interface BacktestResult {
  id: string;
  strategyName: string;
  universe: string;
  startDate: string;
  endDate: string;
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  calmarRatio: number;
  winRate: number;
  turnoverRate: number;
  benchmarkReturn: number;
  alpha: number;
  beta: number;
  navHistory: { date: string; strategy: number; benchmark: number; drawdown: number }[];
  trades: { date: string; symbol: string; name: string; action: 'BUY' | 'SELL'; price: number; amount: number }[];
}

export interface DataSourceStatus {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'degraded';
  type: 'A股日线' | '美股日线' | '复权因子' | '指数成分' | 'QMT';
  lastSync: string;
  itemCount: string;
}

export interface MLModelExperiment {
  id: string;
  name: string;
  description?: string;
  type: 'LSTM' | 'XGBoost' | 'Transformer' | 'RandomForest';
  dataset: string;
  features: string[];
  target: string;
  trainRange: string;
  testRange: string;
  lossHistory: { epoch: number; trainLoss: number; valLoss: number }[];
  accuracy: number;
  ic: number;
  rankIc: number;
  status: 'trained' | 'training' | 'idle';
}

export interface Position {
  symbol: string;
  name: string;
  market: MarketType;
  shares: number;
  costPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  weightPercent: number;
}

export interface PaperAccount {
  totalAssets: number;
  cash: number;
  stockValue: number;
  dailyPnL: number;
  dailyPnLPercent: number;
  cumPnLPercent: number;
  positions: Position[];
}

export interface AutomationTask {
  id: string;
  name: string;
  description?: string;
  schedule: string;
  cron?: string;
  status: 'success' | 'running' | 'failed' | 'idle';
  duration: string;
  lastRun: string;
  nextRun: string;
  logs: string[];
}

export interface AIResearchThread {
  id: string;
  title: string;
  createdAt: string;
  messages: {
    sender: 'user' | 'assistant';
    content: string;
    steps?: string[];
    resultCard?: any;
    timestamp: string;
  }[];
}

export interface UserProfile {
  id: string;
  username?: string;
  name: string;
  avatar: string;
  title: string;
  department: string;
  email: string;
  phone?: string;
  role: 'admin' | 'quant_lead' | 'researcher' | 'trader' | 'free' | 'pro';
  status: 'active' | 'offline' | 'busy';
  accountType: 'Institutional Pro' | 'Fund Lead' | 'VIP Trader' | 'Community Explorer' | string;
  bio?: string;
  lastLogin: string;
  joinDate: string;
  apiKeyCount: number;
  liveTradingEnabled: boolean;
}

export interface QuantUserPreferences {
  defaultUniverse: string[];
  defaultBenchmark: string;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  defaultSlippageBp: number;
  maxDrawdownAlertPct: number;
  marketColorMode: 'CN' | 'US';
  preferredStrategies: string[];
  autoAiSummary: boolean;
  pushNotifications: boolean;
}

export type WorkspaceView =
  | 'overview'
  | 'market'
  | 'stock-detail'
  | 'ai-research'
  | 'doc-research'
  | 'data-center'
  | 'upload-center'
  | 'data-browser'
  | 'factor-library'
  | 'factor-lab'
  | 'strategy-library'
  | 'strategy-builder'
  | 'backtest-center'
  | 'backtest-detail'
  | 'strategy-compare'
  | 'ml-lab'
  | 'portfolio'
  | 'trading'
  | 'risk'
  | 'automation'
  | 'settings'
  | 'user-center'
  | 'admin-console';
