import { v4 as uuidv4 } from 'uuid';
import { 
  PriceData, 
  FibonacciLevels, 
  TradingSignal, 
  SignalType, 
  SignalStrength,
  GoldQuote 
} from '../types/trading';
import { FibonacciService } from './FibonacciService';

/**
 * Signal Generation Service
 * 
 * Generates buy/sell signals based on Fibonacci retracement analysis
 * with plain-language explanations for context.
 */

export class SignalService {
  private static readonly PROXIMITY_THRESHOLD = 0.5; // 0.5% proximity to fib level
  private static readonly STRONG_THRESHOLD = 0.2;    // 0.2% for strong signal

  /**
   * Generate a trading signal with full explanation
   */
  static generateSignal(
    currentQuote: GoldQuote,
    fibLevels: FibonacciLevels,
    recentPrices: PriceData[]
  ): TradingSignal | null {
    const currentPrice = currentQuote.price;
    const nearest = FibonacciService.findNearestLevel(currentPrice, fibLevels);
    const position = FibonacciService.analyzePosition(currentPrice, fibLevels);
    const trend = this.analyzeTrend(recentPrices);
    const priceAction = this.analyzePriceAction(recentPrices, currentPrice);

    // Determine signal type and strength
    const { type, strength } = this.determineSignal(
      currentPrice,
      fibLevels,
      nearest,
      position,
      trend,
      priceAction
    );

    // Don't generate HOLD signals as actual signals
    if (type === 'HOLD') {
      return null;
    }

    // Generate plain-language explanation
    const explanation = this.generateExplanation(
      type,
      strength,
      currentPrice,
      fibLevels,
      nearest,
      position,
      trend,
      priceAction
    );

    return {
      id: uuidv4(),
      type,
      strength,
      price: currentPrice,
      timestamp: Date.now(),
      fibLevel: nearest.level,
      fibValue: nearest.value,
      explanation,
      technicalDetails: {
        currentPrice,
        nearestFibLevel: nearest.level,
        distanceToLevel: nearest.distance,
        trendDirection: trend.direction,
        priceAction: priceAction.description,
      },
    };
  }

  /**
   * Analyze recent price trend
   */
  private static analyzeTrend(prices: PriceData[]): {
    direction: 'UP' | 'DOWN' | 'SIDEWAYS';
    strength: number;
    description: string;
  } {
    if (prices.length < 5) {
      return { direction: 'SIDEWAYS', strength: 0, description: 'Insufficient data' };
    }

    const recent = prices.slice(-10);
    const closes = recent.map(p => p.close);
    
    // Simple linear regression slope
    const n = closes.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = closes.reduce((a, b) => a + b, 0);
    const sumXY = closes.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgPrice = sumY / n;
    const normalizedSlope = (slope / avgPrice) * 100;

    if (normalizedSlope > 0.1) {
      return { 
        direction: 'UP', 
        strength: Math.min(normalizedSlope * 10, 1),
        description: 'Price trending upward'
      };
    } else if (normalizedSlope < -0.1) {
      return { 
        direction: 'DOWN', 
        strength: Math.min(Math.abs(normalizedSlope) * 10, 1),
        description: 'Price trending downward'
      };
    } else {
      return { 
        direction: 'SIDEWAYS', 
        strength: 0,
        description: 'Price moving sideways'
      };
    }
  }

  /**
   * Analyze recent price action (momentum, reversals)
   */
  private static analyzePriceAction(prices: PriceData[], currentPrice: number): {
    momentum: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    reversal: boolean;
    description: string;
  } {
    if (prices.length < 3) {
      return { momentum: 'NEUTRAL', reversal: false, description: 'Awaiting more data' };
    }

    const last3 = prices.slice(-3);
    const changes = last3.map((p, i) => 
      i === 0 ? 0 : ((p.close - last3[i-1].close) / last3[i-1].close) * 100
    ).slice(1);

    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
    const lastChange = changes[changes.length - 1];

    // Check for reversal pattern
    const reversal = (changes[0] > 0 && lastChange < 0) || (changes[0] < 0 && lastChange > 0);

    if (avgChange > 0.1) {
      return { 
        momentum: 'BULLISH', 
        reversal,
        description: reversal ? 'Bullish momentum with potential reversal' : 'Strong bullish momentum'
      };
    } else if (avgChange < -0.1) {
      return { 
        momentum: 'BEARISH', 
        reversal,
        description: reversal ? 'Bearish momentum with potential reversal' : 'Strong bearish momentum'
      };
    } else {
      return { 
        momentum: 'NEUTRAL', 
        reversal: false,
        description: 'Neutral price action'
      };
    }
  }

  /**
   * Determine signal type and strength based on all factors
   */
  private static determineSignal(
    currentPrice: number,
    fibLevels: FibonacciLevels,
    nearest: ReturnType<typeof FibonacciService.findNearestLevel>,
    position: ReturnType<typeof FibonacciService.analyzePosition>,
    trend: ReturnType<typeof SignalService.analyzeTrend>,
    priceAction: ReturnType<typeof SignalService.analyzePriceAction>
  ): { type: SignalType; strength: SignalStrength } {
    const { direction } = fibLevels;
    const atKeyLevel = nearest.percentDistance < this.PROXIMITY_THRESHOLD;
    const isStrongLevel = ['38.2%', '50%', '61.8%'].includes(nearest.level);

    // BULLISH trend context
    if (direction === 'bullish') {
      // BUY signals: price retracing to support at key Fib levels
      if (atKeyLevel && isStrongLevel && position.zone === 'middle') {
        if (priceAction.momentum === 'BULLISH' || priceAction.reversal) {
          return { type: 'BUY', strength: 'STRONG' };
        }
        return { type: 'BUY', strength: 'MODERATE' };
      }

      // BUY at deep retracement (61.8% or 78.6%)
      if (atKeyLevel && ['61.8%', '78.6%'].includes(nearest.level)) {
        if (trend.direction !== 'DOWN') {
          return { type: 'BUY', strength: priceAction.reversal ? 'STRONG' : 'MODERATE' };
        }
      }

      // SELL signals: price extended above resistance
      if (position.zone === 'above_high' && priceAction.momentum === 'BEARISH') {
        return { type: 'SELL', strength: 'MODERATE' };
      }

      // Weak BUY near 38.2% in uptrend
      if (atKeyLevel && nearest.level === '38.2%' && trend.direction === 'UP') {
        return { type: 'BUY', strength: 'WEAK' };
      }
    }

    // BEARISH trend context
    if (direction === 'bearish') {
      // SELL signals: price retracing to resistance at key Fib levels
      if (atKeyLevel && isStrongLevel && position.zone === 'middle') {
        if (priceAction.momentum === 'BEARISH' || priceAction.reversal) {
          return { type: 'SELL', strength: 'STRONG' };
        }
        return { type: 'SELL', strength: 'MODERATE' };
      }

      // SELL at deep retracement
      if (atKeyLevel && ['61.8%', '78.6%'].includes(nearest.level)) {
        if (trend.direction !== 'UP') {
          return { type: 'SELL', strength: priceAction.reversal ? 'STRONG' : 'MODERATE' };
        }
      }

      // BUY signals: price breaking below support (trend exhaustion)
      if (position.zone === 'below_low' && priceAction.momentum === 'BULLISH') {
        return { type: 'BUY', strength: 'MODERATE' };
      }
    }

    return { type: 'HOLD', strength: 'WEAK' };
  }

  /**
   * Generate plain-language explanation for the signal
   */
  private static generateExplanation(
    type: SignalType,
    strength: SignalStrength,
    currentPrice: number,
    fibLevels: FibonacciLevels,
    nearest: ReturnType<typeof FibonacciService.findNearestLevel>,
    position: ReturnType<typeof FibonacciService.analyzePosition>,
    trend: ReturnType<typeof SignalService.analyzeTrend>,
    priceAction: ReturnType<typeof SignalService.analyzePriceAction>
  ): string {
    const priceStr = `$${currentPrice.toFixed(2)}`;
    const fibStr = `$${nearest.value.toFixed(2)}`;
    const levelStr = nearest.level;
    const trendStr = fibLevels.direction === 'bullish' ? 'uptrend' : 'downtrend';

    const parts: string[] = [];

    // Opening context
    if (type === 'BUY') {
      parts.push(`🟢 BUY SIGNAL (${strength})`);
    } else {
      parts.push(`🔴 SELL SIGNAL (${strength})`);
    }

    // Price and level context
    parts.push(`\nGold is currently trading at ${priceStr}, which is very close to the ${levelStr} Fibonacci retracement level at ${fibStr}.`);

    // Trend context
    if (fibLevels.direction === 'bullish') {
      parts.push(`\nThe overall trend has been bullish, with a recent swing from $${fibLevels.low.toFixed(2)} to $${fibLevels.high.toFixed(2)}.`);
    } else {
      parts.push(`\nThe overall trend has been bearish, with a recent swing from $${fibLevels.high.toFixed(2)} down to $${fibLevels.low.toFixed(2)}.`);
    }

    // Why this signal?
    if (type === 'BUY') {
      if (fibLevels.direction === 'bullish') {
        parts.push(`\n\n📊 Why Buy Here?\nIn a ${trendStr}, the ${levelStr} level often acts as support where buyers step in.`);
        
        if (nearest.level === '38.2%') {
          parts.push(` A 38.2% retracement is considered shallow, suggesting the trend is strong and this pullback offers a good entry point.`);
        } else if (nearest.level === '50%') {
          parts.push(` The 50% level is a psychological midpoint where many traders look to buy the dip.`);
        } else if (nearest.level === '61.8%') {
          parts.push(` The 61.8% level (golden ratio) is the most significant Fibonacci level. Price holding here strongly suggests the uptrend will resume.`);
        } else if (nearest.level === '78.6%') {
          parts.push(` This is a deep retracement. While riskier, if price holds here, it often signals a strong reversal.`);
        }

        if (priceAction.reversal) {
          parts.push(` We're also seeing early signs of a bullish reversal in recent price action.`);
        }
      } else {
        parts.push(`\n\n📊 Why Buy Here?\nAlthough the trend has been bearish, price has dropped below the swing low, potentially indicating seller exhaustion and a trend reversal.`);
      }
    } else { // SELL
      if (fibLevels.direction === 'bearish') {
        parts.push(`\n\n📊 Why Sell Here?\nIn a ${trendStr}, the ${levelStr} level often acts as resistance where sellers step in.`);
        
        if (nearest.level === '38.2%') {
          parts.push(` A 38.2% retracement is shallow, suggesting selling pressure remains strong.`);
        } else if (nearest.level === '50%') {
          parts.push(` The 50% level is a key psychological level where sellers often defend.`);
        } else if (nearest.level === '61.8%') {
          parts.push(` The 61.8% level (golden ratio) is critical resistance. Rejection here confirms the downtrend.`);
        }

        if (priceAction.reversal) {
          parts.push(` Recent price action shows signs of bearish reversal.`);
        }
      } else {
        parts.push(`\n\n📊 Why Sell Here?\nPrice has pushed above the recent swing high and momentum is fading. This could be a good opportunity to take profits or initiate shorts.`);
      }
    }

    // Risk note
    parts.push(`\n\n⚠️ Risk Note: Signal strength is ${strength.toLowerCase()}. `);
    if (strength === 'STRONG') {
      parts.push(`Multiple factors align for high confidence.`);
    } else if (strength === 'MODERATE') {
      parts.push(`Consider position sizing accordingly.`);
    } else {
      parts.push(`Use caution and wait for confirmation.`);
    }

    return parts.join('');
  }

  /**
   * Check if a new signal should be generated (avoid spam)
   */
  static shouldGenerateSignal(
    lastSignal: TradingSignal | null,
    currentPrice: number,
    minTimeDiffMs: number = 300000, // 5 minutes
    minPriceDiffPercent: number = 0.3
  ): boolean {
    if (!lastSignal) return true;

    const timeDiff = Date.now() - lastSignal.timestamp;
    const priceDiff = Math.abs((currentPrice - lastSignal.price) / lastSignal.price) * 100;

    return timeDiff > minTimeDiffMs || priceDiff > minPriceDiffPercent;
  }
}
