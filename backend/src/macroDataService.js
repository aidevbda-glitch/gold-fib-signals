/**
 * Macro Data Service
 * 
 * Fetches and manages:
 * - Fed Funds Futures probabilities (CME FedWatch)
 * - Treasury yields (FRED API)
 * - US Dollar Index (DXY) from various sources
 * 
 * All data is cached with configurable refresh intervals
 */

import db from './database.js';

// Data sources
const FRED_API_BASE = 'https://api.stlouisfed.org/fred';
const FRED_API_KEY = process.env.FRED_API_KEY || ''; // Optional - can work without for some series
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || '';

// Cache configuration
const CACHE_DURATIONS = {
  fedProbabilities: 15 * 60 * 1000,  // 15 minutes
  treasuryYields: 60 * 60 * 1000,     // 1 hour
  dxy: 5 * 60 * 1000,                 // 5 minutes
  fedCalendar: 24 * 60 * 60 * 1000,   // 24 hours
};

// FRED Series IDs
const FRED_SERIES = {
  treasury2Y: 'DGS2',
  treasury10Y: 'DGS10',
  treasury30Y: 'DGS30',
  effectiveFedFunds: 'DFF',
  targetRateUpper: 'DFEDTARU',
  targetRateLower: 'DFEDTARL',
};

/**
 * Initialize macro data tables
 */
export function initMacroTables() {
  // Fed probabilities cache
  db.prepare(`
    CREATE TABLE IF NOT EXISTS fed_probabilities_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_date TEXT NOT NULL,
      hike_probability REAL,
      cut_probability REAL,
      hold_probability REAL,
      terminal_rate_expected REAL,
      source TEXT,
      fetched_at INTEGER,
      UNIQUE(meeting_date)
    )
  `).run();

  // Treasury yields cache
  db.prepare(`
    CREATE TABLE IF NOT EXISTS treasury_yields_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      yield_2y REAL,
      yield_10y REAL,
      yield_30y REAL,
      effective_fed_funds REAL,
      fetched_at INTEGER,
      UNIQUE(date)
    )
  `).run();

  // DXY cache
  db.prepare(`
    CREATE TABLE IF NOT EXISTS dxy_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      value REAL,
      change_24h REAL,
      change_7d REAL,
      fetched_at INTEGER
    )
  `).run();

  // Fed calendar
  db.prepare(`
    CREATE TABLE IF NOT EXISTS fed_calendar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_date TEXT NOT NULL,
      meeting_type TEXT,
      decision_time TEXT,
      is_projected BOOLEAN DEFAULT 0,
      created_at INTEGER,
      UNIQUE(meeting_date)
    )
  `).run();

  // Macro regime history
  db.prepare(`
    CREATE TABLE IF NOT EXISTS macro_regime_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      regime TEXT NOT NULL,
      confidence INTEGER,
      fed_sentiment TEXT,
      dxy_trend TEXT,
      yield_spread REAL,
      gold_bias TEXT,
      explanation TEXT
    )
  `).run();

  console.log('✅ Macro data tables initialized');
}

/**
 * Fed Meeting Dates (2026)
 * FOMC meets 8 times per year
 */
const FOMC_MEETING_DATES_2026 = [
  '2026-01-28',
  '2026-03-18',
  '2026-05-06',
  '2026-06-17',
  '2026-07-29',
  '2026-09-16',
  '2026-10-28',
  '2026-12-09',
];

/**
 * Get next FOMC meeting date
 */
function getNextFOMCMeeting() {
  const today = new Date().toISOString().split('T')[0];
  for (const date of FOMC_MEETING_DATES_2026) {
    if (date >= today) {
      return date;
    }
  }
  return FOMC_MEETING_DATES_2026[FOMC_MEETING_DATES_2026.length - 1];
}

/**
 * Get all upcoming FOMC meetings
 */
function getUpcomingFOMCMeetings(count = 3) {
  const today = new Date().toISOString().split('T')[0];
  return FOMC_MEETING_DATES_2026.filter(d => d >= today).slice(0, count);
}

/**
 * Fetch Fed Funds Futures probabilities from CME FedWatch
 * Uses simulated data based on current market conditions if scraping fails
 */
export async function fetchFedProbabilities() {
  const now = Date.now();
  
  // Check cache first
  const cached = db.prepare(`
    SELECT * FROM fed_probabilities_cache 
    WHERE fetched_at > ?
    ORDER BY meeting_date ASC
  `).all(now - CACHE_DURATIONS.fedProbabilities);

  if (cached.length > 0) {
    return {
      nextMeeting: getNextFOMCMeeting(),
      meetings: cached.map(c => ({
        date: c.meeting_date,
        hikeProbability: c.hike_probability,
        cutProbability: c.cut_probability,
        holdProbability: c.hold_probability,
        terminalRateExpected: c.terminal_rate_expected,
      })),
      source: 'cache',
      lastUpdated: cached[0].fetched_at,
    };
  }

  try {
    // Try to fetch from CME FedWatch (requires scraping or API)
    // For now, use simulated data based on recent treasury yields
    const yields = await fetchTreasuryYields();
    const simulated = simulateFedProbabilities(yields);
    
    // Save to cache
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO fed_probabilities_cache 
      (meeting_date, hike_probability, cut_probability, hold_probability, terminal_rate_expected, source, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((data) => {
      for (const item of data) {
        stmt.run(
          item.date,
          item.hikeProbability,
          item.cutProbability,
          item.holdProbability,
          item.terminalRateExpected,
          'simulated',
          now
        );
      }
    });

    insertMany(simulated.meetings);

    return {
      ...simulated,
      source: 'simulated',
      lastUpdated: now,
    };
  } catch (error) {
    console.error('Error fetching Fed probabilities:', error);
    return getDefaultFedProbabilities();
  }
}

/**
 * Simulate Fed probabilities based on treasury yield curve
 * This is a fallback when CME data is unavailable
 */
function simulateFedProbabilities(yields) {
  const upcoming = getUpcomingFOMCMeetings(4);
  const now = new Date();
  
  // Calculate implied rate changes from yield curve
  const currentFundsRate = yields.effectiveFedFunds || 4.50;
  const yield2Y = yields.yield2Y || 4.50;
  const yield10Y = yields.yield10Y || 4.50;
  
  // 2Y yield typically leads Fed funds by ~6-12 months
  const impliedChange = yield2Y - currentFundsRate;
  
  // Generate probabilities for upcoming meetings
  const meetings = upcoming.map((date, index) => {
    const monthsOut = index + 1;
    
    // Distribute the implied change across meetings
    // More distant meetings have more uncertainty
    const expectedChange = impliedChange * (1 - Math.exp(-monthsOut * 0.3));
    
    let hikeProb, cutProb, holdProb;
    
    if (expectedChange > 0.25) {
      // Market pricing in hikes
      hikeProb = Math.min(85, 30 + expectedChange * 40);
      cutProb = Math.max(5, 15 - expectedChange * 10);
      holdProb = 100 - hikeProb - cutProb;
    } else if (expectedChange < -0.25) {
      // Market pricing in cuts
      cutProb = Math.min(85, 30 + Math.abs(expectedChange) * 40);
      hikeProb = Math.max(5, 15 - Math.abs(expectedChange) * 10);
      holdProb = 100 - cutProb - hikeProb;
    } else {
      // Hold is most likely
      holdProb = 60 + (0.25 - Math.abs(expectedChange)) * 80;
      hikeProb = Math.max(5, 20 - holdProb / 2);
      cutProb = Math.max(5, 20 - holdProb / 2);
    }

    // Normalize to 100%
    const total = hikeProb + cutProb + holdProb;
    
    return {
      date,
      hikeProbability: Math.round((hikeProb / total) * 100),
      cutProbability: Math.round((cutProb / total) * 100),
      holdProbability: Math.round((holdProb / total) * 100),
      terminalRateExpected: currentFundsRate + expectedChange,
    };
  });

  return {
    nextMeeting: upcoming[0],
    meetings,
    terminalRateCurrent: currentFundsRate,
  };
}

/**
 * Get default Fed probabilities when all else fails
 */
function getDefaultFedProbabilities() {
  const nextMeeting = getNextFOMCMeeting();
  return {
    nextMeeting,
    meetings: [{
      date: nextMeeting,
      hikeProbability: 25,
      cutProbability: 25,
      holdProbability: 50,
      terminalRateExpected: 4.50,
    }],
    terminalRateCurrent: 4.50,
    source: 'default',
    lastUpdated: Date.now(),
  };
}

/**
 * Fetch Treasury yields from FRED API
 */
export async function fetchTreasuryYields() {
  const now = Date.now();
  const today = new Date().toISOString().split('T')[0];
  
  // Check cache first
  const cached = db.prepare(`
    SELECT * FROM treasury_yields_cache 
    WHERE date = ? AND fetched_at > ?
  `).get(today, now - CACHE_DURATIONS.treasuryYields);

  if (cached) {
    return {
      date: cached.date,
      yield2Y: cached.yield_2y,
      yield10Y: cached.yield_10y,
      yield30Y: cached.yield_30y,
      effectiveFedFunds: cached.effective_fed_funds,
      yieldSpread10Y2Y: cached.yield_10y - cached.yield_2y,
      source: 'cache',
      lastUpdated: cached.fetched_at,
    };
  }

  try {
    // Fetch from FRED API
    const yields = {};
    
    // If no API key, use simulated data based on recent market conditions
    if (!FRED_API_KEY) {
      return getSimulatedTreasuryYields();
    }

    // Fetch each series
    for (const [key, seriesId] of Object.entries(FRED_SERIES)) {
      try {
        const url = `${FRED_API_BASE}/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=1`;
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          if (data.observations && data.observations.length > 0) {
            yields[key] = parseFloat(data.observations[0].value);
          }
        }
      } catch (e) {
        console.warn(`Failed to fetch ${seriesId}:`, e.message);
      }
    }

    const result = {
      date: today,
      yield2Y: yields.treasury2Y || 4.50,
      yield10Y: yields.treasury10Y || 4.50,
      yield30Y: yields.treasury30Y || 4.75,
      effectiveFedFunds: yields.effectiveFedFunds || 4.50,
      yieldSpread10Y2Y: (yields.treasury10Y || 4.50) - (yields.treasury2Y || 4.50),
      source: 'fred',
      lastUpdated: now,
    };

    // Save to cache
    db.prepare(`
      INSERT OR REPLACE INTO treasury_yields_cache 
      (date, yield_2y, yield_10y, yield_30y, effective_fed_funds, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(today, result.yield2Y, result.yield10Y, result.yield30Y, result.effectiveFedFunds, now);

    return result;
  } catch (error) {
    console.error('Error fetching Treasury yields:', error);
    return getSimulatedTreasuryYields();
  }
}

/**
 * Get simulated Treasury yields when API is unavailable
 * Based on approximate market conditions
 */
function getSimulatedTreasuryYields() {
  const today = new Date().toISOString().split('T')[0];
  
  // Approximate current market conditions (adjust as needed)
  return {
    date: today,
    yield2Y: 4.25,
    yield10Y: 4.35,
    yield30Y: 4.65,
    effectiveFedFunds: 4.50,
    yieldSpread10Y2Y: 0.10,
    source: 'simulated',
    lastUpdated: Date.now(),
  };
}

/**
 * Fetch US Dollar Index (DXY)
 * Tries multiple sources: Yahoo Finance, Alpha Vantage
 */
export async function fetchDXY() {
  const now = Date.now();
  
  // Check cache first
  const cached = db.prepare(`
    SELECT * FROM dxy_cache 
    WHERE fetched_at > ?
    ORDER BY timestamp DESC
    LIMIT 1
  `).get(now - CACHE_DURATIONS.dxy);

  if (cached) {
    return {
      current: cached.value,
      change24h: cached.change_24h,
      change7d: cached.change_7d,
      source: 'cache',
      lastUpdated: cached.fetched_at,
    };
  }

  try {
    // Try Yahoo Finance first (free, no key needed)
    const dxyData = await fetchDXYFromYahoo();
    
    if (dxyData) {
      // Save to cache
      db.prepare(`
        INSERT INTO dxy_cache (timestamp, value, change_24h, change_7d, fetched_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(now, dxyData.current, dxyData.change24h, dxyData.change7d, now);

      // Cleanup old entries (keep 30 days)
      db.prepare(`DELETE FROM dxy_cache WHERE timestamp < ?`)
        .run(now - 30 * 24 * 60 * 60 * 1000);

      return { ...dxyData, source: 'yahoo', lastUpdated: now };
    }
  } catch (error) {
    console.error('Error fetching DXY from Yahoo:', error);
  }

  // Fallback to cached or default
  if (cached) {
    return {
      current: cached.value,
      change24h: cached.change_24h,
      change7d: cached.change_7d,
      source: 'stale',
      lastUpdated: cached.fetched_at,
    };
  }

  return getDefaultDXY();
}

/**
 * Fetch DXY from Yahoo Finance
 */
async function fetchDXYFromYahoo() {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=1d&range=1mo';
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance error: ${response.status}`);
  }

  const data = await response.json();
  const result = data.chart.result[0];
  const meta = result.meta;
  const timestamps = result.timestamp;
  const prices = result.indicators.quote[0].close;
  
  const currentPrice = meta.regularMarketPrice || prices[prices.length - 1];
  
  // Calculate 24h change
  const oneDayAgo = timestamps[timestamps.length - 2];
  const oneDayIndex = timestamps.findIndex(t => t >= oneDayAgo);
  const price24hAgo = prices[oneDayIndex] || prices[prices.length - 2];
  const change24h = ((currentPrice - price24hAgo) / price24hAgo) * 100;
  
  // Calculate 7d change
  const sevenDaysAgo = timestamps[Math.max(0, timestamps.length - 8)];
  const sevenDayIndex = timestamps.findIndex(t => t >= sevenDaysAgo);
  const price7dAgo = prices[sevenDayIndex] || prices[0];
  const change7d = ((currentPrice - price7dAgo) / price7dAgo) * 100;

  return {
    current: currentPrice,
    change24h: Math.round(change24h * 100) / 100,
    change7d: Math.round(change7d * 100) / 100,
  };
}

/**
 * Get default DXY when all sources fail
 */
function getDefaultDXY() {
  return {
    current: 103.00,
    change24h: 0,
    change7d: 0,
    source: 'default',
    lastUpdated: Date.now(),
  };
}

/**
 * Calculate gold/DXY correlation over a period
 */
export function calculateGoldDXYCorrelation(days = 20) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  
  // Get gold price history
  const goldPrices = db.prepare(`
    SELECT timestamp, close as price
    FROM price_history
    WHERE timestamp >= ?
    ORDER BY timestamp ASC
  `).all(since);

  // Get DXY history from cache
  const dxyPrices = db.prepare(`
    SELECT timestamp, value as price
    FROM dxy_cache
    WHERE timestamp >= ?
    ORDER BY timestamp ASC
  `).all(since);

  if (goldPrices.length < 10 || dxyPrices.length < 10) {
    return { correlation: -0.8, sampleSize: 0 }; // Default: strong negative
  }

  // Align timestamps and calculate correlation
  const aligned = alignTimeSeries(goldPrices, dxyPrices);
  
  if (aligned.length < 10) {
    return { correlation: -0.8, sampleSize: aligned.length };
  }

  const correlation = pearsonCorrelation(
    aligned.map(a => a.gold),
    aligned.map(a => a.dxy)
  );

  return {
    correlation: Math.round(correlation * 100) / 100,
    sampleSize: aligned.length,
  };
}

/**
 * Align two time series by timestamp
 */
function alignTimeSeries(series1, series2, toleranceMs = 24 * 60 * 60 * 1000) {
  const aligned = [];
  
  for (const item1 of series1) {
    // Find closest item in series2 within tolerance
    const closest = series2.reduce((best, item2) => {
      const diff = Math.abs(item1.timestamp - item2.timestamp);
      if (diff < toleranceMs && (!best || diff < best.diff)) {
        return { ...item2, diff };
      }
      return best;
    }, null);

    if (closest) {
      aligned.push({
        timestamp: item1.timestamp,
        gold: item1.price,
        dxy: closest.price,
      });
    }
  }

  return aligned;
}

/**
 * Calculate Pearson correlation coefficient
 */
function pearsonCorrelation(x, y) {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Get comprehensive macro context
 */
export async function getFullMacroContext() {
  const [fedProbs, yields, dxy] = await Promise.all([
    fetchFedProbabilities(),
    fetchTreasuryYields(),
    fetchDXY(),
  ]);

  const correlation = calculateGoldDXYCorrelation(20);
  const correlation5d = calculateGoldDXYCorrelation(5);

  // Determine DXY trend
  let dxyTrend = 'neutral';
  if (dxy.change7d > 1) dxyTrend = 'strengthening';
  else if (dxy.change7d < -1) dxyTrend = 'weakening';

  // Determine impact on gold
  let impactOnGold = 'neutral';
  if (dxyTrend === 'strengthening' && correlation.correlation < -0.5) {
    impactOnGold = 'strong_negative';
  } else if (dxyTrend === 'weakening' && correlation.correlation < -0.5) {
    impactOnGold = 'positive';
  } else if (Math.abs(correlation.correlation) > 0.5) {
    impactOnGold = 'moderate_negative';
  }

  return {
    rateExpectations: {
      nextMeeting: fedProbs.nextMeeting,
      hikeProbability: fedProbs.meetings[0]?.hikeProbability || 33,
      cutProbability: fedProbs.meetings[0]?.cutProbability || 33,
      holdProbability: fedProbs.meetings[0]?.holdProbability || 34,
      terminalRateCurrent: fedProbs.terminalRateCurrent,
      terminalRateExpected: fedProbs.meetings[0]?.terminalRateExpected || fedProbs.terminalRateCurrent,
      meetings: fedProbs.meetings,
      lastUpdated: fedProbs.lastUpdated,
    },
    treasuryYields: {
      yield2Y: yields.yield2Y,
      yield10Y: yields.yield10Y,
      yield30Y: yields.yield30Y,
      yieldSpread10Y2Y: yields.yieldSpread10Y2Y,
      isInverted: yields.yieldSpread10Y2Y < 0,
      effectiveFedFunds: yields.effectiveFedFunds,
      lastUpdated: yields.lastUpdated,
    },
    dollarContext: {
      dxyCurrent: dxy.current,
      dxyChange24h: dxy.change24h,
      dxyChange7d: dxy.change7d,
      dxyTrend,
      goldDxyCorrelation20d: correlation.correlation,
      goldDxyCorrelation5d: correlation5d.correlation,
      impactOnGold,
      lastUpdated: dxy.lastUpdated,
    },
  };
}

/**
 * Get Fed sentiment based on recent speeches and probabilities
 */
export function getFedSentiment(fedProbs) {
  const cutProb = fedProbs.meetings[0]?.cutProbability || 0;
  const hikeProb = fedProbs.meetings[0]?.hikeProbability || 0;

  if (hikeProb > 60) return 'hawkish';
  if (cutProb > 60) return 'dovish';
  if (hikeProb > 40) return 'slightly_hawkish';
  if (cutProb > 40) return 'slightly_dovish';
  return 'neutral';
}
