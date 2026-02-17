import { PriceData, FibonacciLevels } from '../types/trading';

/**
 * Fibonacci Retracement Service
 * 
 * Key Fibonacci ratios derived from the sequence:
 * - 23.6% = 1 - (0.618^3) ≈ minor retracement
 * - 38.2% = 1 - 0.618 = strong trend retracement
 * - 50.0% = psychological level (not true Fibonacci)
 * - 61.8% = golden ratio, key reversal level
 * - 78.6% = sqrt(0.618), deep retracement
 */

export class FibonacciService {
  private static readonly LEVELS = {
    L0: 0,
    L236: 0.236,
    L382: 0.382,
    L500: 0.5,
    L618: 0.618,
    L786: 0.786,
    L1000: 1.0,
  };

  /**
   * Calculate Fibonacci retracement levels from price swing
   */
  static calculateLevels(high: number, low: number, direction: 'bullish' | 'bearish'): FibonacciLevels {
    const range = high - low;

    if (direction === 'bullish') {
      // Bullish: measuring retracement from high back down
      // Level 0% = high (swing top)
      // Level 100% = low (swing bottom)
      return {
        high,
        low,
        direction,
        levels: {
          level0: high,
          level236: high - range * this.LEVELS.L236,
          level382: high - range * this.LEVELS.L382,
          level500: high - range * this.LEVELS.L500,
          level618: high - range * this.LEVELS.L618,
          level786: high - range * this.LEVELS.L786,
          level1000: low,
        },
      };
    } else {
      // Bearish: measuring retracement from low back up
      // Level 0% = low (swing bottom)
      // Level 100% = high (swing top)
      return {
        high,
        low,
        direction,
        levels: {
          level0: low,
          level236: low + range * this.LEVELS.L236,
          level382: low + range * this.LEVELS.L382,
          level500: low + range * this.LEVELS.L500,
          level618: low + range * this.LEVELS.L618,
          level786: low + range * this.LEVELS.L786,
          level1000: high,
        },
      };
    }
  }

  /**
   * Find swing high and low from price data
   */
  static findSwingPoints(
    priceData: PriceData[],
    lookback: number = 20
  ): { high: number; low: number; highIndex: number; lowIndex: number } {
    if (priceData.length < lookback) {
      throw new Error(`Need at least ${lookback} candles for analysis`);
    }

    const recentData = priceData.slice(-lookback);
    
    let high = -Infinity;
    let low = Infinity;
    let highIndex = 0;
    let lowIndex = 0;

    recentData.forEach((candle, index) => {
      if (candle.high > high) {
        high = candle.high;
        highIndex = index;
      }
      if (candle.low < low) {
        low = candle.low;
        lowIndex = index;
      }
    });

    return { high, low, highIndex, lowIndex };
  }

  /**
   * Determine trend direction from swing points
   */
  static determineTrendDirection(highIndex: number, lowIndex: number): 'bullish' | 'bearish' {
    // If the low came before the high, we're in an uptrend (bullish)
    // If the high came before the low, we're in a downtrend (bearish)
    return lowIndex < highIndex ? 'bullish' : 'bearish';
  }

  /**
   * Find the nearest Fibonacci level to the current price
   */
  static findNearestLevel(
    currentPrice: number,
    fibLevels: FibonacciLevels
  ): { level: string; value: number; distance: number; percentDistance: number } {
    const levels = [
      { name: '0%', value: fibLevels.levels.level0 },
      { name: '23.6%', value: fibLevels.levels.level236 },
      { name: '38.2%', value: fibLevels.levels.level382 },
      { name: '50%', value: fibLevels.levels.level500 },
      { name: '61.8%', value: fibLevels.levels.level618 },
      { name: '78.6%', value: fibLevels.levels.level786 },
      { name: '100%', value: fibLevels.levels.level1000 },
    ];

    let nearest = levels[0];
    let minDistance = Math.abs(currentPrice - levels[0].value);

    for (const level of levels) {
      const distance = Math.abs(currentPrice - level.value);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = level;
      }
    }

    const range = fibLevels.high - fibLevels.low;
    const percentDistance = (minDistance / range) * 100;

    return {
      level: nearest.name,
      value: nearest.value,
      distance: minDistance,
      percentDistance,
    };
  }

  /**
   * Check if price is at a key Fibonacci level (within tolerance)
   */
  static isAtFibLevel(
    currentPrice: number,
    fibLevels: FibonacciLevels,
    tolerancePercent: number = 0.5
  ): { atLevel: boolean; level: string | null; value: number | null } {
    const { level, value, percentDistance } = this.findNearestLevel(currentPrice, fibLevels);

    if (percentDistance <= tolerancePercent) {
      return { atLevel: true, level, value };
    }

    return { atLevel: false, level: null, value: null };
  }

  /**
   * Analyze price position relative to Fibonacci levels
   */
  static analyzePosition(currentPrice: number, fibLevels: FibonacciLevels): {
    zone: 'above_high' | 'upper' | 'middle' | 'lower' | 'below_low';
    description: string;
  } {
    const { levels, direction } = fibLevels;

    if (direction === 'bullish') {
      if (currentPrice > levels.level0) {
        return { zone: 'above_high', description: 'Price above swing high - potential breakout' };
      } else if (currentPrice > levels.level382) {
        return { zone: 'upper', description: 'Price in shallow retracement zone (0-38.2%)' };
      } else if (currentPrice > levels.level618) {
        return { zone: 'middle', description: 'Price in key retracement zone (38.2-61.8%)' };
      } else if (currentPrice > levels.level1000) {
        return { zone: 'lower', description: 'Price in deep retracement zone (61.8-100%)' };
      } else {
        return { zone: 'below_low', description: 'Price below swing low - trend reversal possible' };
      }
    } else {
      // Bearish - levels are inverted
      if (currentPrice < levels.level0) {
        return { zone: 'below_low', description: 'Price below swing low - potential breakdown' };
      } else if (currentPrice < levels.level382) {
        return { zone: 'lower', description: 'Price in shallow retracement zone (0-38.2%)' };
      } else if (currentPrice < levels.level618) {
        return { zone: 'middle', description: 'Price in key retracement zone (38.2-61.8%)' };
      } else if (currentPrice < levels.level1000) {
        return { zone: 'upper', description: 'Price in deep retracement zone (61.8-100%)' };
      } else {
        return { zone: 'above_high', description: 'Price above swing high - trend reversal possible' };
      }
    }
  }
}
