/**
 * Pattern Detection Service
 * Identifies candlestick and chart patterns in price data
 */

import type { PriceData } from '../types/trading';

// Pattern types
export type PatternType = 'candlestick' | 'chart';
export type PatternSignal = 'bullish' | 'bearish' | 'neutral';
export type PatternReliability = 'high' | 'medium' | 'low';

export interface DetectedPattern {
  id: string;
  name: string;
  type: PatternType;
  signal: PatternSignal;
  reliability: PatternReliability;
  description: string;
  outcome: string;  // Expected short-term outcome
  successRate: number;  // Historical success rate percentage
  targetMove: string;  // Expected price movement
  timeframe: string;  // How long the pattern typically plays out
  detectedAt: Date;
  startIndex: number;
  endIndex: number;
  priceAtDetection: number;
  confirmationLevel?: number;  // Price level that confirms the pattern
}

export interface PatternDefinition {
  name: string;
  type: PatternType;
  signal: PatternSignal;
  reliability: PatternReliability;
  barsRequired: number;
  description: string;
  outcome: string;
  successRate: number;
  targetMove: string;
  timeframe: string;
  detect: (data: PriceData[], index: number) => boolean;
  getConfirmation?: (data: PriceData[], index: number) => number | undefined;
}

// Helper functions
const bodySize = (candle: PriceData): number => Math.abs(candle.close - candle.open);
const upperWick = (candle: PriceData): number => candle.high - Math.max(candle.open, candle.close);
const lowerWick = (candle: PriceData): number => Math.min(candle.open, candle.close) - candle.low;
const totalRange = (candle: PriceData): number => candle.high - candle.low;
const isBullish = (candle: PriceData): boolean => candle.close > candle.open;
const isBearish = (candle: PriceData): boolean => candle.close < candle.open;
const avgBody = (data: PriceData[], index: number, periods: number = 10): number => {
  const start = Math.max(0, index - periods);
  let sum = 0;
  for (let i = start; i < index; i++) {
    sum += bodySize(data[i]);
  }
  return sum / (index - start) || 1;
};

// Candlestick Pattern Definitions
const CANDLESTICK_PATTERNS: PatternDefinition[] = [
  // === SINGLE BAR PATTERNS ===
  {
    name: 'Doji',
    type: 'candlestick',
    signal: 'neutral',
    reliability: 'medium',
    barsRequired: 1,
    description: 'A candle where open and close are nearly equal, forming a cross shape. Indicates market indecision.',
    outcome: 'Often signals a reversal when appearing after a strong trend. In an uptrend, suggests bulls are losing control. In a downtrend, suggests bears are exhausting. Wait for the next candle to confirm direction.',
    successRate: 52,
    targetMove: '0.5-1% reversal or continuation',
    timeframe: '1-3 candles',
    detect: (data, index) => {
      const candle = data[index];
      const range = totalRange(candle);
      const body = bodySize(candle);
      return range > 0 && body / range < 0.1;
    }
  },
  {
    name: 'Hammer',
    type: 'candlestick',
    signal: 'bullish',
    reliability: 'high',
    barsRequired: 1,
    description: 'Small body at top with long lower wick (2x+ body size). Appears after a downtrend.',
    outcome: 'Strong bullish reversal signal. The long lower wick shows sellers pushed price down but buyers regained control. Expect a bounce of 1-3% over the next few sessions. Confirmation: next candle closes above hammer\'s high.',
    successRate: 60,
    targetMove: '1-3% upward',
    timeframe: '2-5 candles',
    detect: (data, index) => {
      if (index < 5) return false;
      const candle = data[index];
      const body = bodySize(candle);
      const lWick = lowerWick(candle);
      const uWick = upperWick(candle);
      
      // Check for downtrend (lower lows in last 5 candles)
      let downtrend = true;
      for (let i = index - 4; i < index; i++) {
        if (data[i].close > data[i - 1].close) {
          downtrend = false;
          break;
        }
      }
      
      return downtrend && 
             lWick >= body * 2 && 
             uWick < body * 0.5 &&
             body > 0;
    },
    getConfirmation: (data, index) => data[index].high
  },
  {
    name: 'Hanging Man',
    type: 'candlestick',
    signal: 'bearish',
    reliability: 'medium',
    barsRequired: 1,
    description: 'Same shape as hammer but appears after an uptrend. Small body at top with long lower wick.',
    outcome: 'Warns of potential top. Despite the bullish-looking recovery, sellers tested lower prices. A bearish confirmation candle suggests 1-2% decline. Less reliable than hammer; needs confirmation.',
    successRate: 55,
    targetMove: '1-2% downward',
    timeframe: '2-5 candles',
    detect: (data, index) => {
      if (index < 5) return false;
      const candle = data[index];
      const body = bodySize(candle);
      const lWick = lowerWick(candle);
      const uWick = upperWick(candle);
      
      // Check for uptrend
      let uptrend = true;
      for (let i = index - 4; i < index; i++) {
        if (data[i].close < data[i - 1].close) {
          uptrend = false;
          break;
        }
      }
      
      return uptrend && 
             lWick >= body * 2 && 
             uWick < body * 0.5 &&
             body > 0;
    },
    getConfirmation: (data, index) => data[index].low
  },
  {
    name: 'Shooting Star',
    type: 'candlestick',
    signal: 'bearish',
    reliability: 'high',
    barsRequired: 1,
    description: 'Small body at bottom with long upper wick (2x+ body). Appears after an uptrend.',
    outcome: 'Bearish reversal signal. Bulls pushed price up but couldn\'t hold gains — sellers took over. Expect 1.5-3% decline. Very reliable at resistance levels. Confirmation: next candle closes below star\'s low.',
    successRate: 63,
    targetMove: '1.5-3% downward',
    timeframe: '2-5 candles',
    detect: (data, index) => {
      if (index < 5) return false;
      const candle = data[index];
      const body = bodySize(candle);
      const lWick = lowerWick(candle);
      const uWick = upperWick(candle);
      
      // Check for uptrend
      let uptrend = true;
      for (let i = index - 4; i < index; i++) {
        if (data[i].close < data[i - 1].close) {
          uptrend = false;
          break;
        }
      }
      
      return uptrend && 
             uWick >= body * 2 && 
             lWick < body * 0.5 &&
             body > 0;
    },
    getConfirmation: (data, index) => data[index].low
  },
  {
    name: 'Inverted Hammer',
    type: 'candlestick',
    signal: 'bullish',
    reliability: 'medium',
    barsRequired: 1,
    description: 'Small body at bottom with long upper wick. Appears after a downtrend.',
    outcome: 'Potential bullish reversal. Buyers attempted to push price up — though they failed, it shows buying interest is returning. Needs strong confirmation. Expect 1-2% bounce if confirmed.',
    successRate: 55,
    targetMove: '1-2% upward',
    timeframe: '2-4 candles',
    detect: (data, index) => {
      if (index < 5) return false;
      const candle = data[index];
      const body = bodySize(candle);
      const lWick = lowerWick(candle);
      const uWick = upperWick(candle);
      
      // Check for downtrend
      let downtrend = true;
      for (let i = index - 4; i < index; i++) {
        if (data[i].close > data[i - 1].close) {
          downtrend = false;
          break;
        }
      }
      
      return downtrend && 
             uWick >= body * 2 && 
             lWick < body * 0.5 &&
             body > 0;
    },
    getConfirmation: (data, index) => data[index].high
  },
  {
    name: 'Marubozu (Bullish)',
    type: 'candlestick',
    signal: 'bullish',
    reliability: 'high',
    barsRequired: 1,
    description: 'Long bullish candle with no or minimal wicks. Shows complete buyer dominance.',
    outcome: 'Strong continuation signal. Buyers controlled the entire session with no meaningful pullback. Expect momentum to continue for 2-3 more candles. Often marks the start of a strong move.',
    successRate: 65,
    targetMove: '1-2% continuation',
    timeframe: '2-4 candles',
    detect: (data, index) => {
      const candle = data[index];
      const body = bodySize(candle);
      const range = totalRange(candle);
      const avg = avgBody(data, index);
      
      return isBullish(candle) && 
             body / range > 0.9 &&
             body > avg * 1.5;
    }
  },
  {
    name: 'Marubozu (Bearish)',
    type: 'candlestick',
    signal: 'bearish',
    reliability: 'high',
    barsRequired: 1,
    description: 'Long bearish candle with no or minimal wicks. Shows complete seller dominance.',
    outcome: 'Strong bearish continuation. Sellers controlled the entire session. Expect further downside for 2-3 candles. Watch for support levels that may halt the move.',
    successRate: 65,
    targetMove: '1-2% continuation down',
    timeframe: '2-4 candles',
    detect: (data, index) => {
      const candle = data[index];
      const body = bodySize(candle);
      const range = totalRange(candle);
      const avg = avgBody(data, index);
      
      return isBearish(candle) && 
             body / range > 0.9 &&
             body > avg * 1.5;
    }
  },

  // === TWO BAR PATTERNS ===
  {
    name: 'Bullish Engulfing',
    type: 'candlestick',
    signal: 'bullish',
    reliability: 'high',
    barsRequired: 2,
    description: 'A large bullish candle completely engulfs the previous bearish candle. Shows dramatic shift to buying.',
    outcome: 'One of the most reliable reversal patterns. Buyers overwhelmed sellers completely. Expect 2-4% upside over 3-5 candles. Best when appearing at support or after extended downtrend.',
    successRate: 68,
    targetMove: '2-4% upward',
    timeframe: '3-7 candles',
    detect: (data, index) => {
      if (index < 1) return false;
      const current = data[index];
      const previous = data[index - 1];
      
      return isBearish(previous) &&
             isBullish(current) &&
             current.open < previous.close &&
             current.close > previous.open &&
             bodySize(current) > bodySize(previous) * 1.2;
    },
    getConfirmation: (data, index) => data[index].high
  },
  {
    name: 'Bearish Engulfing',
    type: 'candlestick',
    signal: 'bearish',
    reliability: 'high',
    barsRequired: 2,
    description: 'A large bearish candle completely engulfs the previous bullish candle. Shows dramatic shift to selling.',
    outcome: 'Powerful reversal signal. Sellers overwhelmed buyers completely. Expect 2-4% downside over 3-5 candles. Very reliable at resistance levels or after extended rallies.',
    successRate: 68,
    targetMove: '2-4% downward',
    timeframe: '3-7 candles',
    detect: (data, index) => {
      if (index < 1) return false;
      const current = data[index];
      const previous = data[index - 1];
      
      return isBullish(previous) &&
             isBearish(current) &&
             current.open > previous.close &&
             current.close < previous.open &&
             bodySize(current) > bodySize(previous) * 1.2;
    },
    getConfirmation: (data, index) => data[index].low
  },
  {
    name: 'Bullish Harami',
    type: 'candlestick',
    signal: 'bullish',
    reliability: 'medium',
    barsRequired: 2,
    description: 'Small bullish candle contained within the body of the previous large bearish candle. "Harami" means pregnant.',
    outcome: 'Suggests selling pressure is diminishing. Less powerful than engulfing but still noteworthy. Expect 1-2% bounce if confirmed. Best with third-candle confirmation closing above harami high.',
    successRate: 53,
    targetMove: '1-2% upward',
    timeframe: '2-5 candles',
    detect: (data, index) => {
      if (index < 1) return false;
      const current = data[index];
      const previous = data[index - 1];
      
      return isBearish(previous) &&
             isBullish(current) &&
             current.open > previous.close &&
             current.close < previous.open &&
             bodySize(current) < bodySize(previous) * 0.5;
    }
  },
  {
    name: 'Bearish Harami',
    type: 'candlestick',
    signal: 'bearish',
    reliability: 'medium',
    barsRequired: 2,
    description: 'Small bearish candle contained within the body of the previous large bullish candle.',
    outcome: 'Suggests buying pressure is waning. Potential reversal but needs confirmation. Expect 1-2% decline if next candle closes below harami low.',
    successRate: 53,
    targetMove: '1-2% downward',
    timeframe: '2-5 candles',
    detect: (data, index) => {
      if (index < 1) return false;
      const current = data[index];
      const previous = data[index - 1];
      
      return isBullish(previous) &&
             isBearish(current) &&
             current.open < previous.close &&
             current.close > previous.open &&
             bodySize(current) < bodySize(previous) * 0.5;
    }
  },
  {
    name: 'Tweezer Bottom',
    type: 'candlestick',
    signal: 'bullish',
    reliability: 'medium',
    barsRequired: 2,
    description: 'Two candles with matching lows, first bearish, second bullish. Shows price found support.',
    outcome: 'Double test of support held — buyers defended the level twice. Expect 1.5-2.5% bounce. More reliable when the matching low aligns with a known support level.',
    successRate: 58,
    targetMove: '1.5-2.5% upward',
    timeframe: '3-5 candles',
    detect: (data, index) => {
      if (index < 1) return false;
      const current = data[index];
      const previous = data[index - 1];
      const tolerance = totalRange(current) * 0.05;
      
      return isBearish(previous) &&
             isBullish(current) &&
             Math.abs(current.low - previous.low) < tolerance;
    }
  },
  {
    name: 'Tweezer Top',
    type: 'candlestick',
    signal: 'bearish',
    reliability: 'medium',
    barsRequired: 2,
    description: 'Two candles with matching highs, first bullish, second bearish. Shows price found resistance.',
    outcome: 'Double test of resistance failed — sellers rejected price twice at the same level. Expect 1.5-2.5% decline. Very reliable at known resistance levels.',
    successRate: 58,
    targetMove: '1.5-2.5% downward',
    timeframe: '3-5 candles',
    detect: (data, index) => {
      if (index < 1) return false;
      const current = data[index];
      const previous = data[index - 1];
      const tolerance = totalRange(current) * 0.05;
      
      return isBullish(previous) &&
             isBearish(current) &&
             Math.abs(current.high - previous.high) < tolerance;
    }
  },
  {
    name: 'Piercing Line',
    type: 'candlestick',
    signal: 'bullish',
    reliability: 'medium',
    barsRequired: 2,
    description: 'Bullish candle opens below prior low but closes above the midpoint of the prior bearish candle.',
    outcome: 'Shows strong buying emerged despite the gap down. Expect 1.5-2.5% upside. The deeper the penetration into the prior candle, the stronger the signal.',
    successRate: 56,
    targetMove: '1.5-2.5% upward',
    timeframe: '3-5 candles',
    detect: (data, index) => {
      if (index < 1) return false;
      const current = data[index];
      const previous = data[index - 1];
      const prevMidpoint = (previous.open + previous.close) / 2;
      
      return isBearish(previous) &&
             isBullish(current) &&
             current.open < previous.low &&
             current.close > prevMidpoint &&
             current.close < previous.open;
    }
  },
  {
    name: 'Dark Cloud Cover',
    type: 'candlestick',
    signal: 'bearish',
    reliability: 'medium',
    barsRequired: 2,
    description: 'Bearish candle opens above prior high but closes below the midpoint of the prior bullish candle.',
    outcome: 'Opposite of piercing line. Despite the gap up, sellers drove price down significantly. Expect 1.5-2.5% decline. Stronger when it occurs at resistance.',
    successRate: 56,
    targetMove: '1.5-2.5% downward',
    timeframe: '3-5 candles',
    detect: (data, index) => {
      if (index < 1) return false;
      const current = data[index];
      const previous = data[index - 1];
      const prevMidpoint = (previous.open + previous.close) / 2;
      
      return isBullish(previous) &&
             isBearish(current) &&
             current.open > previous.high &&
             current.close < prevMidpoint &&
             current.close > previous.open;
    }
  },

  // === THREE BAR PATTERNS ===
  {
    name: 'Morning Star',
    type: 'candlestick',
    signal: 'bullish',
    reliability: 'high',
    barsRequired: 3,
    description: 'Three-candle reversal: large bearish, small indecision (star), large bullish. Classic bottom pattern.',
    outcome: 'One of the most powerful bullish reversals. The star shows selling exhausted, then buyers took over decisively. Expect 3-5% rally over 5-10 candles. Best at support levels.',
    successRate: 72,
    targetMove: '3-5% upward',
    timeframe: '5-10 candles',
    detect: (data, index) => {
      if (index < 2) return false;
      const first = data[index - 2];
      const star = data[index - 1];
      const third = data[index];
      const avgB = avgBody(data, index);
      
      return isBearish(first) &&
             bodySize(first) > avgB * 0.8 &&
             bodySize(star) < avgB * 0.3 &&
             isBullish(third) &&
             bodySize(third) > avgB * 0.8 &&
             third.close > (first.open + first.close) / 2;
    },
    getConfirmation: (data, index) => data[index].high
  },
  {
    name: 'Evening Star',
    type: 'candlestick',
    signal: 'bearish',
    reliability: 'high',
    barsRequired: 3,
    description: 'Three-candle reversal: large bullish, small indecision (star), large bearish. Classic top pattern.',
    outcome: 'One of the most reliable bearish reversals. The star shows buying exhausted, then sellers took control. Expect 3-5% decline over 5-10 candles. Very powerful at resistance.',
    successRate: 72,
    targetMove: '3-5% downward',
    timeframe: '5-10 candles',
    detect: (data, index) => {
      if (index < 2) return false;
      const first = data[index - 2];
      const star = data[index - 1];
      const third = data[index];
      const avgB = avgBody(data, index);
      
      return isBullish(first) &&
             bodySize(first) > avgB * 0.8 &&
             bodySize(star) < avgB * 0.3 &&
             isBearish(third) &&
             bodySize(third) > avgB * 0.8 &&
             third.close < (first.open + first.close) / 2;
    },
    getConfirmation: (data, index) => data[index].low
  },
  {
    name: 'Three White Soldiers',
    type: 'candlestick',
    signal: 'bullish',
    reliability: 'high',
    barsRequired: 3,
    description: 'Three consecutive long bullish candles, each opening within the prior body and closing higher.',
    outcome: 'Powerful bullish continuation/reversal. Shows sustained buying pressure over 3 sessions. Expect 3-6% more upside. Watch for exhaustion if candles shrink or show long upper wicks.',
    successRate: 70,
    targetMove: '3-6% upward',
    timeframe: '5-10 candles',
    detect: (data, index) => {
      if (index < 2) return false;
      const first = data[index - 2];
      const second = data[index - 1];
      const third = data[index];
      const avgB = avgBody(data, index);
      
      return isBullish(first) && isBullish(second) && isBullish(third) &&
             bodySize(first) > avgB * 0.7 &&
             bodySize(second) > avgB * 0.7 &&
             bodySize(third) > avgB * 0.7 &&
             second.open > first.open && second.open < first.close &&
             third.open > second.open && third.open < second.close &&
             second.close > first.close &&
             third.close > second.close;
    }
  },
  {
    name: 'Three Black Crows',
    type: 'candlestick',
    signal: 'bearish',
    reliability: 'high',
    barsRequired: 3,
    description: 'Three consecutive long bearish candles, each opening within the prior body and closing lower.',
    outcome: 'Powerful bearish continuation. Shows sustained selling pressure. Expect 3-6% more downside. Very reliable after uptrends. Watch for support levels that may halt decline.',
    successRate: 70,
    targetMove: '3-6% downward',
    timeframe: '5-10 candles',
    detect: (data, index) => {
      if (index < 2) return false;
      const first = data[index - 2];
      const second = data[index - 1];
      const third = data[index];
      const avgB = avgBody(data, index);
      
      return isBearish(first) && isBearish(second) && isBearish(third) &&
             bodySize(first) > avgB * 0.7 &&
             bodySize(second) > avgB * 0.7 &&
             bodySize(third) > avgB * 0.7 &&
             second.open < first.open && second.open > first.close &&
             third.open < second.open && third.open > second.close &&
             second.close < first.close &&
             third.close < second.close;
    }
  },
  {
    name: 'Three Inside Up',
    type: 'candlestick',
    signal: 'bullish',
    reliability: 'high',
    barsRequired: 3,
    description: 'Bearish candle, then bullish harami, then bullish candle closing above the first candle\'s open.',
    outcome: 'Confirmed harami reversal. The third candle provides confirmation that buyers have taken control. Expect 2-4% upside over 3-7 candles.',
    successRate: 65,
    targetMove: '2-4% upward',
    timeframe: '3-7 candles',
    detect: (data, index) => {
      if (index < 2) return false;
      const first = data[index - 2];
      const second = data[index - 1];
      const third = data[index];
      
      // First: large bearish
      // Second: small bullish inside first
      // Third: bullish closing above first's open
      return isBearish(first) &&
             isBullish(second) &&
             second.open > first.close &&
             second.close < first.open &&
             isBullish(third) &&
             third.close > first.open;
    }
  },
  {
    name: 'Three Inside Down',
    type: 'candlestick',
    signal: 'bearish',
    reliability: 'high',
    barsRequired: 3,
    description: 'Bullish candle, then bearish harami, then bearish candle closing below the first candle\'s open.',
    outcome: 'Confirmed harami reversal to the downside. Third candle confirms sellers have taken control. Expect 2-4% decline over 3-7 candles.',
    successRate: 65,
    targetMove: '2-4% downward',
    timeframe: '3-7 candles',
    detect: (data, index) => {
      if (index < 2) return false;
      const first = data[index - 2];
      const second = data[index - 1];
      const third = data[index];
      
      return isBullish(first) &&
             isBearish(second) &&
             second.open < first.close &&
             second.close > first.open &&
             isBearish(third) &&
             third.close < first.open;
    }
  }
];

// Chart Pattern Definitions (multi-bar geometric patterns)
const CHART_PATTERNS: PatternDefinition[] = [
  {
    name: 'Double Bottom',
    type: 'chart',
    signal: 'bullish',
    reliability: 'high',
    barsRequired: 15,
    description: 'Price forms two distinct lows at approximately the same level, with a peak between them. Classic "W" shape.',
    outcome: 'Strong reversal pattern. The equal lows show strong support that held twice. Target is typically the height of the pattern added to the breakout point. Expect 4-8% rally after neckline break.',
    successRate: 72,
    targetMove: '4-8% upward',
    timeframe: '10-20 candles',
    detect: (data, index) => {
      if (index < 14) return false;
      
      // Look for W pattern in last 15-30 bars
      const window = data.slice(Math.max(0, index - 25), index + 1);
      if (window.length < 15) return false;
      
      // Find two lowest points
      let low1Idx = 0, low2Idx = 0;
      let low1 = Infinity, low2 = Infinity;
      
      for (let i = 0; i < window.length - 5; i++) {
        if (window[i].low < low1) {
          low1 = window[i].low;
          low1Idx = i;
        }
      }
      
      // Find second low at least 5 bars away
      for (let i = low1Idx + 5; i < window.length; i++) {
        if (window[i].low < low2) {
          low2 = window[i].low;
          low2Idx = i;
        }
      }
      
      if (low2Idx <= low1Idx + 5) return false;
      
      // Check lows are within 1% of each other
      const tolerance = low1 * 0.01;
      if (Math.abs(low1 - low2) > tolerance) return false;
      
      // Find peak between lows
      let peak = 0;
      for (let i = low1Idx; i <= low2Idx; i++) {
        if (window[i].high > peak) peak = window[i].high;
      }
      
      // Peak should be at least 2% above lows
      if (peak < low1 * 1.02) return false;
      
      // Current price should be near or above the peak (neckline)
      const current = window[window.length - 1];
      return current.close > peak * 0.98;
    },
    getConfirmation: (data, index) => {
      const window = data.slice(Math.max(0, index - 25), index + 1);
      let peak = 0;
      for (const candle of window) {
        if (candle.high > peak) peak = candle.high;
      }
      return peak;
    }
  },
  {
    name: 'Double Top',
    type: 'chart',
    signal: 'bearish',
    reliability: 'high',
    barsRequired: 15,
    description: 'Price forms two distinct highs at approximately the same level, with a trough between them. Classic "M" shape.',
    outcome: 'Strong reversal pattern. The equal highs show strong resistance that rejected price twice. Target is the pattern height subtracted from breakdown point. Expect 4-8% decline after neckline break.',
    successRate: 72,
    targetMove: '4-8% downward',
    timeframe: '10-20 candles',
    detect: (data, index) => {
      if (index < 14) return false;
      
      const window = data.slice(Math.max(0, index - 25), index + 1);
      if (window.length < 15) return false;
      
      // Find two highest points
      let high1Idx = 0, high2Idx = 0;
      let high1 = 0, high2 = 0;
      
      for (let i = 0; i < window.length - 5; i++) {
        if (window[i].high > high1) {
          high1 = window[i].high;
          high1Idx = i;
        }
      }
      
      for (let i = high1Idx + 5; i < window.length; i++) {
        if (window[i].high > high2) {
          high2 = window[i].high;
          high2Idx = i;
        }
      }
      
      if (high2Idx <= high1Idx + 5) return false;
      
      const tolerance = high1 * 0.01;
      if (Math.abs(high1 - high2) > tolerance) return false;
      
      // Find trough between highs
      let trough = Infinity;
      for (let i = high1Idx; i <= high2Idx; i++) {
        if (window[i].low < trough) trough = window[i].low;
      }
      
      if (trough > high1 * 0.98) return false;
      
      const current = window[window.length - 1];
      return current.close < trough * 1.02;
    },
    getConfirmation: (data, index) => {
      const window = data.slice(Math.max(0, index - 25), index + 1);
      let trough = Infinity;
      for (const candle of window) {
        if (candle.low < trough) trough = candle.low;
      }
      return trough;
    }
  },
  {
    name: 'Ascending Triangle',
    type: 'chart',
    signal: 'bullish',
    reliability: 'high',
    barsRequired: 10,
    description: 'Flat resistance line with rising support (higher lows). Price compresses into the apex.',
    outcome: 'Typically breaks upward through resistance. The rising lows show persistent buying pressure. Target is the triangle height added to breakout. Expect 3-6% rally on confirmed breakout.',
    successRate: 68,
    targetMove: '3-6% upward',
    timeframe: '5-15 candles',
    detect: (data, index) => {
      if (index < 10) return false;
      
      const window = data.slice(index - 10, index + 1);
      
      // Check for flat highs (resistance)
      const highs = window.map(c => c.high);
      const maxHigh = Math.max(...highs);
      const flatHighs = highs.filter(h => h > maxHigh * 0.99).length >= 3;
      
      // Check for rising lows
      const lows = window.map(c => c.low);
      let risingLows = true;
      for (let i = 2; i < lows.length; i += 2) {
        if (lows[i] < lows[i - 2]) {
          risingLows = false;
          break;
        }
      }
      
      return flatHighs && risingLows && (lows[lows.length - 1] > lows[0]);
    },
    getConfirmation: (data, index) => {
      const window = data.slice(index - 10, index + 1);
      return Math.max(...window.map(c => c.high));
    }
  },
  {
    name: 'Descending Triangle',
    type: 'chart',
    signal: 'bearish',
    reliability: 'high',
    barsRequired: 10,
    description: 'Flat support line with falling resistance (lower highs). Price compresses into the apex.',
    outcome: 'Typically breaks downward through support. The falling highs show persistent selling pressure. Target is triangle height subtracted from breakdown. Expect 3-6% decline on confirmed breakdown.',
    successRate: 68,
    targetMove: '3-6% downward',
    timeframe: '5-15 candles',
    detect: (data, index) => {
      if (index < 10) return false;
      
      const window = data.slice(index - 10, index + 1);
      
      // Check for flat lows (support)
      const lows = window.map(c => c.low);
      const minLow = Math.min(...lows);
      const flatLows = lows.filter(l => l < minLow * 1.01).length >= 3;
      
      // Check for falling highs
      const highs = window.map(c => c.high);
      let fallingHighs = true;
      for (let i = 2; i < highs.length; i += 2) {
        if (highs[i] > highs[i - 2]) {
          fallingHighs = false;
          break;
        }
      }
      
      return flatLows && fallingHighs && (highs[highs.length - 1] < highs[0]);
    },
    getConfirmation: (data, index) => {
      const window = data.slice(index - 10, index + 1);
      return Math.min(...window.map(c => c.low));
    }
  },
  {
    name: 'Bullish Flag',
    type: 'chart',
    signal: 'bullish',
    reliability: 'high',
    barsRequired: 8,
    description: 'Sharp rally (pole) followed by tight consolidation sloping downward (flag). Continuation pattern.',
    outcome: 'Expect continuation of the prior uptrend. Target is typically the pole height added to the breakout. One of the most reliable patterns — 3-5% move expected.',
    successRate: 67,
    targetMove: '3-5% upward',
    timeframe: '3-8 candles',
    detect: (data, index) => {
      if (index < 10) return false;
      
      // Look for strong prior move (pole)
      const pole = data.slice(index - 10, index - 5);
      const poleMove = (pole[pole.length - 1].close - pole[0].open) / pole[0].open;
      if (poleMove < 0.02) return false; // Need 2%+ pole
      
      // Look for consolidation (flag)
      const flag = data.slice(index - 5, index + 1);
      const flagHigh = Math.max(...flag.map(c => c.high));
      const flagLow = Math.min(...flag.map(c => c.low));
      const flagRange = (flagHigh - flagLow) / flagLow;
      
      // Flag should be tight (less than 2%) and slightly downward sloping
      const flagSlope = (flag[flag.length - 1].close - flag[0].close) / flag[0].close;
      
      return flagRange < 0.02 && flagSlope < 0 && flagSlope > -0.015;
    }
  },
  {
    name: 'Bearish Flag',
    type: 'chart',
    signal: 'bearish',
    reliability: 'high',
    barsRequired: 8,
    description: 'Sharp decline (pole) followed by tight consolidation sloping upward (flag). Continuation pattern.',
    outcome: 'Expect continuation of the prior downtrend. Target is the pole height subtracted from breakdown. One of the most reliable patterns — 3-5% decline expected.',
    successRate: 67,
    targetMove: '3-5% downward',
    timeframe: '3-8 candles',
    detect: (data, index) => {
      if (index < 10) return false;
      
      const pole = data.slice(index - 10, index - 5);
      const poleMove = (pole[pole.length - 1].close - pole[0].open) / pole[0].open;
      if (poleMove > -0.02) return false; // Need 2%+ down pole
      
      const flag = data.slice(index - 5, index + 1);
      const flagHigh = Math.max(...flag.map(c => c.high));
      const flagLow = Math.min(...flag.map(c => c.low));
      const flagRange = (flagHigh - flagLow) / flagLow;
      
      const flagSlope = (flag[flag.length - 1].close - flag[0].close) / flag[0].close;
      
      return flagRange < 0.02 && flagSlope > 0 && flagSlope < 0.015;
    }
  },
  {
    name: 'Rising Wedge',
    type: 'chart',
    signal: 'bearish',
    reliability: 'medium',
    barsRequired: 12,
    description: 'Both support and resistance lines slope upward, but converge. Bearish despite the upward movement.',
    outcome: 'Usually breaks downward. The converging lines show momentum fading. Expect 3-5% decline after breakdown. Often appears at the end of uptrends.',
    successRate: 62,
    targetMove: '3-5% downward',
    timeframe: '5-12 candles',
    detect: (data, index) => {
      if (index < 12) return false;
      
      const window = data.slice(index - 12, index + 1);
      const highs = window.map(c => c.high);
      const lows = window.map(c => c.low);
      
      // Both highs and lows should be rising
      const highSlope = (highs[highs.length - 1] - highs[0]) / highs[0];
      const lowSlope = (lows[lows.length - 1] - lows[0]) / lows[0];
      
      // Converging: high slope should be less than low slope
      return highSlope > 0 && lowSlope > 0 && highSlope < lowSlope;
    }
  },
  {
    name: 'Falling Wedge',
    type: 'chart',
    signal: 'bullish',
    reliability: 'medium',
    barsRequired: 12,
    description: 'Both support and resistance lines slope downward, but converge. Bullish despite the downward movement.',
    outcome: 'Usually breaks upward. The converging lines show selling pressure fading. Expect 3-5% rally after breakout. Often marks the end of downtrends.',
    successRate: 62,
    targetMove: '3-5% upward',
    timeframe: '5-12 candles',
    detect: (data, index) => {
      if (index < 12) return false;
      
      const window = data.slice(index - 12, index + 1);
      const highs = window.map(c => c.high);
      const lows = window.map(c => c.low);
      
      const highSlope = (highs[highs.length - 1] - highs[0]) / highs[0];
      const lowSlope = (lows[lows.length - 1] - lows[0]) / lows[0];
      
      // Converging: low slope should be less negative than high slope
      return highSlope < 0 && lowSlope < 0 && lowSlope > highSlope;
    }
  }
];

// Main detection function
export function detectPatterns(
  data: PriceData[],
  options: {
    lookback?: number;
    types?: PatternType[];
    minReliability?: PatternReliability;
  } = {}
): DetectedPattern[] {
  const {
    lookback = 5,  // How many bars back to check for new patterns
    types = ['candlestick', 'chart'],
    minReliability = 'low'
  } = options;

  const reliabilityOrder: PatternReliability[] = ['low', 'medium', 'high'];
  const minReliabilityIndex = reliabilityOrder.indexOf(minReliability);

  const allPatterns = [
    ...(types.includes('candlestick') ? CANDLESTICK_PATTERNS : []),
    ...(types.includes('chart') ? CHART_PATTERNS : [])
  ].filter(p => reliabilityOrder.indexOf(p.reliability) >= minReliabilityIndex);

  const detected: DetectedPattern[] = [];
  const startIndex = Math.max(0, data.length - lookback);

  for (let i = startIndex; i < data.length; i++) {
    for (const pattern of allPatterns) {
      if (i < pattern.barsRequired - 1) continue;
      
      if (pattern.detect(data, i)) {
        const confirmation = pattern.getConfirmation?.(data, i);
        
        detected.push({
          id: `${pattern.name}-${i}-${Date.now()}`,
          name: pattern.name,
          type: pattern.type,
          signal: pattern.signal,
          reliability: pattern.reliability,
          description: pattern.description,
          outcome: pattern.outcome,
          successRate: pattern.successRate,
          targetMove: pattern.targetMove,
          timeframe: pattern.timeframe,
          detectedAt: new Date(data[i].timestamp),
          startIndex: i - pattern.barsRequired + 1,
          endIndex: i,
          priceAtDetection: data[i].close,
          confirmationLevel: confirmation
        });
      }
    }
  }

  return detected;
}

// Get all pattern definitions (for education section)
export function getAllPatternDefinitions(): PatternDefinition[] {
  return [...CANDLESTICK_PATTERNS, ...CHART_PATTERNS];
}

// Get pattern by name
export function getPatternDefinition(name: string): PatternDefinition | undefined {
  return [...CANDLESTICK_PATTERNS, ...CHART_PATTERNS].find(p => p.name === name);
}

export const PatternDetectionService = {
  detectPatterns,
  getAllPatternDefinitions,
  getPatternDefinition,
  CANDLESTICK_PATTERNS,
  CHART_PATTERNS
};
