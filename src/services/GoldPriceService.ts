import { GoldQuote, PriceData } from '../types/trading';

/**
 * Gold Price Service
 * 
 * Fetches real-time and historical gold prices.
 * 
 * Free API options:
 * - GoldAPI.io (500 requests/month free)
 * - Metals.dev (100 requests/month free)
 * - MetalpriceAPI (100 requests/month free)
 * 
 * For demo/development, we include a mock data generator.
 */

const API_CONFIG = {
  // Set your API key in environment variables
  GOLDAPI_KEY: import.meta.env.VITE_GOLDAPI_KEY || '',
  METALPRICEAPI_KEY: import.meta.env.VITE_METALPRICEAPI_KEY || '',
};

export class GoldPriceService {
  private static lastPrice: number = 2650; // Starting price for mock
  private static mockHistory: PriceData[] = [];

  /**
   * Fetch current gold spot price
   */
  static async getCurrentPrice(): Promise<GoldQuote> {
    // Try real APIs first, fallback to mock
    if (API_CONFIG.GOLDAPI_KEY) {
      return this.fetchFromGoldAPI();
    }
    
    if (API_CONFIG.METALPRICEAPI_KEY) {
      return this.fetchFromMetalPriceAPI();
    }

    // Mock data for development
    return this.generateMockQuote();
  }

  /**
   * Fetch from GoldAPI.io
   */
  private static async fetchFromGoldAPI(): Promise<GoldQuote> {
    const response = await fetch('https://www.goldapi.io/api/XAU/USD', {
      headers: {
        'x-access-token': API_CONFIG.GOLDAPI_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`GoldAPI error: ${response.status}`);
    }

    const data = await response.json();

    return {
      price: data.price,
      bid: data.price_gram_24k * 31.1035, // Convert from gram to oz
      ask: data.price_gram_24k * 31.1035 * 1.001,
      high24h: data.high_price || data.price * 1.005,
      low24h: data.low_price || data.price * 0.995,
      change24h: data.ch || 0,
      changePercent24h: data.chp || 0,
      timestamp: Date.now(),
      source: 'GoldAPI.io',
    };
  }

  /**
   * Fetch from MetalPriceAPI
   */
  private static async fetchFromMetalPriceAPI(): Promise<GoldQuote> {
    const response = await fetch(
      `https://api.metalpriceapi.com/v1/latest?api_key=${API_CONFIG.METALPRICEAPI_KEY}&base=XAU&currencies=USD`
    );

    if (!response.ok) {
      throw new Error(`MetalPriceAPI error: ${response.status}`);
    }

    const data = await response.json();
    const price = 1 / data.rates.USD; // API returns USD per XAU, we want XAU price in USD

    return {
      price,
      bid: price * 0.999,
      ask: price * 1.001,
      high24h: price * 1.005,
      low24h: price * 0.995,
      change24h: 0,
      changePercent24h: 0,
      timestamp: Date.now(),
      source: 'MetalPriceAPI',
    };
  }

  /**
   * Generate mock quote with realistic price movement
   */
  private static generateMockQuote(): GoldQuote {
    // Simulate realistic gold price movement
    const volatility = 0.001; // 0.1% typical movement
    const drift = (Math.random() - 0.5) * 2 * volatility;
    
    this.lastPrice = this.lastPrice * (1 + drift);
    
    // Keep price in realistic range ($2000 - $3000)
    this.lastPrice = Math.max(2000, Math.min(3000, this.lastPrice));

    const spread = this.lastPrice * 0.0005; // 0.05% spread

    return {
      price: this.lastPrice,
      bid: this.lastPrice - spread / 2,
      ask: this.lastPrice + spread / 2,
      high24h: this.lastPrice * 1.008,
      low24h: this.lastPrice * 0.992,
      change24h: this.lastPrice * (Math.random() - 0.5) * 0.02,
      changePercent24h: (Math.random() - 0.5) * 2,
      timestamp: Date.now(),
      source: 'Mock Data',
    };
  }

  /**
   * Get historical price data
   */
  static async getHistoricalData(periods: number = 50): Promise<PriceData[]> {
    // For real implementation, fetch from API
    // For now, generate mock historical data
    
    if (this.mockHistory.length >= periods) {
      return this.mockHistory.slice(-periods);
    }

    // Generate historical data
    const history: PriceData[] = [];
    let price = 2600; // Starting price
    const now = Date.now();
    const interval = 15 * 60 * 1000; // 15-minute candles

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
   * Add new candle to history (for real-time updates)
   */
  static addCandle(candle: PriceData): void {
    this.mockHistory.push(candle);
    // Keep last 200 candles
    if (this.mockHistory.length > 200) {
      this.mockHistory = this.mockHistory.slice(-200);
    }
  }

  /**
   * Simulate real-time price update
   */
  static async simulateTick(): Promise<GoldQuote> {
    const quote = await this.getCurrentPrice();
    
    // Update the last candle or create new one
    if (this.mockHistory.length > 0) {
      const lastCandle = this.mockHistory[this.mockHistory.length - 1];
      const candleAge = Date.now() - lastCandle.timestamp;
      
      if (candleAge > 15 * 60 * 1000) {
        // Create new candle
        this.addCandle({
          timestamp: Date.now(),
          open: quote.price,
          high: quote.price,
          low: quote.price,
          close: quote.price,
        });
      } else {
        // Update current candle
        lastCandle.close = quote.price;
        lastCandle.high = Math.max(lastCandle.high, quote.price);
        lastCandle.low = Math.min(lastCandle.low, quote.price);
      }
    }

    return quote;
  }
}
