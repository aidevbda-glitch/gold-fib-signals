import db from './database.js';

/**
 * Gold Price Service
 * Uses free Yahoo Finance API for real-time and historical data
 * 
 * Symbols:
 * - GC=F: Gold Futures (COMEX)
 * - XAUUSD=X: Gold/USD Forex pair
 */

const YAHOO_FINANCE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const GOLD_SYMBOL = 'GC=F'; // Gold Futures - most liquid

/**
 * Fetch current gold price from Yahoo Finance
 */
export async function fetchCurrentPrice() {
  try {
    const url = `${YAHOO_FINANCE_URL}/${GOLD_SYMBOL}?interval=1m&range=1d`;
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
    const timestamps = result.timestamp;

    // Get latest price
    const lastIndex = timestamps.length - 1;
    const currentPrice = meta.regularMarketPrice || quote.close[lastIndex];
    
    // Calculate 24h high/low from the data
    const closes = quote.close.filter(c => c != null);
    const highs = quote.high.filter(h => h != null);
    const lows = quote.low.filter(l => l != null);

    const priceData = {
      price: currentPrice,
      bid: currentPrice * 0.9995, // Approximate spread
      ask: currentPrice * 1.0005,
      high24h: Math.max(...highs),
      low24h: Math.min(...lows),
      change24h: meta.regularMarketPrice - meta.previousClose,
      changePercent24h: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
      timestamp: Date.now(),
      source: 'Yahoo Finance (GC=F)'
    };

    // Save snapshot to database
    saveCurrentPrice(priceData);

    return priceData;
  } catch (error) {
    console.error('Error fetching current price:', error);
    // Return last saved price if API fails
    return getLastSavedPrice();
  }
}

/**
 * Fetch historical data from Yahoo Finance
 * @param {string} range - Time range: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, max
 * @param {string} interval - Candle interval: 1m, 5m, 15m, 1h, 1d, 1wk, 1mo
 */
export async function fetchHistoricalData(range = '1y', interval = '1d') {
  try {
    const url = `${YAHOO_FINANCE_URL}/${GOLD_SYMBOL}?interval=${interval}&range=${range}`;
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
    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];

    const candles = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quote.open[i] != null && quote.close[i] != null) {
        candles.push({
          timestamp: timestamps[i] * 1000, // Convert to milliseconds
          open: quote.open[i],
          high: quote.high[i],
          low: quote.low[i],
          close: quote.close[i],
          volume: quote.volume[i] || 0
        });
      }
    }

    // Save to database
    savePriceHistory(candles);

    return candles;
  } catch (error) {
    console.error('Error fetching historical data:', error);
    // Return cached data if API fails
    return getCachedHistory(range);
  }
}

/**
 * Save current price snapshot to database
 */
function saveCurrentPrice(priceData) {
  const stmt = db.prepare(`
    INSERT INTO price_snapshots (price, bid, ask, high_24h, low_24h, change_24h, change_percent_24h, timestamp, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    priceData.price,
    priceData.bid,
    priceData.ask,
    priceData.high24h,
    priceData.low24h,
    priceData.change24h,
    priceData.changePercent24h,
    priceData.timestamp,
    priceData.source
  );

  // Clean up old snapshots (keep last 24 hours)
  db.prepare(`
    DELETE FROM price_snapshots 
    WHERE timestamp < ?
  `).run(Date.now() - 24 * 60 * 60 * 1000);
}

/**
 * Get last saved price from database
 */
function getLastSavedPrice() {
  const row = db.prepare(`
    SELECT * FROM price_snapshots 
    ORDER BY timestamp DESC 
    LIMIT 1
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
      source: row.source + ' (cached)'
    };
  }

  return null;
}

/**
 * Save price history to database (upsert)
 */
function savePriceHistory(candles) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO price_history (timestamp, open, high, low, close, volume, source)
    VALUES (?, ?, ?, ?, ?, ?, 'yahoo_finance')
  `);

  const insertMany = db.transaction((candles) => {
    for (const candle of candles) {
      stmt.run(candle.timestamp, candle.open, candle.high, candle.low, candle.close, candle.volume);
    }
  });

  insertMany(candles);
  console.log(`✅ Saved ${candles.length} candles to database`);
}

/**
 * Get cached history from database
 */
function getCachedHistory(range) {
  const rangeMs = {
    '1d': 1 * 24 * 60 * 60 * 1000,
    '5d': 5 * 24 * 60 * 60 * 1000,
    '1mo': 30 * 24 * 60 * 60 * 1000,
    '3mo': 90 * 24 * 60 * 60 * 1000,
    '6mo': 180 * 24 * 60 * 60 * 1000,
    '1y': 365 * 24 * 60 * 60 * 1000,
    '2y': 730 * 24 * 60 * 60 * 1000,
    '3y': 1095 * 24 * 60 * 60 * 1000,
  };

  const since = Date.now() - (rangeMs[range] || rangeMs['1y']);

  return db.prepare(`
    SELECT timestamp, open, high, low, close, volume
    FROM price_history
    WHERE timestamp >= ?
    ORDER BY timestamp ASC
  `).all(since);
}

/**
 * Get price history from database
 */
export function getPriceHistory(days = 365) {
  const since = Date.now() - (days * 24 * 60 * 60 * 1000);
  
  return db.prepare(`
    SELECT timestamp, open, high, low, close, volume
    FROM price_history
    WHERE timestamp >= ?
    ORDER BY timestamp ASC
  `).all(since);
}
