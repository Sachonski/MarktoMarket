export interface Trade {
  time: string;
  type: string;
  price: string;
  takeProfit: string;
  balance: string;
  total: string;
  profitLoss: string;
  open: string;
  convertFX: string;
}

export interface Metrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: string;
  totalProfitLoss: string;
  avgProfit: string;
  avgLoss: string;
  maxDrawdown: string;
  profitFactor: string;
  sharpRatio: string;
}

export interface MarketData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  conversionFx?: number;
  symbol?: string;
}

export interface BacktestData {
  symbol: string;
  trades: Trade[];
  metrics: Metrics;
  platform: 'MT4' | 'MT5';
  marketData: MarketData[] | null;
  initialDeposit: number;
}