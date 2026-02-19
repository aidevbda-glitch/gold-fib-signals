import type { PriceData } from '../types/trading';

/**
 * Technical Indicators Service
 * 
 * Implements multiple indicators for confluence-based signal generation:
 * - EMA (Exponential Moving Average) - Trend direction
 * - MACD (Moving Average Convergence Divergence) - Momentum
 * - RSI (Relative Strength Index) - Overbought/Oversold
 * - ATR (Average True Range) - Volatility for stops/targets
 */

export interface EMAResult {
  ema8: number;
  ema34: number;
  crossover: 'bullish' | 'bearish' | 'none';
  trend: 'up' | 'down' | 'sideways';
  strength: number; // 0-100
}

export interface MACrossResult {
  sma50: number;
  sma200: number;
  goldenCross: boolean;      // 50 just crossed above 200
  deathCross: boolean;       // 50 just crossed below 200
  trend: 'bullish' | 'bearish' | 'neutral';  // 50 above/below 200
  distancePercent: number;   // How far apart the MAs are
  daysUntilCross: number | null;  // Estimated days until cross (if converging)
  strength: number;          // 0-100 based on separation
}

export interface MACDResult {
  macdLine: number;
  signalLine: number;
  histogram: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  divergence: 'bullish' | 'bearish' | 'none';
  strength: number; // 0-100
}

export interface RSIResult {
  value: number;
  zone: 'oversold' | 'neutral' | 'overbought';
  buyZone: boolean; // 45-70 for buys
  sellZone: boolean; // 30-55 for sells
  strength: number; // 0-100
}

export interface ATRResult {
  value: number;
  stopLoss: number; // 1.5x ATR
  takeProfit: number; // 2x ATR
  volatility: 'low' | 'medium' | 'high';
}

export interface ConfluenceScore {
  total: number; // 0-100
  emaScore: number;
  maCrossScore: number;
  macdScore: number;
  rsiScore: number;
  fibScore: number;
  volumeScore: number;
  recommendation: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  confidence: 'high' | 'medium' | 'low';
  factors: string[];
}

export interface TechnicalAnalysis {
  ema: EMAResult;
  maCross: MACrossResult;
  macd: MACDResult;
  rsi: RSIResult;
  atr: ATRResult;
  confluence: ConfluenceScore;
  timestamp: number;
}

export class TechnicalIndicators {
  /**
   * Calculate EMA (Exponential Moving Average)
   */
  static calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    
    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  /**
   * Calculate EMA crossover analysis
   */
  static analyzeEMA(priceData: PriceData[]): EMAResult {
    const closes = priceData.map(d => d.close);
    
    if (closes.length < 34) {
      return {
        ema8: closes[closes.length - 1],
        ema34: closes[closes.length - 1],
        crossover: 'none',
        trend: 'sideways',
        strength: 50,
      };
    }

    const ema8 = this.calculateEMA(closes, 8);
    const ema34 = this.calculateEMA(closes, 34);
    
    // Previous EMAs for crossover detection
    const prevCloses = closes.slice(0, -1);
    const prevEma8 = this.calculateEMA(prevCloses, 8);
    const prevEma34 = this.calculateEMA(prevCloses, 34);

    let crossover: 'bullish' | 'bearish' | 'none' = 'none';
    if (prevEma8 <= prevEma34 && ema8 > ema34) {
      crossover = 'bullish';
    } else if (prevEma8 >= prevEma34 && ema8 < ema34) {
      crossover = 'bearish';
    }

    const diff = ema8 - ema34;
    const percentDiff = (diff / ema34) * 100;
    
    let trend: 'up' | 'down' | 'sideways' = 'sideways';
    if (percentDiff > 0.5) trend = 'up';
    else if (percentDiff < -0.5) trend = 'down';

    // Strength based on EMA separation
    const strength = Math.min(100, Math.abs(percentDiff) * 20);

    return { ema8, ema34, crossover, trend, strength };
  }

  /**
   * Calculate SMA (Simple Moving Average)
   */
  static calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  /**
   * Analyze 50/200 SMA Golden Cross / Death Cross
   * 
   * Golden Cross: 50-day SMA crosses ABOVE 200-day SMA (bullish)
   * Death Cross: 50-day SMA crosses BELOW 200-day SMA (bearish)
   * 
   * These are lagging indicators that confirm medium-to-long term trends.
   */
  static analyzeMACross(priceData: PriceData[]): MACrossResult {
    const closes = priceData.map(d => d.close);
    const currentPrice = closes[closes.length - 1];
    
    // Need at least 200 data points for reliable 200-day SMA
    if (closes.length < 200) {
      return {
        sma50: currentPrice,
        sma200: currentPrice,
        goldenCross: false,
        deathCross: false,
        trend: 'neutral',
        distancePercent: 0,
        daysUntilCross: null,
        strength: 50,
      };
    }

    const sma50 = this.calculateSMA(closes, 50);
    const sma200 = this.calculateSMA(closes, 200);
    
    // Previous SMAs for crossover detection (yesterday)
    const prevCloses = closes.slice(0, -1);
    const prevSma50 = this.calculateSMA(prevCloses, 50);
    const prevSma200 = this.calculateSMA(prevCloses, 200);

    // Detect crosses
    const goldenCross = prevSma50 <= prevSma200 && sma50 > sma200;
    const deathCross = prevSma50 >= prevSma200 && sma50 < sma200;

    // Current trend
    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (sma50 > sma200) trend = 'bullish';
    else if (sma50 < sma200) trend = 'bearish';

    // Distance between MAs
    const distancePercent = ((sma50 - sma200) / sma200) * 100;

    // Estimate days until cross (if converging)
    let daysUntilCross: number | null = null;
    const prevDistance = prevSma50 - prevSma200;
    const currentDistance = sma50 - sma200;
    const dailyConvergence = Math.abs(currentDistance) - Math.abs(prevDistance);
    
    // If MAs are converging (distance decreasing)
    if (dailyConvergence < 0 && Math.abs(currentDistance) > 0) {
      const rate = Math.abs(dailyConvergence);
      if (rate > 0) {
        daysUntilCross = Math.round(Math.abs(currentDistance) / rate);
        // Cap at reasonable estimate
        if (daysUntilCross > 180) daysUntilCross = null;
      }
    }

    // Strength based on separation (wider = stronger trend)
    const strength = Math.min(100, Math.abs(distancePercent) * 10);

    return {
      sma50,
      sma200,
      goldenCross,
      deathCross,
      trend,
      distancePercent,
      daysUntilCross,
      strength,
    };
  }

  /**
   * Calculate MACD (12, 26, 9)
   */
  static analyzeMACD(priceData: PriceData[]): MACDResult {
    const closes = priceData.map(d => d.close);
    
    if (closes.length < 26) {
      return {
        macdLine: 0,
        signalLine: 0,
        histogram: 0,
        trend: 'neutral',
        divergence: 'none',
        strength: 50,
      };
    }

    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    const macdLine = ema12 - ema26;

    // Calculate signal line (9-period EMA of MACD)
    const macdHistory: number[] = [];
    for (let i = 26; i <= closes.length; i++) {
      const slice = closes.slice(0, i);
      const e12 = this.calculateEMA(slice, 12);
      const e26 = this.calculateEMA(slice, 26);
      macdHistory.push(e12 - e26);
    }
    
    const signalLine = macdHistory.length >= 9 
      ? this.calculateEMA(macdHistory, 9) 
      : macdLine;
    
    const histogram = macdLine - signalLine;

    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (macdLine > signalLine && histogram > 0) trend = 'bullish';
    else if (macdLine < signalLine && histogram < 0) trend = 'bearish';

    // Detect divergence (simplified)
    let divergence: 'bullish' | 'bearish' | 'none' = 'none';
    if (priceData.length >= 10) {
      const recentPrices = closes.slice(-10);
      const pricesTrend = recentPrices[recentPrices.length - 1] > recentPrices[0];
      const macdTrend = histogram > 0;
      
      if (!pricesTrend && macdTrend) divergence = 'bullish';
      else if (pricesTrend && !macdTrend) divergence = 'bearish';
    }

    const strength = Math.min(100, Math.abs(histogram) * 10);

    return { macdLine, signalLine, histogram, trend, divergence, strength };
  }

  /**
   * Calculate RSI (14-period)
   */
  static analyzeRSI(priceData: PriceData[], period: number = 14): RSIResult {
    const closes = priceData.map(d => d.close);
    
    if (closes.length < period + 1) {
      return {
        value: 50,
        zone: 'neutral',
        buyZone: false,
        sellZone: false,
        strength: 50,
      };
    }

    let gains = 0;
    let losses = 0;

    // Initial average
    for (let i = 1; i <= period; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Smoothed average
    for (let i = period + 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) {
        avgGain = (avgGain * (period - 1) + change) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) - change) / period;
      }
    }

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    let zone: 'oversold' | 'neutral' | 'overbought' = 'neutral';
    if (rsi < 30) zone = 'oversold';
    else if (rsi > 70) zone = 'overbought';

    const buyZone = rsi >= 45 && rsi <= 70;
    const sellZone = rsi >= 30 && rsi <= 55;

    // Strength: higher when in extreme zones
    let strength = 50;
    if (rsi < 30) strength = 100 - rsi;
    else if (rsi > 70) strength = rsi;
    else strength = 50 + Math.abs(50 - rsi);

    return { value: rsi, zone, buyZone, sellZone, strength };
  }

  /**
   * Calculate ATR (14-period)
   */
  static analyzeATR(priceData: PriceData[], period: number = 14): ATRResult {
    if (priceData.length < period + 1) {
      const lastPrice = priceData[priceData.length - 1]?.close || 0;
      return {
        value: lastPrice * 0.01,
        stopLoss: lastPrice * 0.015,
        takeProfit: lastPrice * 0.02,
        volatility: 'medium',
      };
    }

    const trueRanges: number[] = [];
    
    for (let i = 1; i < priceData.length; i++) {
      const high = priceData[i].high;
      const low = priceData[i].low;
      const prevClose = priceData[i - 1].close;
      
      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      trueRanges.push(tr);
    }

    // Calculate ATR as EMA of true ranges
    let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
    const multiplier = 2 / (period + 1);
    
    for (let i = period; i < trueRanges.length; i++) {
      atr = (trueRanges[i] - atr) * multiplier + atr;
    }

    const lastPrice = priceData[priceData.length - 1].close;
    const atrPercent = (atr / lastPrice) * 100;

    let volatility: 'low' | 'medium' | 'high' = 'medium';
    if (atrPercent < 1) volatility = 'low';
    else if (atrPercent > 2) volatility = 'high';

    return {
      value: atr,
      stopLoss: atr * 1.5,
      takeProfit: atr * 2.0,
      volatility,
    };
  }

  /**
   * Calculate confluence score from all indicators
   */
  static calculateConfluence(
    ema: EMAResult,
    maCross: MACrossResult,
    macd: MACDResult,
    rsi: RSIResult,
    fibScore: number = 0,
    volumeScore: number = 0
  ): ConfluenceScore {
    const factors: string[] = [];
    let totalScore = 50; // Start neutral

    // EMA Score (max 20 points) - Short-term trend
    let emaScore = 0;
    if (ema.trend === 'up') {
      emaScore = Math.min(15, ema.strength / 5);
      factors.push(`EMA (8/34): Bullish short-term trend`);
      totalScore += emaScore;
    } else if (ema.trend === 'down') {
      emaScore = -Math.min(15, ema.strength / 5);
      factors.push(`EMA (8/34): Bearish short-term trend`);
      totalScore += emaScore;
    }
    if (ema.crossover === 'bullish') {
      emaScore += 8;
      totalScore += 8;
      factors.push(`EMA: Fresh bullish crossover! 🔥`);
    } else if (ema.crossover === 'bearish') {
      emaScore -= 8;
      totalScore -= 8;
      factors.push(`EMA: Fresh bearish crossover! ⚠️`);
    }

    // MA Cross Score (max 15 points) - Medium-term trend (Golden/Death Cross)
    let maCrossScore = 0;
    if (maCross.goldenCross) {
      maCrossScore = 15;
      totalScore += 15;
      factors.push(`🌟 GOLDEN CROSS: 50-day crossed above 200-day (major bullish signal)`);
    } else if (maCross.deathCross) {
      maCrossScore = -15;
      totalScore -= 15;
      factors.push(`💀 DEATH CROSS: 50-day crossed below 200-day (major bearish signal)`);
    } else if (maCross.trend === 'bullish') {
      maCrossScore = Math.min(10, maCross.strength / 10);
      totalScore += maCrossScore;
      factors.push(`MA (50/200): Bullish medium-term trend (${maCross.distancePercent.toFixed(1)}% above)`);
    } else if (maCross.trend === 'bearish') {
      maCrossScore = -Math.min(10, maCross.strength / 10);
      totalScore += maCrossScore;
      factors.push(`MA (50/200): Bearish medium-term trend (${Math.abs(maCross.distancePercent).toFixed(1)}% below)`);
    }
    
    // Add convergence warning if MAs are about to cross
    if (maCross.daysUntilCross !== null && maCross.daysUntilCross <= 30) {
      const crossType = maCross.trend === 'bearish' ? 'Golden Cross' : 'Death Cross';
      factors.push(`⏳ Potential ${crossType} in ~${maCross.daysUntilCross} days (MAs converging)`);
    }

    // MACD Score (max 20 points)
    let macdScore = 0;
    if (macd.trend === 'bullish') {
      macdScore = Math.min(20, macd.strength / 5);
      factors.push(`MACD: Bullish momentum`);
      totalScore += macdScore;
    } else if (macd.trend === 'bearish') {
      macdScore = -Math.min(20, macd.strength / 5);
      factors.push(`MACD: Bearish momentum`);
      totalScore += macdScore;
    }
    if (macd.divergence === 'bullish') {
      macdScore += 5;
      totalScore += 5;
      factors.push(`MACD: Bullish divergence detected`);
    } else if (macd.divergence === 'bearish') {
      macdScore -= 5;
      totalScore -= 5;
      factors.push(`MACD: Bearish divergence detected`);
    }

    // RSI Score (max 20 points)
    let rsiScore = 0;
    if (rsi.zone === 'oversold') {
      rsiScore = 15;
      factors.push(`RSI: Oversold (${rsi.value.toFixed(1)}) - potential bounce`);
      totalScore += rsiScore;
    } else if (rsi.zone === 'overbought') {
      rsiScore = -15;
      factors.push(`RSI: Overbought (${rsi.value.toFixed(1)}) - potential pullback`);
      totalScore += rsiScore;
    } else if (rsi.buyZone) {
      rsiScore = 10;
      factors.push(`RSI: In buy zone (${rsi.value.toFixed(1)})`);
      totalScore += rsiScore;
    } else if (rsi.sellZone && !rsi.buyZone) {
      rsiScore = -10;
      factors.push(`RSI: In sell zone (${rsi.value.toFixed(1)})`);
      totalScore += rsiScore;
    }

    // Add Fib and Volume scores
    totalScore += fibScore;
    totalScore += volumeScore;

    // Clamp to 0-100
    totalScore = Math.max(0, Math.min(100, totalScore));

    // Determine recommendation
    let recommendation: ConfluenceScore['recommendation'];
    if (totalScore >= 75) recommendation = 'STRONG_BUY';
    else if (totalScore >= 60) recommendation = 'BUY';
    else if (totalScore >= 40) recommendation = 'NEUTRAL';
    else if (totalScore >= 25) recommendation = 'SELL';
    else recommendation = 'STRONG_SELL';

    // Determine confidence (include MA Cross in alignment)
    const alignedIndicators = [
      ema.trend === 'up' ? 1 : ema.trend === 'down' ? -1 : 0,
      maCross.trend === 'bullish' ? 1 : maCross.trend === 'bearish' ? -1 : 0,
      macd.trend === 'bullish' ? 1 : macd.trend === 'bearish' ? -1 : 0,
      rsi.buyZone ? 1 : rsi.sellZone ? -1 : 0,
    ];
    const alignment = Math.abs(alignedIndicators.reduce((a, b) => a + b, 0));
    
    let confidence: 'high' | 'medium' | 'low';
    if (alignment >= 4) confidence = 'high';
    else if (alignment >= 2) confidence = 'medium';
    else confidence = 'low';

    return {
      total: totalScore,
      emaScore: Math.abs(emaScore),
      maCrossScore: Math.abs(maCrossScore),
      macdScore: Math.abs(macdScore),
      rsiScore: Math.abs(rsiScore),
      fibScore,
      volumeScore,
      recommendation,
      confidence,
      factors,
    };
  }

  /**
   * Run full technical analysis
   */
  static analyze(priceData: PriceData[], fibScore: number = 0): TechnicalAnalysis {
    const ema = this.analyzeEMA(priceData);
    const maCross = this.analyzeMACross(priceData);
    const macd = this.analyzeMACD(priceData);
    const rsi = this.analyzeRSI(priceData);
    const atr = this.analyzeATR(priceData);
    const confluence = this.calculateConfluence(ema, maCross, macd, rsi, fibScore, 0);

    return {
      ema,
      maCross,
      macd,
      rsi,
      atr,
      confluence,
      timestamp: Date.now(),
    };
  }
}
