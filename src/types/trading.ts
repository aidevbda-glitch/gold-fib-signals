// Core trading types for Gold Fibonacci Signal App

export interface PriceData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface FibonacciLevels {
  high: number;
  low: number;
  levels: {
    level0: number;    // 0% - the high
    level236: number;  // 23.6%
    level382: number;  // 38.2%
    level500: number;  // 50%
    level618: number;  // 61.8%
    level786: number;  // 78.6%
    level1000: number; // 100% - the low
  };
  direction: 'bullish' | 'bearish';
}

export type SignalType = 'BUY' | 'SELL' | 'HOLD';
export type SignalStrength = 'STRONG' | 'MODERATE' | 'WEAK';

export interface TradingSignal {
  id: string;
  type: SignalType;
  strength: SignalStrength;
  price: number;
  timestamp: number;
  fibLevel: string;
  fibValue: number;
  explanation: string;
  technicalDetails: {
    currentPrice: number;
    nearestFibLevel: string;
    distanceToLevel: number;
    trendDirection: 'UP' | 'DOWN' | 'SIDEWAYS';
    priceAction: string;
  };
}

export interface GoldQuote {
  price: number;
  bid: number;
  ask: number;
  high24h: number;
  low24h: number;
  change24h: number;
  changePercent24h: number;
  timestamp: number;
  source: string;
}

export interface IntradayTick {
  timestamp: number;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  source: string;
}

export interface AppState {
  currentPrice: GoldQuote | null;
  priceHistory: PriceData[];
  intradayData: IntradayTick[];
  fibLevels: FibonacciLevels | null;
  signals: TradingSignal[];
  isLoading: boolean;
  error: string | null;
  lastUpdate: number | null;
  selectedRange: string;
}
