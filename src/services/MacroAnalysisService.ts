/**
 * Macro Analysis Service
 * 
 * Fetches external research desk recommendations and macro outlook
 * to determine if signals are biased toward short-term or medium-term action.
 * 
 * Sources:
 * - Investing.com Technical Analysis (moving averages, indicators)
 * - TradingView sentiment (community consensus)
 * - Major bank research outlook indicators
 */

export interface MacroRecommendation {
  source: string;
  recommendation: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  timeframe: 'short-term' | 'medium-term' | 'long-term';
  confidence: number; // 0-100
  summary: string;
  lastUpdated: number;
}

export interface TechnicalSummary {
  movingAverages: {
    recommendation: 'BUY' | 'NEUTRAL' | 'SELL';
    buyCount: number;
    sellCount: number;
    neutralCount: number;
  };
  oscillators: {
    recommendation: 'BUY' | 'NEUTRAL' | 'SELL';
    buyCount: number;
    sellCount: number;
    neutralCount: number;
  };
  overall: {
    recommendation: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
    score: number; // -100 to 100
  };
}

export interface MacroOutlook {
  consensus: MacroRecommendation[];
  technicalSummary: TechnicalSummary;
  signalBias: 'short-term' | 'medium-term' | 'mixed';
  biasExplanation: string;
  lastFetched: number;
}

// Cache for macro data (refresh every 5 minutes)
let cachedOutlook: MacroOutlook | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export class MacroAnalysisService {
  // Gold Futures pair ID for external APIs (reserved for future use)
  // private static readonly INVESTING_COM_PAIR_ID = 8830;

  /**
   * Get comprehensive macro outlook
   */
  static async getMacroOutlook(): Promise<MacroOutlook> {
    const now = Date.now();
    
    // Return cached data if still valid
    if (cachedOutlook && (now - lastFetchTime) < CACHE_DURATION) {
      return cachedOutlook;
    }

    try {
      // Fetch from multiple sources in parallel
      const [technicalData, sentimentData] = await Promise.allSettled([
        this.fetchTechnicalAnalysis(),
        this.fetchSentimentData(),
      ]);

      const technical = technicalData.status === 'fulfilled' ? technicalData.value : this.getDefaultTechnical();
      const sentiment = sentimentData.status === 'fulfilled' ? sentimentData.value : [];

      // Combine into consensus
      const consensus = this.buildConsensus(technical, sentiment);
      const signalBias = this.determineSignalBias(technical, consensus);

      cachedOutlook = {
        consensus,
        technicalSummary: technical,
        signalBias: signalBias.bias,
        biasExplanation: signalBias.explanation,
        lastFetched: now,
      };

      lastFetchTime = now;
      return cachedOutlook;
    } catch (error) {
      console.error('Error fetching macro outlook:', error);
      
      // Return default/cached data on error
      if (cachedOutlook) {
        return cachedOutlook;
      }

      return {
        consensus: [],
        technicalSummary: this.getDefaultTechnical(),
        signalBias: 'mixed',
        biasExplanation: 'Unable to fetch external data. Using technical signals only.',
        lastFetched: now,
      };
    }
  }

  /**
   * Fetch technical analysis summary
   * Simulates data similar to Investing.com technical analysis
   */
  private static async fetchTechnicalAnalysis(): Promise<TechnicalSummary> {
    // In production, this would call the backend API which proxies to external sources
    // For now, we'll calculate based on our own indicators
    
    try {
      const response = await fetch('/api/macro/technical');
      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Fall through to default
    }

    // Return simulated data based on typical market analysis
    return this.getDefaultTechnical();
  }

  /**
   * Fetch market sentiment from community/analyst sources
   */
  private static async fetchSentimentData(): Promise<MacroRecommendation[]> {
    try {
      const response = await fetch('/api/macro/sentiment');
      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Fall through to default
    }

    return [];
  }

  /**
   * Build consensus from multiple sources
   */
  private static buildConsensus(
    technical: TechnicalSummary,
    sentiment: MacroRecommendation[]
  ): MacroRecommendation[] {
    const consensus: MacroRecommendation[] = [];

    // Add technical analysis as a source
    consensus.push({
      source: 'Technical Indicators',
      recommendation: technical.overall.recommendation,
      timeframe: 'short-term',
      confidence: Math.abs(technical.overall.score),
      summary: this.getTechnicalSummaryText(technical),
      lastUpdated: Date.now(),
    });

    // Add moving averages as separate source
    consensus.push({
      source: 'Moving Averages',
      recommendation: this.mapSimpleRecommendation(technical.movingAverages.recommendation),
      timeframe: 'medium-term',
      confidence: this.calculateMAConfidence(technical.movingAverages),
      summary: this.getMAText(technical.movingAverages),
      lastUpdated: Date.now(),
    });

    // Add any external sentiment data
    consensus.push(...sentiment);

    return consensus;
  }

  /**
   * Determine if signal bias is short-term or medium-term
   */
  private static determineSignalBias(
    technical: TechnicalSummary,
    _consensus: MacroRecommendation[]
  ): { bias: 'short-term' | 'medium-term' | 'mixed'; explanation: string } {
    const oscillatorScore = technical.oscillators.buyCount - technical.oscillators.sellCount;
    const maScore = technical.movingAverages.buyCount - technical.movingAverages.sellCount;
    
    // Oscillators favor short-term, MAs favor medium-term
    const oscillatorsStrong = Math.abs(oscillatorScore) > 5;
    const masStrong = Math.abs(maScore) > 5;

    // Check if oscillators and MAs agree
    const sameDirection = (oscillatorScore > 0 && maScore > 0) || (oscillatorScore < 0 && maScore < 0);

    if (sameDirection && oscillatorsStrong && masStrong) {
      return {
        bias: 'medium-term',
        explanation: 'Technical indicators and moving averages align, suggesting a stronger medium-term move.',
      };
    } else if (oscillatorsStrong && !masStrong) {
      return {
        bias: 'short-term',
        explanation: 'Oscillators show strong signals but moving averages are mixed. Likely a short-term opportunity.',
      };
    } else if (!oscillatorsStrong && masStrong) {
      return {
        bias: 'medium-term',
        explanation: 'Moving averages show clear trend while oscillators are neutral. Better for position trades.',
      };
    } else {
      return {
        bias: 'mixed',
        explanation: 'No clear alignment between short-term and medium-term indicators. Trade with caution.',
      };
    }
  }

  /**
   * Get default technical summary when external data unavailable
   */
  private static getDefaultTechnical(): TechnicalSummary {
    return {
      movingAverages: {
        recommendation: 'NEUTRAL',
        buyCount: 6,
        sellCount: 6,
        neutralCount: 0,
      },
      oscillators: {
        recommendation: 'NEUTRAL',
        buyCount: 4,
        sellCount: 4,
        neutralCount: 3,
      },
      overall: {
        recommendation: 'NEUTRAL',
        score: 0,
      },
    };
  }

  private static mapSimpleRecommendation(rec: 'BUY' | 'NEUTRAL' | 'SELL'): MacroRecommendation['recommendation'] {
    switch (rec) {
      case 'BUY': return 'BUY';
      case 'SELL': return 'SELL';
      default: return 'NEUTRAL';
    }
  }

  private static calculateMAConfidence(ma: TechnicalSummary['movingAverages']): number {
    const total = ma.buyCount + ma.sellCount + ma.neutralCount;
    const dominant = Math.max(ma.buyCount, ma.sellCount);
    return Math.round((dominant / total) * 100);
  }

  private static getTechnicalSummaryText(technical: TechnicalSummary): string {
    const { overall, oscillators, movingAverages } = technical;
    return `Overall: ${overall.recommendation} (Score: ${overall.score}). ` +
           `Oscillators: ${oscillators.buyCount} buy, ${oscillators.sellCount} sell. ` +
           `MAs: ${movingAverages.buyCount} buy, ${movingAverages.sellCount} sell.`;
  }

  private static getMAText(ma: TechnicalSummary['movingAverages']): string {
    const total = ma.buyCount + ma.sellCount;
    const buyPct = Math.round((ma.buyCount / total) * 100);
    return `${ma.buyCount}/${total} moving averages signal ${ma.recommendation.toLowerCase()} (${buyPct}% bullish)`;
  }

  /**
   * Check if macro outlook confirms a signal direction
   */
  static doesMacroConfirm(signalType: 'BUY' | 'SELL', outlook: MacroOutlook): {
    confirms: boolean;
    confidence: number;
    reason: string;
  } {
    const { technicalSummary, consensus } = outlook;
    
    // Check overall technical recommendation
    const technicalBullish = ['STRONG_BUY', 'BUY'].includes(technicalSummary.overall.recommendation);
    const technicalBearish = ['STRONG_SELL', 'SELL'].includes(technicalSummary.overall.recommendation);

    const signalIsBuy = signalType === 'BUY';
    const confirms = (signalIsBuy && technicalBullish) || (!signalIsBuy && technicalBearish);
    
    // Calculate confidence based on consensus agreement
    const agreeingRecommendations = consensus.filter(c => {
      const recBullish = ['STRONG_BUY', 'BUY'].includes(c.recommendation);
      const recBearish = ['STRONG_SELL', 'SELL'].includes(c.recommendation);
      return (signalIsBuy && recBullish) || (!signalIsBuy && recBearish);
    });

    const confidence = consensus.length > 0 
      ? Math.round((agreeingRecommendations.length / consensus.length) * 100)
      : 50;

    let reason = '';
    if (confirms) {
      reason = `${agreeingRecommendations.length}/${consensus.length} sources confirm ${signalType} bias`;
    } else {
      reason = `Macro outlook suggests caution - only ${agreeingRecommendations.length}/${consensus.length} sources align`;
    }

    return { confirms, confidence, reason };
  }
}
