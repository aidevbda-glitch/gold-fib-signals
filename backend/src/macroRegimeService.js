/**
 * Macro Regime Service
 * 
 * Classifies the current macroeconomic environment and determines
 * the impact on gold prices. Combines Fed policy, DXY trends, and
 * yield curve signals into a unified regime classification.
 */

import db from './database.js';
import { 
  getFullMacroContext, 
  getFedSentiment,
  fetchTreasuryYields,
  fetchDXY,
  fetchFedProbabilities,
  calculateGoldDXYCorrelation
} from './macroDataService.js';

/**
 * Macro Regime Types
 */
export const MACRO_REGIMES = {
  HAWKISH_FED_RISING_RATES: 'hawkish_fed_rising_rates',
  DOVISH_FED_EASING: 'dovish_fed_easing',
  STAGFLATION_FEARS: 'stagflation_fears',
  RECESSION_RISK: 'recession_risk',
  DISINFLATION_GOLDILOCKS: 'disinflation_goldilocks',
  GEOPOLITICAL_CRISIS: 'geopolitical_crisis',
  NEUTRAL: 'neutral',
};

/**
 * Gold bias ratings
 */
export const GOLD_BIAS = {
  STRONG_BULLISH: 'strong_bullish',
  BULLISH: 'bullish',
  NEUTRAL: 'neutral',
  BEARISH: 'bearish',
  STRONG_BEARISH: 'strong_bearish',
};

/**
 * Classify the current macro regime
 */
export function classifyMacroRegime(macroContext) {
  const { rateExpectations, treasuryYields, dollarContext } = macroContext;

  // Extract key indicators
  const hikeProb = rateExpectations.hikeProbability;
  const cutProb = rateExpectations.cutProbability;
  const yieldSpread = treasuryYields.yieldSpread10Y2Y;
  const isInverted = treasuryYields.isInverted;
  const dxyTrend = dollarContext.dxyTrend;
  const dxyChange7d = dollarContext.dxyChange7d;

  // Score each regime possibility
  const scores = {
    [MACRO_REGIMES.HAWKISH_FED_RISING_RATES]: 0,
    [MACRO_REGIMES.DOVISH_FED_EASING]: 0,
    [MACRO_REGIMES.STAGFLATION_FEARS]: 0,
    [MACRO_REGIMES.RECESSION_RISK]: 0,
    [MACRO_REGIMES.DISINFLATION_GOLDILOCKS]: 0,
    [MACRO_REGIMES.GEOPOLITICAL_CRISIS]: 0,
    [MACRO_REGIMES.NEUTRAL]: 0,
  };

  // Hawkish Fed signals
  if (hikeProb > 50) scores[MACRO_REGIMES.HAWKISH_FED_RISING_RATES] += 3;
  else if (hikeProb > 30) scores[MACRO_REGIMES.HAWKISH_FED_RISING_RATES] += 1;

  if (dxyTrend === 'strengthening' && dxyChange7d > 1.5) {
    scores[MACRO_REGIMES.HAWKISH_FED_RISING_RATES] += 2;
  }

  if (yieldSpread > 0.5 && !isInverted) {
    // Steepening yield curve with hikes = hawkish
    scores[MACRO_REGIMES.HAWKISH_FED_RISING_RATES] += 1;
  }

  // Dovish Fed signals
  if (cutProb > 50) scores[MACRO_REGIMES.DOVISH_FED_EASING] += 3;
  else if (cutProb > 30) scores[MACRO_REGIMES.DOVISH_FED_EASING] += 1;

  if (dxyTrend === 'weakening' && dxyChange7d < -1.5) {
    scores[MACRO_REGIMES.DOVISH_FED_EASING] += 2;
  }

  // Recession risk signals
  if (isInverted) {
    scores[MACRO_REGIMES.RECESSION_RISK] += 3;
    scores[MACRO_REGIMES.STAGFLATION_FEARS] += 1; // Often overlaps
  }
  if (yieldSpread < -0.5) scores[MACRO_REGIMES.RECESSION_RISK] += 1;

  // Stagflation signals
  if (isInverted && cutProb > 30) {
    // Inverted curve + cuts priced in = growth concerns + easing
    scores[MACRO_REGIMES.STAGFLATION_FEARS] += 2;
  }

  // Goldilocks (disinflation with growth)
  if (!isInverted && cutProb > 20 && cutProb < 50 && hikeProb < 20) {
    scores[MACRO_REGIMES.DISINFLATION_GOLDILOCKS] += 2;
  }

  // Neutral fallback
  scores[MACRO_REGIMES.NEUTRAL] = 0.5;

  // Find highest scoring regime
  let maxScore = -1;
  let dominantRegime = MACRO_REGIMES.NEUTRAL;

  for (const [regime, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      dominantRegime = regime;
    }
  }

  // Calculate confidence (0-100)
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = totalScore > 0 ? Math.round((maxScore / totalScore) * 100) : 50;

  return {
    regime: dominantRegime,
    confidence: Math.min(confidence, 95),
    scores,
  };
}

/**
 * Determine gold bias based on macro regime
 */
export function determineGoldBias(regime, macroContext) {
  const { rateExpectations, dollarContext, treasuryYields } = macroContext;

  // Base bias by regime
  const regimeBias = {
    [MACRO_REGIMES.HAWKISH_FED_RISING_RATES]: GOLD_BIAS.STRONG_BEARISH,
    [MACRO_REGIMES.DOVISH_FED_EASING]: GOLD_BIAS.STRONG_BULLISH,
    [MACRO_REGIMES.STAGFLATION_FEARS]: GOLD_BIAS.STRONG_BULLISH,
    [MACRO_REGIMES.RECESSION_RISK]: GOLD_BIAS.BULLISH,
    [MACRO_REGIMES.DISINFLATION_GOLDILOCKS]: GOLD_BIAS.NEUTRAL,
    [MACRO_REGIMES.GEOPOLITICAL_CRISIS]: GOLD_BIAS.STRONG_BULLISH,
    [MACRO_REGIMES.NEUTRAL]: GOLD_BIAS.NEUTRAL,
  };

  let bias = regimeBias[regime] || GOLD_BIAS.NEUTRAL;
  let adjustmentFactors = [];

  // Adjust based on DXY trend strength
  if (dollarContext.dxyTrend === 'strengthening' && dollarContext.dxyChange7d > 2) {
    if (bias === GOLD_BIAS.BULLISH) bias = GOLD_BIAS.NEUTRAL;
    else if (bias === GOLD_BIAS.NEUTRAL) bias = GOLD_BIAS.BEARISH;
    adjustmentFactors.push('Strong DXY rally pressuring gold');
  } else if (dollarContext.dxyTrend === 'weakening' && dollarContext.dxyChange7d < -2) {
    if (bias === GOLD_BIAS.BEARISH) bias = GOLD_BIAS.NEUTRAL;
    else if (bias === GOLD_BIAS.NEUTRAL) bias = GOLD_BIAS.BULLISH;
    adjustmentFactors.push('DXY weakness supporting gold');
  }

  // Adjust based on correlation strength
  if (dollarContext.goldDxyCorrelation20d < -0.7) {
    // Strong inverse correlation - DXY moves matter more
    if (dollarContext.dxyTrend === 'strengthening') {
      adjustmentFactors.push('High DXY correlation amplifying downside');
    } else if (dollarContext.dxyTrend === 'weakening') {
      adjustmentFactors.push('High DXY correlation amplifying upside');
    }
  }

  // Adjust based on yield curve
  if (treasuryYields.isInverted) {
    // Recession fears typically gold bullish
    if (bias === GOLD_BIAS.BEARISH) {
      bias = GOLD_BIAS.NEUTRAL;
      adjustmentFactors.push('Yield curve inversion limiting downside');
    } else if (bias === GOLD_BIAS.NEUTRAL) {
      bias = GOLD_BIAS.BULLISH;
      adjustmentFactors.push('Yield curve inversion adding support');
    }
  }

  return { bias, adjustmentFactors };
}

/**
 * Generate explanation for the current regime
 */
export function generateRegimeExplanation(regime, macroContext, bias) {
  const { rateExpectations, treasuryYields, dollarContext } = macroContext;

  const explanations = {
    [MACRO_REGIMES.HAWKISH_FED_RISING_RATES]: 
      `The Federal Reserve is in a hawkish phase with ${rateExpectations.hikeProbability}% probability ` +
      `of rate hikes at the next meeting. Rising rates increase the opportunity cost of holding gold ` +
      `and typically strengthen the dollar, creating headwinds for gold prices.`,

    [MACRO_REGIMES.DOVISH_FED_EASING]:
      `The Fed is expected to cut rates (${rateExpectations.cutProbability}% probability), ` +
      `reducing the opportunity cost of holding gold. ${dollarContext.dxyTrend === 'weakening' ? 
        'A weakening dollar adds further support.' : 'Even with mixed dollar action, lower rates are gold-friendly.'}`,

    [MACRO_REGIMES.STAGFLATION_FEARS]:
      `Markets are pricing in stagflation risks - high inflation with slowing growth. ` +
      `The yield curve is ${treasuryYields.isInverted ? 'inverted' : 'flat'} while the Fed ` +
      `faces pressure to ease. This is historically one of the best environments for gold.`,

    [MACRO_REGIMES.RECESSION_RISK]:
      `The inverted yield curve (${treasuryYields.yieldSpread10Y2Y.toFixed(2)}% spread) signals ` +
      `recession risk. Gold typically performs well during recession fears as a safe haven, ` +
      `though initial reactions can be mixed if dollar strengthens on flight-to-safety.`,

    [MACRO_REGIMES.DISINFLATION_GOLDILOCKS]:
      `The economy is in a "Goldilocks" phase - growth with moderating inflation. ` +
      `The Fed is on hold, and neither extreme bullish nor bearish forces dominate. ` +
      `Gold may trade in a range, driven more by technicals than macro.`,

    [MACRO_REGIMES.GEOPOLITICAL_CRISIS]:
      `Geopolitical tensions are elevated, driving safe-haven demand for gold. ` +
      `In crisis environments, gold often decouples from rate/dollar correlations.`,

    [MACRO_REGIMES.NEUTRAL]:
      `No dominant macro theme is driving gold prices. The Fed is in a wait-and-see mode, ` +
      `the dollar is range-bound, and technical factors are likely to dominate price action.`,
  };

  const baseExplanation = explanations[regime] || explanations[MACRO_REGIMES.NEUTRAL];

  // Add bias-specific guidance
  let guidance = '';
  switch (bias) {
    case GOLD_BIAS.STRONG_BULLISH:
      guidance = '\n\n🟢 **Trading Implication**: Strong tailwinds for gold. Technical buy signals have higher probability of success. Consider accumulating on dips.';
      break;
    case GOLD_BIAS.BULLISH:
      guidance = '\n\n🟢 **Trading Implication**: Moderate support for gold. Buy signals at key support levels are favorable, but use normal position sizing.';
      break;
    case GOLD_BIAS.NEUTRAL:
      guidance = '\n\n🟡 **Trading Implication**: Mixed macro forces. Rely more on technical analysis. Range-bound conditions likely.';
      break;
    case GOLD_BIAS.BEARISH:
      guidance = '\n\n🔴 **Trading Implication**: Headwinds present. Be cautious with buy signals - consider smaller positions or waiting for better entries.';
      break;
    case GOLD_BIAS.STRONG_BEARISH:
      guidance = '\n\n🔴 **Trading Implication**: Significant headwinds. Consider taking profits on longs or looking for short opportunities. Breakdowns more likely than bounces.';
      break;
  }

  return baseExplanation + guidance;
}

/**
 * Get current macro regime analysis
 */
export async function getMacroRegimeAnalysis() {
  const macroContext = await getFullMacroContext();
  const regimeData = classifyMacroRegime(macroContext);
  const { bias, adjustmentFactors } = determineGoldBias(regimeData.regime, macroContext);
  const explanation = generateRegimeExplanation(regimeData.regime, macroContext, bias);
  const fedSentiment = getFedSentiment(macroContext.rateExpectations);

  const analysis = {
    regime: regimeData.regime,
    confidence: regimeData.confidence,
    factors: {
      fedSentiment,
      inflationTrend: 'stable', // Would need CPI data
      growthOutlook: macroContext.treasuryYields.isInverted ? 'weak' : 'moderate',
      geopoliticalRisk: 'normal', // Would need news API
    },
    goldBias: bias,
    explanation,
    adjustmentFactors,
    macroContext,
    timestamp: Date.now(),
  };

  // Save to history
  saveRegimeHistory(analysis);

  return analysis;
}

/**
 * Save regime analysis to history
 */
function saveRegimeHistory(analysis) {
  try {
    db.prepare(`
      INSERT INTO macro_regime_history 
      (timestamp, regime, confidence, fed_sentiment, dxy_trend, yield_spread, gold_bias, explanation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      analysis.timestamp,
      analysis.regime,
      analysis.confidence,
      analysis.factors.fedSentiment,
      analysis.macroContext.dollarContext.dxyTrend,
      analysis.macroContext.treasuryYields.yieldSpread10Y2Y,
      analysis.goldBias,
      analysis.explanation.substring(0, 500) // Truncate for storage
    );

    // Cleanup old history (keep 90 days)
    db.prepare(`DELETE FROM macro_regime_history WHERE timestamp < ?`)
      .run(Date.now() - 90 * 24 * 60 * 60 * 1000);
  } catch (error) {
    console.error('Error saving regime history:', error);
  }
}

/**
 * Get regime history for analysis
 */
export function getRegimeHistory(days = 30) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  
  return db.prepare(`
    SELECT * FROM macro_regime_history
    WHERE timestamp >= ?
    ORDER BY timestamp ASC
  `).all(since);
}

/**
 * Check if macro context confirms a signal direction
 * Returns confidence adjustment and reasoning
 */
export function doesMacroConfirmSignal(signalType, macroAnalysis) {
  const { goldBias, regime } = macroAnalysis;
  const isBuySignal = signalType === 'BUY';

  // Map bias to confirmation level
  const biasConfirmation = {
    [GOLD_BIAS.STRONG_BULLISH]: { buy: 0.9, sell: 0.1 },
    [GOLD_BIAS.BULLISH]: { buy: 0.7, sell: 0.3 },
    [GOLD_BIAS.NEUTRAL]: { buy: 0.5, sell: 0.5 },
    [GOLD_BIAS.BEARISH]: { buy: 0.3, sell: 0.7 },
    [GOLD_BIAS.STRONG_BEARISH]: { buy: 0.1, sell: 0.9 },
  };

  const confirmation = biasConfirmation[goldBias] || biasConfirmation[GOLD_BIAS.NEUTRAL];
  const confirms = isBuySignal ? confirmation.buy > 0.5 : confirmation.sell > 0.5;
  const confidence = Math.round((isBuySignal ? confirmation.buy : confirmation.sell) * 100);

  let reason = '';
  if (confirms) {
    reason = `Macro regime (${regime}) and gold bias (${goldBias}) support ${signalType} signals.`;
  } else {
    reason = `Macro regime (${regime}) and gold bias (${goldBias}) contradict ${signalType} signals. Consider caution.`;
  }

  return { confirms, confidence, reason };
}

/**
 * Adjust signal strength based on macro context
 */
export function adjustSignalStrength(originalStrength, signalType, macroAnalysis) {
  const { confirms, confidence, reason } = doesMacroConfirmSignal(signalType, macroAnalysis);

  // Strength adjustment matrix
  const adjustments = {
    STRONG: { confirms: 'STRONG', contradicts: 'MODERATE' },
    MODERATE: { confirms: 'STRONG', contradicts: 'WEAK' },
    WEAK: { confirms: 'MODERATE', contradicts: 'HOLD' },
  };

  const adjustedStrength = adjustments[originalStrength]?.[confirms ? 'confirms' : 'contradicts'] || originalStrength;

  return {
    original: originalStrength,
    adjusted: adjustedStrength,
    confirms,
    macroConfidence: confidence,
    reason,
  };
}

/**
 * Generate macro context summary for signal explanations
 */
export function generateMacroContextSummary(macroAnalysis) {
  const { macroContext, goldBias, regime } = macroAnalysis;
  const { rateExpectations, dollarContext, treasuryYields } = macroContext;

  const parts = [];

  // Fed policy summary
  const fedAction = rateExpectations.hikeProbability > 50 ? 'hiking' :
                    rateExpectations.cutProbability > 50 ? 'cutting' : 'on hold';
  parts.push(`Fed is ${fedAction} (${rateExpectations.hikeProbability}% hike, ${rateExpectations.cutProbability}% cut prob)`);

  // DXY summary
  parts.push(`DXY at ${dollarContext.dxyCurrent.toFixed(2)} (${dollarContext.dxyChange7d > 0 ? '+' : ''}${dollarContext.dxyChange7d.toFixed(1)}% 7d)`);

  // Yield curve
  const curveStatus = treasuryYields.isInverted ? 'inverted' : 'normal';
  parts.push(`Yield curve ${curveStatus} (${treasuryYields.yieldSpread10Y2Y.toFixed(2)}% spread)`);

  // Gold bias
  const biasEmoji = {
    [GOLD_BIAS.STRONG_BULLISH]: '🟢',
    [GOLD_BIAS.BULLISH]: '🟢',
    [GOLD_BIAS.NEUTRAL]: '🟡',
    [GOLD_BIAS.BEARISH]: '🔴',
    [GOLD_BIAS.STRONG_BEARISH]: '🔴',
  };
  parts.push(`${biasEmoji[goldBias] || '🟡'} Gold bias: ${goldBias.replace(/_/g, ' ')}`);

  return {
    summary: parts.join(' | '),
    regime,
    goldBias,
  };
}
