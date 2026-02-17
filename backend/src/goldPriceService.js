import db from './database.js';

/**
 * Gold Price Service
 * 
 * Data Sources:
 * 1. Real-time: Swissquote forex feed (free, no auth)
 * 2. Historical daily: FreeGoldAPI (free, no auth)
 * 3. Backup: GoldAPI.io (configurable via settings)
 * 
 * Note: Smallest time unit is 1 DAY for all price reporting
 */

const SWISSQUOTE_URL = 'https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD';
const FREEGOLDAPI_URL = 'https://freegoldapi.com/data/latest.json';
const YAHOO_FINANCE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
const GOLD_SYMBOL = 'GC=F';

/**
 * Fetch current price from Swissquote (primary source)
 */
export async function fetchCurrentPrice() {
  try {
    // Try Swissquote first
    const swissquotePrice = await fetchFromSwissquote();
    if (swissquotePrice) {
      saveCurrentPrice(swissquotePrice);
      return swissquotePrice;
    }
  } catch (error) {
    console.error('Swissquote fetch failed:', error.message);
  }

  // Fallback to Yahoo Finance
  try {
    const yahooPrice = await fetchFromYahooFinance();
    if (yahooPrice) {
      saveCurrentPrice(yahooPrice);
      return yahooPrice;
    }
  } catch (error) {
    console.error('Yahoo Finance fetch failed:', error.message);
  }

  // Return last cached price
  return getLastSavedPrice();
}

/**
 * Fetch from Swissquote forex data feed (free, no auth required)
 * Returns bid/ask prices from professional forex feed
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

  // Use the first provider's premium spread profile
  const quote = data[0];
  const prices = quote.spreadProfilePrices.find(p => p.spreadProfile === 'premium') 
    || quote.spreadProfilePrices[0];

  console.log('✅ Swissquote price received:', prices.bid, '/', prices.ask);

  // Get 24h high/low from database (we track this ourselves)
  const stats24h = get24hStats();

  return {
    price: (prices.bid + prices.ask) / 2, // Mid price
    bid: prices.bid,
    ask: prices.ask,
    high24h: stats24h.high || prices.ask,
    low24h: stats24h.low || prices.bid,
    change24h: stats24h.change || 0,
    changePercent24h: stats24h.changePercent || 0,
    timestamp: quote.ts || Date.now(),
    source: 'Swissquote',
  };
}

/**
 * Fetch from Yahoo Finance (backup for current price)
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

  return {
    price: currentPrice,
    bid: currentPrice * 0.9995,
    ask: currentPrice * 1.0005,
    high24h: Math.max(...quote.high.filter(h => h != null).slice(-2)),
    low24h: Math.min(...quote.low.filter(l => l != null).slice(-2)),
    change24h: currentPrice - previousClose,
    changePercent24h: ((currentPrice - previousClose) / previousClose) * 100,
    timestamp: Date.now(),
    source: 'Yahoo Finance',
  };
}

/**
 * Fetch historical DAILY data from FreeGoldAPI
 * Returns daily closing prices (not intraday)
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
    
    // Filter to USD prices from yahoo_finance source (most recent & accurate)
    const usdData = allData.filter(d => 
      d.source && d.source.includes('yahoo_finance') && d.price > 100
    );

    // Calculate date range
    const now = new Date();
    const rangeMs = {
      '1d': 1,
      '5d': 5,
      '1mo': 30,
      '3mo': 90,
      '6mo': 180,
      '1y': 365,
      '2y': 730,
      '3y': 1095,
      '5y': 1825,
      'max': 36500,
    };

    const daysBack = rangeMs[range] || 365;
    const cutoffDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    // Filter and convert to candle format
    const candles = usdData
      .filter(d => new Date(d.date) >= cutoffDate)
      .map(d => {
        const timestamp = new Date(d.date).getTime();
        const price = d.price;
        return {
          timestamp,
          open: price,
          high: price * 1.002, // Approximate since we only have close
          low: price * 0.998,
          close: price,
          volume: 0,
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    console.log(`✅ Loaded ${candles.length} daily candles from FreeGoldAPI`);

    // Save to database
    savePriceHistory(candles);

    return candles;
  } catch (error) {
    console.error('FreeGoldAPI fetch failed:', error.message);
    // Fallback to cached data
    return getCachedHistory(range);
  }
}

/**
 * Fetch from a configured API provider (e.g., GoldAPI.io)
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
      priceData = {
        price: data.price,
        bid: data.bid || data.price * 0.9995,
        ask: data.ask || data.price * 1.0005,
        high24h: data.high_price || data.price,
        low24h: data.low_price || data.price,
        change24h: data.ch || 0,
        changePercent24h: data.chp || 0,
        timestamp: data.timestamp ? data.timestamp * 1000 : Date.now(),
        source: provider.name,
      };
    } else {
      priceData = {
        price: data.price || data.rate || data.value || data.last,
        bid: data.bid || data.price * 0.9995,
        ask: data.ask || data.price * 1.0005,
        high24h: data.high || data.high_24h || data.price,
        low24h: data.low || data.low_24h || data.price,
        change24h: data.change || data.ch || 0,
        changePercent24h: data.change_percent || data.chp || 0,
        timestamp: Date.now(),
        source: provider.name,
      };
    }

    saveCurrentPrice(priceData);
    return priceData;
  } catch (error) {
    console.error(`Error fetching from ${provider.name}:`, error.message);
    return null;
  }
}

/**
 * Manual refresh from Swissquote (for manual refresh button)
 */
export async function manualRefresh() {
  console.log('🔄 Manual refresh triggered...');
  return fetchCurrentPrice();
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

  return {
    high: stats.high,
    low: stats.low,
    change,
    changePercent,
  };
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

  // Clean up old snapshots (keep last 7 days for 24h calculations)
  db.prepare(`
    DELETE FROM price_snapshots 
    WHERE timestamp < ?
  `).run(Date.now() - 7 * 24 * 60 * 60 * 1000);
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
      source: row.source + ' (cached)',
    };
  }

  return null;
}

/**
 * Save price history to database (daily data only)
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
 * Get price history from database (daily data)
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
