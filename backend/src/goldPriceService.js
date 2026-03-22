import db from './database.js';

/**
 * Gold Price Service
 * 
 * Data Sources:
 * 1. Real-time: Swissquote forex feed (free, no auth) - stored in intraday_ticks
 * 2. Historical daily: FreeGoldAPI (free, no auth) - stored in price_history
 * 3. Daily aggregates: Computed from intraday_ticks - stored in daily_aggregates
 * 
 * Database Tables:
 * - price_history: Historical daily data from FreeGoldAPI (for charts)
 * - intraday_ticks: Every Swissquote price update (retained 1 year)
 * - daily_aggregates: Daily bid/ask high/low from Swissquote ticks
 */

const SWISSQUOTE_URL = 'https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD';
const FREEGOLDAPI_URL = 'https://freegoldapi.com/data/latest.json';
const YAHOO_FINANCE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const GOLD_SYMBOL = 'GC=F';

// Maximum allowed future timestamp skew (60 seconds to account for clock drift)
const MAX_FUTURE_SKEW_MS = 60000;

// Maximum allowed age of price data (5 minutes) - reject stale API responses
const MAX_PRICE_AGE_MS = 5 * 60 * 1000;

// Minimum timestamp difference to consider data "new" (handles API timestamp jitter)
const TIMESTAMP_JITTER_TOLERANCE_MS = 100;

// Track the latest timestamp we've seen to prevent price reversion
let latestTimestamp = 0;
let latestPriceData = null;

/**
 * Get the latest known price data (with timestamp tracking)
 */
export function getLatestPriceData() {
  return latestPriceData;
}

/**
 * Check if price data is fresh (not too old)
 * Returns true if data is within acceptable age limits
 */
function isPriceDataFresh(priceData) {
  if (!priceData || !priceData.timestamp) {
    return false;
  }

  const now = Date.now();

  // Reject future timestamps
  if (priceData.timestamp > now + MAX_FUTURE_SKEW_MS) {
    return false;
  }

  // Reject old timestamps
  const ageMs = now - priceData.timestamp;
  if (ageMs > MAX_PRICE_AGE_MS) {
    return false;
  }

  return true;
}

/**
 * Update latest price data if the new data is fresher
 * Returns true if the data was updated, false if it was stale
 */
function updateLatestPriceData(priceData) {
  if (!priceData || !priceData.timestamp) {
    return false;
  }

  const now = Date.now();

  // Reject future timestamps (with small allowance for clock skew)
  if (priceData.timestamp > now + MAX_FUTURE_SKEW_MS) {
    console.warn(`Rejecting future timestamp: ts=${priceData.timestamp} (now=${now}, diff=${priceData.timestamp - now}ms)`);
    return false;
  }

  // Reject zero or negative timestamps
  if (priceData.timestamp <= 0) {
    console.warn(`Rejecting invalid timestamp: ts=${priceData.timestamp}`);
    return false;
  }

  // Reject timestamps that are too old (API returning stale cached data)
  const ageMs = now - priceData.timestamp;
  if (ageMs > MAX_PRICE_AGE_MS) {
    console.warn(`Rejecting old price data: ts=${priceData.timestamp} (age=${Math.round(ageMs / 1000)}s, max=${MAX_PRICE_AGE_MS / 1000}s)`);
    return false;
  }

  // Only update if this data is fresher than what we have (with jitter tolerance)
  // Some APIs (like Swissquote) have timestamp jitter of a few ms between identical quotes
  if (priceData.timestamp >= latestTimestamp - TIMESTAMP_JITTER_TOLERANCE_MS) {
    latestTimestamp = Math.max(latestTimestamp, priceData.timestamp);
    latestPriceData = priceData;
    return true;
  }

  console.warn(`Rejecting stale price data: ts=${priceData.timestamp} vs latest=${latestTimestamp}`);
  return false;
}

/**
 * Fetch current price from Swissquote (primary source)
 * Saves tick to database for intraday tracking
 * 
 * CRITICAL: Always uses Swissquote's ts timestamp, never Date.now()
 * Prevents price reversion by tracking latest timestamp across all sources
 */
export async function fetchCurrentPrice() {
  let swissquotePrice = null;
  let yahooPrice = null;
  let cachedPrice = null;

  // Try Swissquote first (primary source with trusted timestamp)
  try {
    swissquotePrice = await fetchFromSwissquote();
    if (swissquotePrice) {
      // On weekends/after-hours, Swissquote returns last known price with old timestamp
      // We should still accept and use this data, just mark it accordingly
      const isFresh = isPriceDataFresh(swissquotePrice);
      
      if (!isFresh) {
        console.log('Swissquote timestamp is old (weekend/after-hours), accepting price anyway');
        // Mark as after-hours data but still use it
        swissquotePrice.source = 'Swissquote (after-hours)';
      }
      
      // Save to intraday tracking with provider_id
      saveIntradayTick(swissquotePrice, 'swissquote');
      updateDailyAggregate(swissquotePrice, 'swissquote');
      saveCurrentPrice(swissquotePrice);
      
      // Update our latest tracking
      updateLatestPriceData(swissquotePrice);
      return swissquotePrice;
    }
  } catch (error) {
    console.error('Swissquote fetch failed:', error.message);
  }

  // Fallback to Yahoo Finance only if we don't have recent Swissquote data
  try {
    yahooPrice = await fetchFromYahooFinance();
    if (yahooPrice) {
      // Accept Yahoo data even if timestamp is old (weekend/after-hours)
      const isFresh = isPriceDataFresh(yahooPrice);
      
      if (!isFresh) {
        console.log('Yahoo Finance timestamp is old (weekend/after-hours), accepting price anyway');
        yahooPrice.source = 'Yahoo Finance (after-hours)';
      }
      
      // Only use Yahoo if it's fresher than what we have
      if (updateLatestPriceData(yahooPrice)) {
        saveCurrentPrice(yahooPrice);
        return yahooPrice;
      }
    }
  } catch (error) {
    console.error('Yahoo Finance fetch failed:', error.message);
  }

  // Last resort: cached data from database
  cachedPrice = getLastSavedPrice();
  if (cachedPrice) {
    // Only return cached if we have nothing else
    if (!latestPriceData) {
      updateLatestPriceData(cachedPrice);
      return cachedPrice;
    }
    
    // Return the fresher of cached vs latest known
    if (cachedPrice.timestamp >= latestTimestamp) {
      updateLatestPriceData(cachedPrice);
      return cachedPrice;
    }
  }

  // Return the latest known good data (even if stale) rather than null
  return latestPriceData;
}

/**
 * Fetch from Swissquote forex data feed
 * 
 * CRITICAL: Always uses Swissquote's ts timestamp from the response.
 * The ts field is the authoritative timestamp from Swissquote.
 * Never falls back to Date.now() as that causes timestamp gaps.
 */
async function fetchFromSwissquote() {
  console.log('🔄 Fetching from Swissquote...');
  
  const response = await fetch(SWISSQUOTE_URL, {
    headers: {
      'User-Agent': 'GoldFibSignals/1.0',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Swissquote API error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data || data.length === 0) {
    throw new Error('Empty response from Swissquote');
  }

  const quote = data[0];

  // Validate spreadProfilePrices exists and is non-empty
  if (!quote.spreadProfilePrices || !Array.isArray(quote.spreadProfilePrices) || quote.spreadProfilePrices.length === 0) {
    throw new Error('Invalid Swissquote response: spreadProfilePrices missing or empty');
  }

  const prices = quote.spreadProfilePrices.find(p => p.spreadProfile === 'premium')
    || quote.spreadProfilePrices[0];

  // CRITICAL: Use Swissquote's timestamp. If missing, this is an error condition.
  // Do NOT fall back to Date.now() as that causes the flashing/reversion bug.
  const swissquoteTimestamp = quote.ts;
  if (!swissquoteTimestamp) {
    throw new Error('Swissquote response missing ts timestamp');
  }

  const timestamp = swissquoteTimestamp;

  console.log('✅ Swissquote price received:', prices.bid, '/', prices.ask, 'ts:', timestamp);

  const stats24h = get24hStats();

  return {
    price: (prices.bid + prices.ask) / 2,
    bid: prices.bid,
    ask: prices.ask,
    high24h: stats24h.high || prices.ask,
    low24h: stats24h.low || prices.bid,
    change24h: stats24h.change || 0,
    changePercent24h: stats24h.changePercent || 0,
    timestamp: timestamp,
    source: 'Swissquote',
  };
}

/**
 * Fetch from Yahoo Finance (backup)
 * 
 * Uses the actual timestamp from Yahoo's data, not Date.now()
 * to ensure proper timestamp ordering with Swissquote data.
 */
async function fetchFromYahooFinance() {
  console.log('🔄 Fetching from Yahoo Finance...');
  
  const url = `${YAHOO_FINANCE_URL}/${GOLD_SYMBOL}?interval=1d&range=5d`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance API error: ${response.status}`);
  }

  const data = await response.json();
  const result = data.chart.result[0];
  const meta = result.meta;
  const quote = result.indicators.quote[0];
  const lastIndex = result.timestamp.length - 1;

  const currentPrice = meta.regularMarketPrice || quote.close[lastIndex];
  const previousClose = meta.previousClose || quote.close[lastIndex - 1];
  
  // Use Yahoo's actual timestamp (converted from seconds to ms if needed)
  // Yahoo timestamps are in seconds, Swissquote are in milliseconds
  let yahooTimestamp = result.timestamp[lastIndex];
  if (yahooTimestamp && yahooTimestamp < 1000000000000) {
    yahooTimestamp = yahooTimestamp * 1000; // Convert seconds to milliseconds
  }

  return {
    price: currentPrice,
    bid: currentPrice * 0.9995,
    ask: currentPrice * 1.0005,
    high24h: Math.max(...quote.high.filter(h => h != null).slice(-2)),
    low24h: Math.min(...quote.low.filter(l => l != null).slice(-2)),
    change24h: currentPrice - previousClose,
    changePercent24h: ((currentPrice - previousClose) / previousClose) * 100,
    timestamp: yahooTimestamp || Date.now(),
    source: 'Yahoo Finance',
  };
}

/**
 * Save intraday tick to database (Swissquote data)
 * Retained for up to 1 year for accuracy analysis
 *
 * @param {Object} priceData - Price data to save
 * @param {string} providerId - Provider identifier (e.g., 'swissquote', 'goldapi', etc.)
 */
function saveIntradayTick(priceData, providerId = 'swissquote') {
  const stmt = db.prepare(`
    INSERT INTO intraday_ticks (timestamp, bid, ask, mid, spread, source, provider_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const mid = (priceData.bid + priceData.ask) / 2;
  const spread = priceData.ask - priceData.bid;

  // Use current time for intraday tick timestamp (not the price data timestamp)
  // This ensures ticks show up in today's intraday chart even when
  // the provider's timestamp is old (weekend/after-hours)
  const tickTimestamp = Date.now();

  stmt.run(
    tickTimestamp,
    priceData.bid,
    priceData.ask,
    mid,
    spread,
    priceData.source || providerId,
    providerId
  );
  // Note: Cleanup is handled by scheduled maintenance, not inline
}

/**
 * Update or create daily aggregate from Swissquote tick
 *
 * @param {Object} priceData - Price data to aggregate
 * @param {string} providerId - Provider identifier for tracking
 */
function updateDailyAggregate(priceData, providerId = 'swissquote') {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const mid = (priceData.bid + priceData.ask) / 2;

  // Use transaction for atomicity
  const updateAggregate = db.transaction(() => {
    // Check if today's aggregate exists
    const existing = db.prepare('SELECT * FROM daily_aggregates WHERE date = ?').get(today);

    if (existing) {
      // Update existing aggregate
      const stmt = db.prepare(`
        UPDATE daily_aggregates SET
          bid_high = MAX(bid_high, ?),
          bid_low = MIN(bid_low, ?),
          bid_close = ?,
          ask_high = MAX(ask_high, ?),
          ask_low = MIN(ask_low, ?),
          ask_close = ?,
          mid_high = MAX(mid_high, ?),
          mid_low = MIN(mid_low, ?),
          mid_close = ?,
          tick_count = tick_count + 1,
          last_tick_at = ?,
          source = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE date = ?
      `);

      stmt.run(
        priceData.bid, priceData.bid, priceData.bid,
        priceData.ask, priceData.ask, priceData.ask,
        mid, mid, mid,
        priceData.timestamp,
        providerId,
        today
      );
    } else {
      // Create new aggregate for today
      const stmt = db.prepare(`
        INSERT INTO daily_aggregates (
          date, bid_open, bid_high, bid_low, bid_close,
          ask_open, ask_high, ask_low, ask_close,
          mid_open, mid_high, mid_low, mid_close,
          tick_count, first_tick_at, last_tick_at, source
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
      `);

      stmt.run(
        today,
        priceData.bid, priceData.bid, priceData.bid, priceData.bid,
        priceData.ask, priceData.ask, priceData.ask, priceData.ask,
        mid, mid, mid, mid,
        priceData.timestamp, priceData.timestamp,
        providerId
      );
    }
  });

  updateAggregate();
}

/**
 * Fetch historical DAILY data from FreeGoldAPI
 * Stores in price_history table for chart reference
 */
export async function fetchHistoricalData(range = '1y', _interval = '1d') {
  console.log(`🔄 Fetching historical data (${range}) from FreeGoldAPI...`);
  
  try {
    const response = await fetch(FREEGOLDAPI_URL, {
      headers: {
        'User-Agent': 'GoldFibSignals/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`FreeGoldAPI error: ${response.status}`);
    }

    const allData = await response.json();
    
    // Filter to USD prices from yahoo_finance source
    const usdData = allData.filter(d => 
      d.source && d.source.includes('yahoo_finance') && d.price > 100
    );

    // Calculate date range
    const now = new Date();
    const rangeMs = {
      '1d': 1, '5d': 5, '1mo': 30, '3mo': 90,
      '6mo': 180, '1y': 365, '2y': 730, '5y': 1825, 'max': 36500,
    };

    const daysBack = rangeMs[range] || 365;
    const cutoffDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    // Convert to candle format
    const candles = usdData
      .filter(d => new Date(d.date) >= cutoffDate)
      .map(d => {
        const timestamp = new Date(d.date).getTime();
        const price = d.price;
        return {
          timestamp,
          open: price,
          high: price * 1.002,
          low: price * 0.998,
          close: price,
          volume: 0,
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    console.log(`✅ Loaded ${candles.length} daily candles from FreeGoldAPI`);

    // Save to database
    savePriceHistory(candles);

    // Try to fill any gaps with Yahoo Finance data
    await fetchYahooFinanceHistorical(range);

    return candles;
  } catch (error) {
    console.error('FreeGoldAPI fetch failed:', error.message);
    return getCachedHistory(range);
  }
}

/**
 * Fetch historical data from Yahoo Finance to fill gaps
 * Complements FreeGoldAPI data for more complete history
 */
async function fetchYahooFinanceHistorical(range = '1y') {
  console.log(`🔄 Fetching historical data (${range}) from Yahoo Finance...`);
  
  try {
    const rangeParam = range === '1y' ? '1y' : range === '5y' ? '5y' : '1y';
    const url = `${YAHOO_FINANCE_URL}/${GOLD_SYMBOL}?interval=1d&range=${rangeParam}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data.chart.result[0];
    
    if (!result || !result.timestamp || !result.indicators) {
      throw new Error('Invalid Yahoo Finance response');
    }

    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];
    
    // Build candles from Yahoo data
    const candles = [];
    for (let i = 0; i < timestamps.length; i++) {
      // Skip if no data for this day
      if (quote.open[i] === null || quote.high[i] === null || 
          quote.low[i] === null || quote.close[i] === null) {
        continue;
      }
      
      candles.push({
        timestamp: timestamps[i] * 1000, // Convert seconds to ms
        open: quote.open[i],
        high: quote.high[i],
        low: quote.low[i],
        close: quote.close[i],
        volume: quote.volume[i] || 0,
      });
    }

    console.log(`✅ Loaded ${candles.length} daily candles from Yahoo Finance`);

    // Save to database (marking as yahoo_finance source)
    saveYahooFinanceHistory(candles);

    return candles;
  } catch (error) {
    console.error('Yahoo Finance historical fetch failed:', error.message);
    return [];
  }
}

/**
 * Save Yahoo Finance historical data to database
 * Only inserts dates that don't already exist from FreeGoldAPI
 */
function saveYahooFinanceHistory(candles) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO price_history (timestamp, open, high, low, close, volume, source)
    VALUES (?, ?, ?, ?, ?, ?, 'yahoo_finance')
  `);

  const insertMany = db.transaction((candles) => {
    let inserted = 0;
    for (const candle of candles) {
      const result = stmt.run(candle.timestamp, candle.open, candle.high, candle.low, candle.close, candle.volume);
      if (result.changes > 0) inserted++;
    }
    console.log(`✅ Saved ${inserted} new daily candles from Yahoo Finance (skipped existing)`);
  });

  insertMany(candles);
}

/**
 * Save historical price data to database
 */
function savePriceHistory(candles) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO price_history (timestamp, open, high, low, close, volume, source)
    VALUES (?, ?, ?, ?, ?, ?, 'freegoldapi')
  `);

  const insertMany = db.transaction((candles) => {
    for (const candle of candles) {
      stmt.run(candle.timestamp, candle.open, candle.high, candle.low, candle.close, candle.volume);
    }
  });

  insertMany(candles);
  console.log(`✅ Saved ${candles.length} daily candles to database`);
}

/**
 * Get historical data from database (for charts)
 * Combines FreeGoldAPI historical data with Swissquote daily aggregates
 * 
 * NOTE: This function returns historical daily data that is NOT provider-specific.
 * - price_history: Contains daily data from FreeGoldAPI (source: 'freegoldapi')
 * - daily_aggregates: Contains daily OHLC computed from intraday_ticks
 * 
 * For provider-specific intraday data, use getIntradayTicks() with providerId filter.
 */
export function getHistoryFromDatabase(days = 365) {
  const since = Date.now() - (days * 24 * 60 * 60 * 1000);
  
  // Get historical data from price_history
  const historical = db.prepare(`
    SELECT timestamp, open, high, low, close, volume, source
    FROM price_history
    WHERE timestamp >= ?
    ORDER BY timestamp ASC
  `).all(since);

  // Get recent daily aggregates from Swissquote data
  const recentDays = 30;
  const recentSince = new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  const aggregates = db.prepare(`
    SELECT 
      date,
      mid_open as open,
      mid_high as high,
      mid_low as low,
      mid_close as close,
      tick_count,
      first_tick_at as timestamp,
      source
    FROM daily_aggregates
    WHERE date >= ?
    ORDER BY date ASC
  `).all(recentSince);

  // Convert aggregates to match historical format
  const aggregateCandles = aggregates.map(agg => ({
    timestamp: new Date(agg.date).getTime(),
    open: agg.open,
    high: agg.high,
    low: agg.low,
    close: agg.close,
    volume: agg.tick_count || 0,
    source: 'swissquote_aggregate',
  }));

  // Merge: prefer Swissquote aggregates for recent days
  const historicalMap = new Map();
  
  historical.forEach(h => {
    const dateKey = new Date(h.timestamp).toISOString().split('T')[0];
    historicalMap.set(dateKey, h);
  });

  // Overlay Swissquote aggregates (more accurate for recent days)
  aggregateCandles.forEach(a => {
    const dateKey = new Date(a.timestamp).toISOString().split('T')[0];
    historicalMap.set(dateKey, a);
  });

  // Convert back to array and sort
  return Array.from(historicalMap.values())
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Get cached history from database
 */
function getCachedHistory(range) {
  const rangeMs = {
    '1d': 1, '5d': 5, '1mo': 30, '3mo': 90,
    '6mo': 180, '1y': 365, '2y': 730, '3y': 1095,
  };

  const days = rangeMs[range] || 365;
  return getHistoryFromDatabase(days);
}

/**
 * Get intraday ticks for a specific date range
 * For accuracy comparison against historical data
 * 
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {string} providerId - Optional provider ID to filter by
 */
export function getIntradayTicks(startDate, endDate, providerId = null) {
  const startTs = new Date(startDate).getTime();
  // Add 24 hours to include the full end date (endDate at midnight means start of that day)
  const endTs = new Date(endDate).getTime() + (24 * 60 * 60 * 1000);

  if (providerId) {
    return db.prepare(`
      SELECT timestamp, bid, ask, mid, spread, source, provider_id
      FROM intraday_ticks
      WHERE timestamp >= ? AND timestamp < ? AND provider_id = ?
      ORDER BY timestamp ASC
    `).all(startTs, endTs, providerId);
  }

  return db.prepare(`
    SELECT timestamp, bid, ask, mid, spread, source, provider_id
    FROM intraday_ticks
    WHERE timestamp >= ? AND timestamp < ?
    ORDER BY timestamp ASC
  `).all(startTs, endTs);
}

/**
 * Get daily aggregates for comparison
 */
export function getDailyAggregates(startDate, endDate) {
  return db.prepare(`
    SELECT *
    FROM daily_aggregates
    WHERE date >= ? AND date <= ?
    ORDER BY date ASC
  `).all(startDate, endDate);
}

/**
 * Compare Swissquote data against FreeGoldAPI for accuracy
 */
export function getAccuracyComparison(date) {
  // Get FreeGoldAPI data for the date
  const dateTs = new Date(date).getTime();
  const nextDateTs = dateTs + 24 * 60 * 60 * 1000;

  const historical = db.prepare(`
    SELECT * FROM price_history
    WHERE timestamp >= ? AND timestamp < ?
    LIMIT 1
  `).get(dateTs, nextDateTs);

  // Get Swissquote aggregate for the date
  const aggregate = db.prepare(`
    SELECT * FROM daily_aggregates WHERE date = ?
  `).get(date);

  if (!historical || !aggregate) {
    return null;
  }

  return {
    date,
    freegoldapi: {
      close: historical.close,
      high: historical.high,
      low: historical.low,
    },
    swissquote: {
      close: aggregate.mid_close,
      high: aggregate.mid_high,
      low: aggregate.mid_low,
      bidHigh: aggregate.bid_high,
      bidLow: aggregate.bid_low,
      askHigh: aggregate.ask_high,
      askLow: aggregate.ask_low,
      tickCount: aggregate.tick_count,
    },
    variance: {
      close: Math.abs(historical.close - aggregate.mid_close),
      closePercent: Math.abs((historical.close - aggregate.mid_close) / historical.close * 100),
    }
  };
}

/**
 * Get 24h stats from saved prices
 */
function get24hStats() {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  
  const stats = db.prepare(`
    SELECT 
      MAX(price) as high,
      MIN(price) as low,
      (SELECT price FROM price_snapshots WHERE timestamp >= ? ORDER BY timestamp ASC LIMIT 1) as open_price
    FROM price_snapshots
    WHERE timestamp >= ?
  `).get(since, since);

  if (!stats || !stats.open_price) {
    return { high: null, low: null, change: 0, changePercent: 0 };
  }

  const latestPrice = db.prepare(`
    SELECT price FROM price_snapshots ORDER BY timestamp DESC LIMIT 1
  `).get();

  const currentPrice = latestPrice?.price || 0;
  const change = currentPrice - stats.open_price;
  const changePercent = stats.open_price ? (change / stats.open_price) * 100 : 0;

  return { high: stats.high, low: stats.low, change, changePercent };
}

/**
 * Save current price snapshot
 */
function saveCurrentPrice(priceData) {
  const stmt = db.prepare(`
    INSERT INTO price_snapshots (price, bid, ask, high_24h, low_24h, change_24h, change_percent_24h, timestamp, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    priceData.price, priceData.bid, priceData.ask,
    priceData.high24h, priceData.low24h,
    priceData.change24h, priceData.changePercent24h,
    priceData.timestamp, priceData.source
  );
  // Note: Cleanup is handled by scheduled maintenance, not inline
}

/**
 * Get last saved price
 */
function getLastSavedPrice() {
  const row = db.prepare(`
    SELECT * FROM price_snapshots ORDER BY timestamp DESC LIMIT 1
  `).get();

  if (row) {
    return {
      price: row.price,
      bid: row.bid,
      ask: row.ask,
      high24h: row.high_24h,
      low24h: row.low_24h,
      change24h: row.change_24h,
      changePercent24h: row.change_percent_24h,
      timestamp: row.timestamp,
      source: row.source + ' (cached)',
    };
  }
  return null;
}

/**
 * Manual refresh
 * Forces a fresh fetch from Swissquote
 */
export async function manualRefresh() {
  console.log('🔄 Manual refresh triggered...');
  
  // Try Swissquote first directly
  try {
    const swissquotePrice = await fetchFromSwissquote();
    if (swissquotePrice) {
      saveIntradayTick(swissquotePrice, 'swissquote');
      updateDailyAggregate(swissquotePrice, 'swissquote');
      saveCurrentPrice(swissquotePrice);
      updateLatestPriceData(swissquotePrice);
      return swissquotePrice;
    }
  } catch (error) {
    console.error('Manual refresh - Swissquote failed:', error.message);
  }
  
  // Fall back to normal flow
  return fetchCurrentPrice();
}

/**
 * Fetch from Swissquote only (for automatic polling)
 * Saves tick and updates aggregates without fallback
 * 
 * CRITICAL: Always uses Swissquote's ts timestamp.
 */
export async function fetchFromSwissquoteOnly() {
  try {
    const response = await fetch(SWISSQUOTE_URL, {
      headers: {
        'User-Agent': 'GoldFibSignals/1.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Swissquote API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data || data.length === 0) {
      throw new Error('Empty response from Swissquote');
    }

    const quote = data[0];

    // Validate spreadProfilePrices exists and is non-empty
    if (!quote.spreadProfilePrices || !Array.isArray(quote.spreadProfilePrices) || quote.spreadProfilePrices.length === 0) {
      throw new Error('Invalid Swissquote response: spreadProfilePrices missing or empty');
    }

    const prices = quote.spreadProfilePrices.find(p => p.spreadProfile === 'premium')
      || quote.spreadProfilePrices[0];

    // CRITICAL: Use Swissquote's timestamp, never Date.now()
    const swissquoteTimestamp = quote.ts;
    if (!swissquoteTimestamp) {
      throw new Error('Swissquote poll: missing ts timestamp in response');
    }
    const timestamp = swissquoteTimestamp;

    const priceData = {
      price: (prices.bid + prices.ask) / 2,
      bid: prices.bid,
      ask: prices.ask,
      timestamp: timestamp,
      source: 'Swissquote',
    };

    // Save tick and update aggregates with provider_id
    saveIntradayTick(priceData, 'swissquote');
    updateDailyAggregate(priceData, 'swissquote');
    
    // Update our latest tracking
    updateLatestPriceData(priceData);

    return priceData;
  } catch (error) {
    console.error('Swissquote poll failed:', error.message);
    return null;
  }
}

/**
 * Get tick statistics for monitoring
 */
export function getTickStats() {
  const today = new Date().toISOString().split('T')[0];
  
  // Today's tick count
  const todayTicks = db.prepare(`
    SELECT COUNT(*) as count FROM intraday_ticks 
    WHERE timestamp >= ?
  `).get(Date.now() - 24 * 60 * 60 * 1000);

  // Total ticks
  const totalTicks = db.prepare('SELECT COUNT(*) as count FROM intraday_ticks').get();

  // Today's aggregate
  const todayAggregate = db.prepare('SELECT * FROM daily_aggregates WHERE date = ?').get(today);

  // Database size estimate
  const dbSize = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get();

  return {
    today: {
      date: today,
      tickCount: todayTicks?.count || 0,
      aggregate: todayAggregate || null,
    },
    total: {
      tickCount: totalTicks?.count || 0,
      dbSizeBytes: dbSize?.size || 0,
      dbSizeMB: ((dbSize?.size || 0) / 1024 / 1024).toFixed(2),
    }
  };
}

/**
 * Get price history (for API endpoint)
 */
export function getPriceHistory(days = 365) {
  return getHistoryFromDatabase(days);
}

/**
 * Fetch from configured API provider
 */
export async function fetchFromConfiguredApi(provider) {
  try {
    const symbol = provider.symbolFormat || 'XAU';
    const currency = provider.currencyFormat || 'USD';
    
    let url = provider.endpoint
      .replace(':symbol', symbol)
      .replace(':currency', currency)
      .replace(':date?', '');

    url = url.replace(/\/+$/, '');

    console.log(`🔄 Fetching from ${provider.name}: ${url}`);

    const headers = {
      'User-Agent': 'GoldFibSignals/1.0',
      ...(provider.headers || {}),
    };

    if (provider.name.toLowerCase().includes('goldapi')) {
      headers['x-access-token'] = provider.apiKey;
    } else {
      headers['Authorization'] = `Bearer ${provider.apiKey}`;
    }

    const response = await fetch(url, {
      method: provider.requestType || 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error from ${provider.name}:`, response.status, errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Received data from ${provider.name}`);

    let priceData;
    
    if (provider.name.toLowerCase().includes('goldapi')) {
      // GoldAPI provides timestamp in seconds, convert to ms
      const apiTimestamp = data.timestamp ? data.timestamp * 1000 : Date.now();
      priceData = {
        price: data.price,
        bid: data.bid || data.price * 0.9995,
        ask: data.ask || data.price * 1.0005,
        high24h: data.high_price || data.price,
        low24h: data.low_price || data.price,
        change24h: data.ch || 0,
        changePercent24h: data.chp || 0,
        timestamp: apiTimestamp,
        source: provider.name,
      };
    } else {
      // For other providers, try to extract timestamp if available
      const apiTimestamp = data.timestamp 
        ? (data.timestamp < 1000000000000 ? data.timestamp * 1000 : data.timestamp)
        : Date.now();
      priceData = {
        price: data.price || data.rate || data.value || data.last,
        bid: data.bid || data.price * 0.9995,
        ask: data.ask || data.price * 1.0005,
        high24h: data.high || data.high_24h || data.price,
        low24h: data.low || data.low_24h || data.price,
        change24h: data.change || data.ch || 0,
        changePercent24h: data.change_percent || data.chp || 0,
        timestamp: apiTimestamp,
        source: provider.name,
      };
    }

    saveCurrentPrice(priceData);
    // Also save to intraday ticks with provider_id for provider-specific tracking
    saveIntradayTick(priceData, provider.id || provider.name.toLowerCase().replace(/\s+/g, '_'));
    updateLatestPriceData(priceData);
    return priceData;
  } catch (error) {
    console.error(`Error fetching from ${provider.name}:`, error.message);
    return null;
  }
}
