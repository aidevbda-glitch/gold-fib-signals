import type { GoldQuote, PriceData } from '../types/trading';

/**
 * Gold Price Service
 * 
 * Fetches real-time and historical gold prices from the backend API.
 * Falls back to mock data if backend is unavailable.
 */

// Use relative URL for Docker (nginx proxies /api to backend)
// or localhost for development
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export class GoldPriceService {
  private static lastPrice: number = 2650;
  private static mockHistory: PriceData[] = [];
  private static useBackend: boolean = true;

  /**
   * Fetch current gold spot price
   */
  static async getCurrentPrice(): Promise<GoldQuote> {
    if (this.useBackend) {
      try {
        const response = await fetch(`${API_BASE}/price/current`);
        if (response.ok) {
          const data = await response.json();
          return {
            price: data.price,
            bid: data.bid,
            ask: data.ask,
            high24h: data.high24h,
            low24h: data.low24h,
            change24h: data.change24h,
            changePercent24h: data.changePercent24h,
            timestamp: data.timestamp,
            source: data.source,
          };
        }
      } catch (error) {
        console.warn('Backend unavailable, using mock data:', error);
        this.useBackend = false;
      }
    }

    // Fallback to mock data
    return this.generateMockQuote();
  }

  /**
   * Get historical price data
   */
  static async getHistoricalData(periods: number = 50, range: string = '1y'): Promise<PriceData[]> {
    if (this.useBackend) {
      try {
        const response = await fetch(`${API_BASE}/price/history?range=${range}&interval=1d`);
        if (response.ok) {
          const result = await response.json();
          this.mockHistory = result.data.map((d: any) => ({
            timestamp: d.timestamp,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
            volume: d.volume,
          }));
          
          // Return last N periods
          return this.mockHistory.slice(-periods);
        }
      } catch (error) {
        console.warn('Backend unavailable for history, using mock:', error);
      }
    }

    // Fallback: generate mock historical data
    if (this.mockHistory.length >= periods) {
      return this.mockHistory.slice(-periods);
    }

    const history: PriceData[] = [];
    let price = 2600;
    const now = Date.now();
    const interval = 15 * 60 * 1000;

    for (let i = periods; i > 0; i--) {
      const volatility = 0.003;
      const change = (Math.random() - 0.5) * 2 * volatility;
      
      const open = price;
      price = price * (1 + change);
      const close = price;
      
      const highLowRange = Math.abs(close - open) + price * 0.001;
      const high = Math.max(open, close) + Math.random() * highLowRange;
      const low = Math.min(open, close) - Math.random() * highLowRange;

      history.push({
        timestamp: now - i * interval,
        open,
        high,
        low,
        close,
        volume: Math.floor(Math.random() * 10000) + 5000,
      });
    }

    this.mockHistory = history;
    this.lastPrice = history[history.length - 1].close;

    return history;
  }

  /**
   * Generate mock quote with realistic price movement
   */
  private static generateMockQuote(): GoldQuote {
    const volatility = 0.001;
    const drift = (Math.random() - 0.5) * 2 * volatility;
    
    this.lastPrice = this.lastPrice * (1 + drift);
    this.lastPrice = Math.max(2000, Math.min(3000, this.lastPrice));

    const spread = this.lastPrice * 0.0005;

    return {
      price: this.lastPrice,
      bid: this.lastPrice - spread / 2,
      ask: this.lastPrice + spread / 2,
      high24h: this.lastPrice * 1.008,
      low24h: this.lastPrice * 0.992,
      change24h: this.lastPrice * (Math.random() - 0.5) * 0.02,
      changePercent24h: (Math.random() - 0.5) * 2,
      timestamp: Date.now(),
      source: 'Mock Data (Backend Unavailable)',
    };
  }

  /**
   * Add new candle to history
   */
  static addCandle(candle: PriceData): void {
    this.mockHistory.push(candle);
    if (this.mockHistory.length > 200) {
      this.mockHistory = this.mockHistory.slice(-200);
    }
  }

  /**
   * Simulate real-time price update
   */
  static async simulateTick(): Promise<GoldQuote> {
    const quote = await this.getCurrentPrice();
    
    if (this.mockHistory.length > 0) {
      const lastCandle = this.mockHistory[this.mockHistory.length - 1];
      const candleAge = Date.now() - lastCandle.timestamp;
      
      if (candleAge > 15 * 60 * 1000) {
        this.addCandle({
          timestamp: Date.now(),
          open: quote.price,
          high: quote.price,
          low: quote.price,
          close: quote.price,
        });
      } else {
        lastCandle.close = quote.price;
        lastCandle.high = Math.max(lastCandle.high, quote.price);
        lastCandle.low = Math.min(lastCandle.low, quote.price);
      }
    }

    return quote;
  }

  /**
   * Check if backend is available
   */
  static async checkBackend(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/health`, { 
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      this.useBackend = response.ok;
      return response.ok;
    } catch {
      this.useBackend = false;
      return false;
    }
  }
}
