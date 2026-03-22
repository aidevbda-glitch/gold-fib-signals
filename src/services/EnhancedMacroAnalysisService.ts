/**
 * Enhanced Macro Analysis Service
 * 
 * Fetches and manages macroeconomic data from the backend:
 * - Fed Funds Futures probabilities
 * - Treasury yields
 * - US Dollar Index (DXY)
 * - Gold/DXY correlation
 * - Macro regime classification
 */

import { MacroAnalysisService as BaseMacroService } from './MacroAnalysisService';

export interface FedProbabilities {
  nextMeeting: string;
  meetings: Array<{
    date: string;
    hikeProbability: number;
    cutProbability: number;
    holdProbability: number;
    terminalRateExpected: number;
  }>;
  terminalRateCurrent: number;
  source: string;
  lastUpdated: number;
}

export interface TreasuryYields {
  date: string;
  yield2Y: number;
  yield10Y: number;
  yield30Y: number;
  yieldSpread10Y2Y: number;
  isInverted: boolean;
  effectiveFedFunds: number;
  source: string;
  lastUpdated: number;
}

export interface DollarContext {
  dxyCurrent: number;
  dxyChange24h: number;
  dxyChange7d: number;
  dxyTrend: 'strengthening' | 'weakening' | 'neutral';
  goldDxyCorrelation20d: number;
  goldDxyCorrelation5d: number;
  impactOnGold: 'strong_negative' | 'moderate_negative' | 'neutral' | 'positive';
  lastUpdated: number;
}

export interface MacroContext {
  rateExpectations: FedProbabilities;
  treasuryYields: TreasuryYields;
  dollarContext: DollarContext;
}

export type MacroRegime = 
  | 'hawkish_fed_rising_rates'
  | 'dovish_fed_easing'
  | 'stagflation_fears'
  | 'recession_risk'
  | 'disinflation_goldilocks'
  | 'geopolitical_crisis'
  | 'neutral';

export type GoldBias = 
  | 'strong_bullish'
  | 'bullish'
  | 'neutral'
  | 'bearish'
  | 'strong_bearish';

export interface MacroRegimeAnalysis {
  regime: MacroRegime;
  confidence: number;
  factors: {
    fedSentiment: string;
    inflationTrend: string;
    growthOutlook: string;
    geopoliticalRisk: string;
  };
  goldBias: GoldBias;
  explanation: string;
  adjustmentFactors: string[];
  macroContext: MacroContext;
  timestamp: number;
}

export interface SignalMacroConfirmation {
  confirms: boolean;
  confidence: number;
  reason: string;
}

export interface SignalAdjustment {
  original: string;
  adjusted: string;
  confirms: boolean;
  macroConfidence: number;
  reason: string;
}

// Cache for macro data
let cachedRegime: MacroRegimeAnalysis | null = null;
let lastRegimeFetch = 0;
const REGIME_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export class EnhancedMacroAnalysisService {
  /**
   * Get full macro context (Fed, yields, DXY)
   */
  static async getFullMacroContext(): Promise<MacroContext> {
    try {
      const response = await fetch(`${API_BASE}/macro/full-context`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Failed to fetch full macro context:', error);
    }

    // Return default structure
    return {
      rateExpectations: await this.getFedProbabilities(),
      treasuryYields: await this.getTreasuryYields(),
      dollarContext: await this.getDollarContext(),
    };
  }

  /**
   * Get Fed funds futures probabilities
   */
  static async getFedProbabilities(): Promise<FedProbabilities> {
    try {
      const response = await fetch(`${API_BASE}/macro/rates`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Failed to fetch Fed probabilities:', error);
    }

    return {
      nextMeeting: this.getNextFOMCMeeting(),
      meetings: [{
        date: this.getNextFOMCMeeting(),
        hikeProbability: 33,
        cutProbability: 33,
        holdProbability: 34,
        terminalRateExpected: 4.50,
      }],
      terminalRateCurrent: 4.50,
      source: 'default',
      lastUpdated: Date.now(),
    };
  }

  /**
   * Get Treasury yields
   */
  static async getTreasuryYields(): Promise<TreasuryYields> {
    try {
      const response = await fetch(`${API_BASE}/macro/yields`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Failed to fetch Treasury yields:', error);
    }

    return {
      date: new Date().toISOString().split('T')[0],
      yield2Y: 4.50,
      yield10Y: 4.50,
      yield30Y: 4.75,
      yieldSpread10Y2Y: 0,
      isInverted: false,
      effectiveFedFunds: 4.50,
      source: 'default',
      lastUpdated: Date.now(),
    };
  }

  /**
   * Get US Dollar Index data
   */
  static async getDollarContext(): Promise<DollarContext> {
    try {
      const response = await fetch(`${API_BASE}/macro/dxy`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Failed to fetch DXY:', error);
    }

    return {
      dxyCurrent: 103.00,
      dxyChange24h: 0,
      dxyChange7d: 0,
      dxyTrend: 'neutral',
      goldDxyCorrelation20d: -0.8,
      goldDxyCorrelation5d: -0.8,
      impactOnGold: 'moderate_negative',
      lastUpdated: Date.now(),
    };
  }

  /**
   * Get gold/DXY correlation
   */
  static async getCorrelation(days: number = 20): Promise<{ correlation: number; sampleSize: number; interpretation: string }> {
    try {
      const response = await fetch(`${API_BASE}/macro/correlation?days=${days}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.warn('Failed to fetch correlation:', error);
    }

    return {
      correlation: -0.8,
      sampleSize: 0,
      interpretation: 'Strong inverse correlation (default)',
    };
  }

  /**
   * Get current macro regime analysis
   */
  static async getMacroRegime(): Promise<MacroRegimeAnalysis> {
    const now = Date.now();

    // Return cached if still valid
    if (cachedRegime && (now - lastRegimeFetch) < REGIME_CACHE_DURATION) {
      return cachedRegime;
    }

    try {
      const response = await fetch(`${API_BASE}/macro/regime`);
      if (response.ok) {
        const data = await response.json();
        cachedRegime = data;
        lastRegimeFetch = now;
        return data;
      }
    } catch (error) {
      console.warn('Failed to fetch macro regime:', error);
    }

    // Return default
    return {
      regime: 'neutral',
      confidence: 50,
      factors: {
        fedSentiment: 'neutral',
        inflationTrend: 'stable',
        growthOutlook: 'moderate',
        geopoliticalRisk: 'normal',
      },
      goldBias: 'neutral',
      explanation: 'Unable to fetch macro data. Using neutral assumptions.',
      adjustmentFactors: [],
      macroContext: await this.getFullMacroContext(),
      timestamp: now,
    };
  }

  /**
   * Check if macro context confirms a signal direction
   */
  static async doesMacroConfirm(signalType: 'BUY' | 'SELL'): Promise<SignalMacroConfirmation> {
    try {
      const regime = await this.getMacroRegime();
      const isBuy = signalType === 'BUY';
      
      const biasMap: Record<GoldBias, { buy: number; sell: number }> = {
        strong_bullish: { buy: 0.9, sell: 0.1 },
        bullish: { buy: 0.7, sell: 0.3 },
        neutral: { buy: 0.5, sell: 0.5 },
        bearish: { buy: 0.3, sell: 0.7 },
        strong_bearish: { buy: 0.1, sell: 0.9 },
      };

      const confirmation = biasMap[regime.goldBias] || biasMap.neutral;
      const confirms = isBuy ? confirmation.buy > 0.5 : confirmation.sell > 0.5;
      const confidence = Math.round((isBuy ? confirmation.buy : confirmation.sell) * 100);

      return {
        confirms,
        confidence,
        reason: confirms
          ? `Macro regime (${regime.regime}) supports ${signalType} signals.`
          : `Macro regime (${regime.regime}) contradicts ${signalType} signals.`,
      };
    } catch (error) {
      console.error('Error checking macro confirmation:', error);
      return {
        confirms: true,
        confidence: 50,
        reason: 'Unable to fetch macro data. Proceeding with technical signal only.',
      };
    }
  }

  /**
   * Adjust signal strength based on macro context
   */
  static async adjustSignalStrength(
    originalStrength: string,
    signalType: 'BUY' | 'SELL'
  ): Promise<SignalAdjustment> {
    const confirmation = await this.doesMacroConfirm(signalType);

    const adjustments: Record<string, { confirms: string; contradicts: string }> = {
      STRONG: { confirms: 'STRONG', contradicts: 'MODERATE' },
      MODERATE: { confirms: 'STRONG', contradicts: 'WEAK' },
      WEAK: { confirms: 'MODERATE', contradicts: 'HOLD' },
    };

    const adjusted = adjustments[originalStrength]?.[confirmation.confirms ? 'confirms' : 'contradicts'] || originalStrength;

    return {
      original: originalStrength,
      adjusted,
      confirms: confirmation.confirms,
      macroConfidence: confirmation.confidence,
      reason: confirmation.reason,
    };
  }

  /**
   * Generate a macro context summary for display
   */
  static async getMacroSummary(): Promise<{ summary: string; regime: string; goldBias: GoldBias }> {
    try {
      const regime = await this.getMacroRegime();
      const { macroContext } = regime;
      
      const parts: string[] = [];

      // Fed policy summary
      const fedAction = macroContext.rateExpectations.hikeProbability > 50 ? 'hiking' :
                        macroContext.rateExpectations.cutProbability > 50 ? 'cutting' : 'on hold';
      parts.push(`Fed is ${fedAction}`);

      // DXY summary
      parts.push(`DXY ${macroContext.dollarContext.dxyTrend}`);

      // Yield curve
      const curveStatus = macroContext.treasuryYields.isInverted ? 'inverted' : 'normal';
      parts.push(`Yield curve ${curveStatus}`);

      return {
        summary: parts.join(' | '),
        regime: regime.regime,
        goldBias: regime.goldBias,
      };
    } catch (error) {
      return {
        summary: 'Macro data unavailable',
        regime: 'neutral',
        goldBias: 'neutral',
      };
    }
  }

  /**
   * Get bias emoji for display
   */
  static getBiasEmoji(bias: GoldBias): string {
    const emojis: Record<GoldBias, string> = {
      strong_bullish: '🟢',
      bullish: '🟢',
      neutral: '🟡',
      bearish: '🔴',
      strong_bearish: '🔴',
    };
    return emojis[bias] || '🟡';
  }

  /**
   * Format regime name for display
   */
  static formatRegimeName(regime: MacroRegime): string {
    return regime.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Get next FOMC meeting date (2026 schedule)
   */
  private static getNextFOMCMeeting(): string {
    const meetings = [
      '2026-01-28', '2026-03-18', '2026-05-06', '2026-06-17',
      '2026-07-29', '2026-09-16', '2026-10-28', '2026-12-09',
    ];
    const today = new Date().toISOString().split('T')[0];
    for (const date of meetings) {
      if (date >= today) return date;
    }
    return meetings[meetings.length - 1];
  }
}

export default EnhancedMacroAnalysisService;
