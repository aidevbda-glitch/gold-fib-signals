# Gold-Fib Signals v2 - Extended Specification
## Macro Factor Weighting & Dual-Direction Signal Enhancement

---

## Current State Analysis

The existing implementation has these components:
- ✅ Fibonacci retracement calculations (23.6%, 38.2%, 50%, 61.8%, 78.6%)
- ✅ Basic BUY/SELL signals based on price proximity to Fib levels
- ✅ Technical indicator consensus (MAs, oscillators) via `MacroAnalysisService`
- ✅ Plain-language signal explanations

**Critical Gap Identified:**
- ❌ No Fed policy/interest rate tracking
- ❌ No USD correlation (DXY) monitoring
- ❌ No macro regime detection (hawkish/dovish Fed phases)
- ❌ No causality modeling — technical signals don't adjust for fundamental regime shifts
- ❌ SELL signals only trigger on bearish trend retracements, not macro-driven breakdowns

---

## New Requirements: Macro Factor Integration

### 1. Fed Funds Futures & Rate Probability Tracker

**Data Sources:**
- CME FedWatch Tool (scraped or via API)
- Treasury yield curve (2Y, 10Y, 30Y)
- Fed speakers calendar & statement parsing

**Metrics to Track:**
```typescript
interface RateExpectations {
  // Next meeting probability
  nextMeetingDate: string;
  hikeProbability: number;      // 0-100%
  cutProbability: number;       // 0-100%
  holdProbability: number;      // 0-100%
  
  // Terminal rate expectations
  terminalRateCurrent: number;  // Current Fed funds
  terminalRateExpected: number; // Market-implied terminal
  
  // Yield curve
  yield2Y: number;
  yield10Y: number;
  yieldSpread10Y2Y: number;     // Recession indicator
  
  // Fed sentiment
  fedSentiment: 'hawkish' | 'neutral' | 'dovish';
  recentSpeeches: FedSpeech[];
  
  lastUpdated: number;
}
```

**Impact on Gold Signals:**
- Rising rate expectations → Bearish pressure on gold
- Falling rate expectations → Bullish pressure on gold
- Yield curve inversion → Flight to safety (gold bullish)

### 2. DXY (US Dollar Index) Correlation Module

**Data Source:**
- Real-time DXY feed (or calculate from USD pairs)
- USD strength vs major currencies

**Metrics:**
```typescript
interface DollarContext {
  dxyCurrent: number;
  dxyChange24h: number;
  dxyChange7d: number;
  dxyTrend: 'strengthening' | 'weakening' | 'neutral';
  
  // Correlation with gold (typically negative)
  goldDxyCorrelation20d: number;  // -0.8 = strong inverse
  goldDxyCorrelation5d: number;   // Recent correlation
  
  // Key levels
  dxyAtResistance: boolean;
  dxyAtSupport: boolean;
  
  impactOnGold: 'strong_negative' | 'moderate_negative' | 'neutral' | 'positive';
}
```

### 3. Macro Regime Detector

**Classify current environment:**
```typescript
type MacroRegime = 
  | 'hawkish_fed_rising_rates'      // DXY up, yields up, gold down pressure
  | 'dovish_fed_easing'             // DXY down, yields down, gold up
  | 'stagflation_fears'             // Rates up + recession fears = gold bullish
  | 'recession_risk'                // YC inversion, gold bullish
  | 'disinflation_goldilocks'       // Soft landing, mixed
  | 'geopolitical_crisis'           // Safe haven bid, gold bullish
  | 'neutral';

interface MacroRegimeAnalysis {
  regime: MacroRegime;
  confidence: number;  // 0-100
  factors: {
    fedPolicy: 'hawkish' | 'neutral' | 'dovish';
    inflationTrend: 'rising' | 'falling' | 'stable';
    growthOutlook: 'strong' | 'moderate' | 'weak' | 'recession';
    geopoliticalRisk: 'elevated' | 'normal' | 'low';
  };
  goldBias: 'strong_bullish' | 'bullish' | 'neutral' | 'bearish' | 'strong_bearish';
  explanation: string;
}
```

### 4. Enhanced Signal Generation with Macro Weighting

**Updated Signal Logic:**

```typescript
interface EnhancedTradingSignal extends TradingSignal {
  macroContext: {
    regime: MacroRegime;
    rateExpectationsImpact: 'supporting' | 'contradicting' | 'neutral';
    dxyImpact: 'supporting' | 'contradicting' | 'neutral';
    combinedMacroScore: number;  // -100 to +100 (bearish to bullish)
  };
  adjustedStrength: SignalStrength;  // Original strength adjusted for macro
  macroExplanation: string;          // Why macro supports or contradicts
}
```

**Signal Strength Adjustment Rules:**

| Technical Signal | Macro Alignment | Adjusted Strength | Action |
|-----------------|-----------------|-------------------|--------|
| BUY at 61.8% | Rates ↓, DXY ↓ | STRONG | High confidence long |
| BUY at 61.8% | Rates ↑, DXY ↑ | WEAK / HOLD | Avoid — macro headwinds |
| BUY at 61.8% | Mixed macro | MODERATE | Proceed with caution |
| SELL at 38.2% | Rates ↑, DXY ↑ | STRONG | High confidence short |
| SELL at 38.2% | Rates ↓, DXY ↓ | WEAK / HOLD | Avoid — macro tailwinds |
| Price breaks 78.6% support | Rates ↑ | STRONG SELL | Breakdown confirmed by macro |
| Price breaks swing high | Rates ↓ | STRONG BUY | Breakout confirmed by macro |

**New SELL Trigger Conditions:**

1. **Macro-Driven Breakdown SELL**
   - Price breaks below 78.6% Fib level
   - Fed sentiment = hawkish AND rate hike probability > 60%
   - DXY strengthening (trend up)
   - → STRONG SELL: "Technical breakdown confirmed by hawkish Fed pivot"

2. **Resistance Rejection SELL**
   - Price at 38.2%/50%/61.8% in bearish trend
   - Macro regime = hawkish_fed_rising_rates
   - → MODERATE/STRONG SELL: "Fib resistance + macro headwinds"

3. **Overextension SELL**
   - Price above swing high (extended)
   - Rate expectations rising (hawkish surprise potential)
   - RSI overbought
   - → MODERATE SELL: "Take profits — extended + rising rate risk"

### 5. Macro Dashboard Component

**New UI Panel showing:**

```
┌─────────────────────────────────────────────────────────┐
│ MACRO CONTEXT                                           │
├─────────────────────────────────────────────────────────┤
│ Fed Policy:        🦅 HAWKISH                           │
│ Next Meeting:      May 1, 2026                          │
│ Hike Probability:  ████████░░ 75%                       │
│ Cut Probability:   ██░░░░░░░░ 10%                       │
├─────────────────────────────────────────────────────────┤
│ DXY:               103.45 ▲ +0.8% (7d)                  │
│ USD Trend:         Strengthening ⚠️                     │
│ Gold/USD Corr:     -0.82 (strong inverse)               │
├─────────────────────────────────────────────────────────┤
│ Yields:            2Y: 4.85% | 10Y: 4.35% | Spread: -50bp│
│ Recession Signal:  🚨 INVERTED (gold bullish if growth↓)│
├─────────────────────────────────────────────────────────┤
│ REGIME:            Hawkish Fed + Rising Rates           │
│ Gold Bias:         🐻 BEARISH (rate pressure)           │
│ Signal Impact:     Technical BUYs downgraded            │
└─────────────────────────────────────────────────────────┘
```

### 6. Updated Signal Explanations with Macro Context

**Example: BUY signal during dovish Fed**
```
💡 Why BUY Now:
Gold just hit the 61.8% Fibonacci level at $4,770, a key support zone. 

📊 Macro Tailwinds:
- Fed cut probability for next meeting: 65%
- DXY weakening (-1.2% this week)
- Real yields falling (10Y TIPS down 15bp)

✅ Technical + Macro Alignment:
The Fibonacci support coincides with dovish Fed expectations. This 
strengthens the buy case — you're buying technical support WITH the 
macro wind at your back.

⚡ Signal Strength: STRONG
```

**Example: SELL signal during hawkish Fed breakdown**
```
💡 Why SELL Now:
Gold has broken below the 78.6% support level ($4,700), suggesting the 
pullback is becoming a trend reversal.

📊 Macro Headwinds Confirming Breakdown:
- Fed hike probability surged to 75% (was 30% last week)
- Powell's recent speech: "Higher for longer"
- DXY breaking above 104 resistance
- Real yields rising (+25bp this week)

⚠️ Technical + Macro Divergence:
This is NOT a dip to buy — it's a fundamental regime shift. The Fed 
is tightening while gold breaks technical support. Classic breakdown 
setup.

⚡ Signal Strength: STRONG SELL
```

**Example: Mixed macro — HOLD recommendation**
```
💡 Why HOLD:
Gold is at the 50% Fibonacci level ($4,820), which would normally be 
a buying opportunity.

📊 Conflicting Signals:
- Technical: At key support, potential bounce zone
- Macro: Fed speakers hawkish this week, hike odds rising
- DXY: Mixed — short-term strength but medium-term concerns

⚠️ Reduced Conviction:
With the Fed pivot uncertain, this technical setup has lower odds. 
Wait for clarity — either a clear dovish pivot (strengthens buy) or 
confirmation of hawkish shift (wait for lower prices).

⚡ Signal Strength: DOWNGRADED to WEAK / NO TRADE
```

---

## Implementation Plan

### Phase 1: Data Pipeline (Backend)

1. **Create `RateExpectationService.ts`**
   - Scrape CME FedWatch probabilities
   - Fetch Treasury yields from FRED API
   - Cache with 15-minute refresh

2. **Create `DollarCorrelationService.ts`**
   - Fetch DXY data
   - Calculate rolling correlation with gold
   - Identify trend direction

3. **Create `MacroRegimeService.ts`**
   - Aggregate Fed, DXY, yield data
   - Classify regime using rules engine
   - Calculate gold bias score

4. **Backend API Endpoints**
   ```
   GET /api/macro/rates
   GET /api/macro/dxy
   GET /api/macro/regime
   GET /api/macro/full-context
   ```

### Phase 2: Enhanced Signal Logic (Frontend)

1. **Extend `SignalService.ts`**
   - Add macro context to signal generation
   - Implement strength adjustment rules
   - Add new SELL triggers for macro breakdowns

2. **Create `MacroDashboard.tsx`**
   - Visual macro context panel
   - Fed probability meter
   - DXY trend indicator
   - Regime classification badge

3. **Update signal explanations**
   - Include macro context section
   - Explain alignment or divergence
   - Adjusted confidence language

### Phase 3: Alerting & Notifications

1. **Macro regime change alerts**
   - "Fed pivot detected: Hawkish shift"
   - "DXY breaking key resistance"
   - "Yield curve inversion deepening"

2. **Enhanced signal alerts**
   - Include macro context in notifications
   - "STRONG BUY — Technical + Macro aligned"
   - "WEAK BUY — Macro headwinds present"

---

## Data Sources

| Data | Source | Free Tier | Refresh Rate |
|------|--------|-----------|--------------|
| Fed Funds Probabilities | CME FedWatch | Scraped | 15 min |
| Treasury Yields | FRED API | ✅ Yes | Hourly |
| DXY | Alpha Vantage / Yahoo | ✅ Yes | 5 min |
| Fed Calendar | Fed website | ✅ Yes | Daily |

---

## Key Design Decisions

1. **Macro overrides technical in extremes**
   - If Fed is aggressively hawkish + DXY surging, downgrade ALL buy signals
   - If stagflation fears dominate, upgrade gold bullish signals regardless of technicals

2. **Correlation, not just causation**
   - Show the relationship: "Gold typically falls when DXY rises (current correlation: -0.8)"
   - Explain when correlations break down

3. **Transparency in adjustments**
   - Always show: "Technical strength: MODERATE → Macro-adjusted: WEAK"
   - Explain WHY the adjustment was made

4. **Regime persistence**
   - Macro regimes persist for weeks/months — don't flip signals on daily noise
   - Use 5-10 day moving averages for Fed/DXY trends

---

## Success Metrics

- ✅ Signals reflect known macro events (Fed meetings, CPI prints)
- ✅ SELL signals generated during rate-driven gold selloffs
- ✅ Reduced false buy signals during hawkish Fed phases
- ✅ Users can see WHY a signal was downgraded/upgraded
- ✅ Macro dashboard provides actionable context

---

## Notes on Current Gold Environment (March 2026)

Based on your observation:
- Gold fell ~5-7% from recent highs
- Likely driver: Hawkish Fed repricing, DXY strength
- Technical 61.8% support may have broken
- App should have flagged: "Macro headwinds increasing → avoid buying dips"

This extension would have caught that regime shift.
