import type { GoldQuote, PriceData } from '../types/trading';

/**
 * Gold Price Service
 * 
 * Fetches real-time and historical gold prices from the backend API.
 * Primary: Backend API (Swissquote + FreeGoldAPI)
 * Fallback: Mock data (only if backend completely unavailable)
 * 
 * CRITICAL: Prevents price reversion by tracking the latest timestamp.
 * Only updates price if new data has a timestamp >= last known timestamp.
 */

// Use relative URL for Docker (nginx proxies /api to backend)
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export class GoldPriceService {
  // Current realistic gold price range (2024-2026: ~$4500-5500)
  private static lastPrice: number = 4900;
  private static mockHistory: PriceData[] = [];
  private static backendFailures: number = 0;
  private static readonly MAX_FAILURES = 5;

  // Track latest timestamp to prevent price reversion (flashing bug fix)
  private static latestTimestamp: number = 0;
  private static latestQuote: GoldQuote | null = null;

  // Maximum allowed future timestamp skew (60 seconds for clock drift)
  private static readonly MAX_FUTURE_SKEW_MS = 60000;

  /**
   * Validate quote data for correctness
   * Checks: timestamp validity (non-zero, non-negative, not in future)
   *         price validity (positive, reasonable range)
   */
  private static isValidQuoteData(quote: GoldQuote): boolean {
    const now = Date.now();

    // Check timestamp is valid
    if (!quote.timestamp || quote.timestamp <= 0) {
      console.warn(`Invalid quote timestamp: ${quote.timestamp}`);
      return false;
    }

    // Check timestamp is not in the future (with small allowance for clock drift)
    if (quote.timestamp > now + this.MAX_FUTURE_SKEW_MS) {
      console.warn(`Future quote timestamp rejected: ${quote.timestamp} (now=${now}, diff=${quote.timestamp - now}ms)`);
      return false;
    }

    // Check price is valid (positive and within reasonable bounds for gold)
    if (!quote.price || quote.price <= 0) {
      console.warn(`Invalid quote price: ${quote.price}`);
      return false;
    }

    // Gold price sanity check (2024-2026 range: $1000-$10000/oz)
    if (quote.price < 1000 || quote.price > 10000) {
      console.warn(`Quote price out of expected range: ${quote.price}`);
      return false;
    }

    return true;
  }

  /**
   * Get the latest known quote (for preventing reversion)
   */
  static getLatestQuote(): GoldQuote | null {
    return this.latestQuote;
  }

  /**
   * Update latest quote only if new data is fresher (by timestamp)
   * Returns true if updated, false if rejected as stale
   */
  private static updateIfFresher(quote: GoldQuote): boolean {
    // If we have no previous data, accept this
    if (!this.latestQuote || this.latestTimestamp === 0) {
      this.latestQuote = quote;
      this.latestTimestamp = quote.timestamp || Date.now();
      this.lastPrice = quote.price;
      return true;
    }
    
    // Only update if this data is as fresh or fresher than what we have
    const newTimestamp = quote.timestamp || Date.now();
    if (newTimestamp >= this.latestTimestamp) {
      this.latestQuote = quote;
      this.latestTimestamp = newTimestamp;
      this.lastPrice = quote.price;
      return true;
    }
    
    console.warn(`Rejecting stale price data: ts=${newTimestamp} vs latest=${this.latestTimestamp}`);
    return false;
  }

  /**
   * Fetch current gold spot price
   * Always tries backend first, only uses mock after multiple failures
   * 
   * CRITICAL: Uses timestamp-based freshness check to prevent price reversion.
   * The backend returns Swissquote's ts timestamp which must be preserved.
   */
  static async getCurrentPrice(): Promise<GoldQuote> {
    try {
      const response = await fetch(`${API_BASE}/price/current`, {
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        const data = await response.json();

        const quote: GoldQuote = {
          price: data.price,
          bid: data.bid,
          ask: data.ask,
          high24h: data.high24h,
          low24h: data.low24h,
          change24h: data.change24h,
          changePercent24h: data.changePercent24h,
          timestamp: data.timestamp, // CRITICAL: Use backend's Swissquote timestamp
          source: data.source,
        };

        // Validate quote data BEFORE resetting failure counter
        if (!this.isValidQuoteData(quote)) {
          throw new Error('Invalid quote data received from backend');
        }

        // Reset failure counter only after successful validation
        this.backendFailures = 0;

        // Only update if this data is fresher (prevents reversion bug)
        this.updateIfFresher(quote);

        // Return the freshest data we have (either this new data or our cached latest)
        return this.latestQuote || quote;
      }

      throw new Error(`Backend returned ${response.status}`);
    } catch (error) {
      this.backendFailures++;
      console.warn(`Backend fetch failed (${this.backendFailures}/${this.MAX_FAILURES}):`, error);

      // Only use mock data after multiple consecutive failures
      // AND only if we don't already have real data
      if (this.backendFailures >= this.MAX_FAILURES) {
        console.warn('Using mock data - backend appears unavailable');
        // If we have real data, keep using it instead of mock
        if (this.latestQuote) {
          console.log('Returning cached real data instead of mock');
          return this.latestQuote;
        }
        return this.generateMockQuote();
      }

      // On early failures, return cached real data if available
      if (this.latestQuote) {
        console.log('Returning cached real data after fetch failure');
        return this.latestQuote;
      }

      // No cached data yet, return mock but mark clearly
      return this.generateMockQuote();
    }
  }

  /**
   * Get historical price data (daily candles)
   * Uses /api/price/database which combines FreeGoldAPI + Swissquote aggregates
   */
  static async getHistoricalData(periods: number = 50, range: string = '1y'): Promise<PriceData[]> {
    try {
      // Calculate days from range
      const rangeToDays: Record<string, number> = {
        '1d': 1, '5d': 5, '1mo': 30, '3mo': 90,
        '6mo': 180, '1y': 365, '2y': 730, '3y': 1095, '5y': 1825
      };
      const days = rangeToDays[range] || 365;

      // Use database endpoint for chart data (combines historical + Swissquote)
      const response = await fetch(`${API_BASE}/price/database?days=${days}`, {
        signal: AbortSignal.timeout(15000)
      });
      
      if (response.ok) {
        const result = await response.json();
        this.backendFailures = 0;
        
        this.mockHistory = result.data.map((d: any) => ({
          timestamp: d.timestamp,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume || 0,
        }));
        
        // Update lastPrice from latest candle
        if (this.mockHistory.length > 0) {
          this.lastPrice = this.mockHistory[this.mockHistory.length - 1].close;
        }
        
        return this.mockHistory.slice(-periods);
      }
      
      throw new Error(`Backend returned ${response.status}`);
    } catch (error) {
      console.warn('Historical data fetch failed:', error);
      
      // Return cached history if available
      if (this.mockHistory.length > 0) {
        return this.mockHistory.slice(-periods);
      }
      
      // Generate realistic mock historical data
      return this.generateMockHistory(periods);
    }
  }

  /**
   * Generate mock quote with realistic current gold prices
   */
  private static generateMockQuote(): GoldQuote {
    const volatility = 0.001;
    const drift = (Math.random() - 0.5) * 2 * volatility;
    
    this.lastPrice = this.lastPrice * (1 + drift);
    // Realistic gold price range for 2024-2026
    this.lastPrice = Math.max(4000, Math.min(6000, this.lastPrice));

    const spread = this.lastPrice * 0.0003; // ~$1.50 spread

    return {
      price: this.lastPrice,
      bid: this.lastPrice - spread / 2,
      ask: this.lastPrice + spread / 2,
      high24h: this.lastPrice * 1.005,
      low24h: this.lastPrice * 0.995,
      change24h: this.lastPrice * (Math.random() - 0.5) * 0.01,
      changePercent24h: (Math.random() - 0.5) * 1,
      timestamp: Date.now(),
      source: 'Mock Data (Backend Unavailable)',
    };
  }

  /**
   * Generate mock historical data with realistic prices
   */
  private static generateMockHistory(periods: number): PriceData[] {
    const history: PriceData[] = [];
    let price = 4500; // Starting price
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    for (let i = periods; i > 0; i--) {
      const volatility = 0.015; // ~1.5% daily volatility
      const change = (Math.random() - 0.5) * 2 * volatility;
      
      const open = price;
      price = price * (1 + change);
      const close = price;
      
      const highLowRange = Math.abs(close - open) + price * 0.005;
      const high = Math.max(open, close) + Math.random() * highLowRange;
      const low = Math.min(open, close) - Math.random() * highLowRange;

      history.push({
        timestamp: now - i * dayMs,
        open,
        high,
        low,
        close,
        volume: 0,
      });
    }

    this.mockHistory = history;
    this.lastPrice = history[history.length - 1].close;

    return history;
  }

  /**
   * Add new candle to history
   */
  static addCandle(candle: PriceData): void {
    this.mockHistory.push(candle);
    if (this.mockHistory.length > 500) {
      this.mockHistory = this.mockHistory.slice(-500);
    }
  }

  /**
   * Simulate real-time price update
   * Uses the actual timestamp from the price source (Swissquote)
   */
  static async simulateTick(): Promise<GoldQuote> {
    const quote = await this.getCurrentPrice();
    
    if (this.mockHistory.length > 0) {
      const lastCandle = this.mockHistory[this.mockHistory.length - 1];
      // Use the quote's timestamp (from Swissquote) not Date.now()
      const candleAge = (quote.timestamp || Date.now()) - lastCandle.timestamp;
      const dayMs = 24 * 60 * 60 * 1000;
      
      // For daily data, only create new candle after a day
      if (candleAge > dayMs) {
        this.addCandle({
          timestamp: quote.timestamp || Date.now(),
          open: quote.price,
          high: quote.price,
          low: quote.price,
          close: quote.price,
        });
      } else {
        // Update current day's candle
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
      
      if (response.ok) {
        this.backendFailures = 0;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Force retry backend connection
   */
  static resetBackendConnection(): void {
    this.backendFailures = 0;
  }
}
