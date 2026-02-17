import { v4 as uuidv4 } from 'uuid';
import type { 
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
    const priceAction = this.analyzePriceAction(recentPrices);

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
        description: 'Price has been climbing steadily'
      };
    } else if (normalizedSlope < -0.1) {
      return { 
        direction: 'DOWN', 
        strength: Math.min(Math.abs(normalizedSlope) * 10, 1),
        description: 'Price has been falling'
      };
    } else {
      return { 
        direction: 'SIDEWAYS', 
        strength: 0,
        description: 'Price has been relatively flat'
      };
    }
  }

  /**
   * Analyze recent price action (momentum, reversals)
   */
  private static analyzePriceAction(prices: PriceData[]): {
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
        description: reversal ? 'Buyers stepping in after a dip' : 'Strong buying pressure'
      };
    } else if (avgChange < -0.1) {
      return { 
        momentum: 'BEARISH', 
        reversal,
        description: reversal ? 'Sellers emerging after a rally' : 'Strong selling pressure'
      };
    } else {
      return { 
        momentum: 'NEUTRAL', 
        reversal: false,
        description: 'Neither buyers nor sellers in control'
      };
    }
  }

  /**
   * Determine signal type and strength based on all factors
   */
  private static determineSignal(
    _currentPrice: number,
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
   * Written in conversational, easy-to-understand language
   */
  private static generateExplanation(
    type: SignalType,
    strength: SignalStrength,
    currentPrice: number,
    fibLevels: FibonacciLevels,
    nearest: ReturnType<typeof FibonacciService.findNearestLevel>,
    _position: ReturnType<typeof FibonacciService.analyzePosition>,
    trend: ReturnType<typeof SignalService.analyzeTrend>,
    priceAction: ReturnType<typeof SignalService.analyzePriceAction>
  ): string {
    const price = currentPrice.toFixed(2);
    const fibPrice = nearest.value.toFixed(2);
    const level = nearest.level;
    const swingHigh = fibLevels.high.toFixed(2);
    const swingLow = fibLevels.low.toFixed(2);
    const isBullishTrend = fibLevels.direction === 'bullish';

    const parts: string[] = [];

    // 1. THE SETUP - What's happening right now
    parts.push(`📍 **What's Happening:**`);
    parts.push(`Gold just hit $${price}, which is right at the ${level} Fibonacci level ($${fibPrice}).`);

    // 2. THE CONTEXT - Why this level matters
    parts.push(`\n\n📐 **Why This Level Matters:**`);
    
    if (isBullishTrend) {
      parts.push(`Gold recently rallied from $${swingLow} up to $${swingHigh}. `);
      parts.push(`After a big move like that, prices often pull back before continuing higher. `);
      parts.push(`Traders watch Fibonacci levels to find where these pullbacks might stop.`);
    } else {
      parts.push(`Gold recently fell from $${swingHigh} down to $${swingLow}. `);
      parts.push(`After a big drop, prices often bounce before falling further. `);
      parts.push(`Traders watch Fibonacci levels to find where these bounces might stall.`);
    }

    // 3. THE FIBONACCI LEVEL EXPLANATION
    parts.push(`\n\n🎯 **About the ${level} Level:**`);
    
    if (level === '38.2%') {
      parts.push(`This is a shallow pullback level. When price only drops to 38.2%, it usually means the trend is strong. `);
      parts.push(`Think of it like a car briefly slowing down before speeding up again.`);
    } else if (level === '50%') {
      parts.push(`The 50% level is a psychological midpoint – halfway between the high and low. `);
      parts.push(`Many traders see this as a "fair value" zone where buyers and sellers meet.`);
    } else if (level === '61.8%') {
      parts.push(`This is the famous "Golden Ratio" level – the most important Fibonacci number. `);
      parts.push(`When price holds here, it's often the last stand before the trend resumes. `);
      parts.push(`A bounce from 61.8% is considered a high-probability trade setup.`);
    } else if (level === '78.6%') {
      parts.push(`This is a deep pullback – the trend is being seriously tested. `);
      parts.push(`If price holds here, it could mean a strong reversal. But if it breaks, the trend may be over.`);
    } else if (level === '23.6%') {
      parts.push(`This is a very shallow retracement – the trend is extremely strong. `);
      parts.push(`Price barely pulled back before buyers/sellers jumped back in.`);
    } else {
      parts.push(`Price is at an extreme level of the recent range.`);
    }

    // 4. THE SIGNAL REASONING
    parts.push(`\n\n💡 **Why ${type} Now:**`);
    
    if (type === 'BUY') {
      if (isBullishTrend) {
        parts.push(`The bigger picture is bullish (gold was going up). `);
        parts.push(`This pullback to the ${level} level looks like a buying opportunity – `);
        parts.push(`a chance to get in at a lower price before the uptrend continues.`);
        
        if (priceAction.reversal) {
          parts.push(` We're also seeing early signs of buyers stepping back in.`);
        }
        if (priceAction.momentum === 'BULLISH') {
          parts.push(` Recent price action shows buying pressure building.`);
        }
      } else {
        parts.push(`Even though the trend has been down, price has fallen so far that `);
        parts.push(`sellers might be exhausted. ${priceAction.description}. `);
        parts.push(`This could be a reversal point.`);
      }
    } else { // SELL
      if (!isBullishTrend) {
        parts.push(`The bigger picture is bearish (gold was falling). `);
        parts.push(`This bounce to the ${level} level looks like a selling opportunity – `);
        parts.push(`a chance to sell at a higher price before the downtrend continues.`);
        
        if (priceAction.reversal) {
          parts.push(` We're also seeing early signs of sellers taking control.`);
        }
        if (priceAction.momentum === 'BEARISH') {
          parts.push(` Recent price action shows selling pressure building.`);
        }
      } else {
        parts.push(`Gold pushed above the recent high, but momentum is fading. `);
        parts.push(`${priceAction.description}. `);
        parts.push(`This could be a good spot to take profits or consider shorting.`);
      }
    }

    // 5. TREND CONTEXT
    parts.push(`\n\n📊 **Current Momentum:**`);
    parts.push(`${trend.description}. ${priceAction.description}.`);

    // 6. SIGNAL STRENGTH EXPLANATION  
    parts.push(`\n\n⚡ **Signal Strength: ${strength}**`);
    
    if (strength === 'STRONG') {
      parts.push(`Multiple factors are lining up: `);
      parts.push(`price is at a key Fibonacci level, `);
      parts.push(`the trend direction supports this trade, `);
      parts.push(`and recent price action confirms the setup. `);
      parts.push(`This is a higher-confidence opportunity.`);
    } else if (strength === 'MODERATE') {
      parts.push(`The setup looks decent but not perfect. `);
      parts.push(`The Fibonacci level is significant and the trend context is right, `);
      parts.push(`but we'd like to see more confirmation. `);
      parts.push(`Consider a smaller position size.`);
    } else {
      parts.push(`This is an early or tentative signal. `);
      parts.push(`The level is minor or confirmation is lacking. `);
      parts.push(`Wait for more evidence before acting, or skip this one.`);
    }

    // 7. RISK WARNING
    parts.push(`\n\n⚠️ **Important:**`);
    parts.push(`This is analysis, not advice. Fibonacci levels work because many traders watch them – `);
    parts.push(`but they don't work every time. Always manage your risk and never trade more than you can afford to lose.`);

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
