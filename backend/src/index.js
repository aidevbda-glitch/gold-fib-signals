import express from 'express';
import cors from 'cors';
import { 
  fetchCurrentPrice, 
  fetchHistoricalData, 
  getPriceHistory, 
  fetchFromConfiguredApi, 
  manualRefresh,
  getIntradayTicks,
  getDailyAggregates,
  getAccuracyComparison,
  getHistoryFromDatabase,
  fetchFromSwissquoteOnly,
  getTickStats
} from './goldPriceService.js';
import { saveSignal, getSignals, getSignalStats, getLatestSignal, getSignalsByDateRange } from './signalService.js';
import {
  getAllApiProviders,
  getApiProvider,
  addApiProvider,
  updateApiProvider,
  deleteApiProvider,
  getActiveApiProvider,
  getRefreshSettings,
  setRefreshSettings,
  getAllSettings,
  setSetting,
  getSetting
} from './settingsService.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ==================== PRICE ENDPOINTS ====================

/**
 * GET /api/price/current
 * Get current gold price
 */
app.get('/api/price/current', async (req, res) => {
  try {
    // Try configured API first, fall back to Yahoo Finance
    const activeProvider = getActiveApiProvider();
    let price;
    
    if (activeProvider) {
      price = await fetchFromConfiguredApi(activeProvider);
    }
    
    if (!price) {
      price = await fetchCurrentPrice();
    }
    
    if (!price) {
      return res.status(503).json({ error: 'Unable to fetch price data' });
    }
    res.json(price);
  } catch (error) {
    console.error('Error fetching current price:', error);
    res.status(500).json({ error: 'Failed to fetch current price' });
  }
});

/**
 * GET /api/price/history
 * Get historical price data
 * Query params: range (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 3y), interval (1m, 5m, 15m, 1h, 1d)
 */
app.get('/api/price/history', async (req, res) => {
  try {
    const { range = '1y', interval = '1d' } = req.query;
    
    // Validate range
    const validRanges = ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', 'max'];
    if (!validRanges.includes(range)) {
      return res.status(400).json({ error: 'Invalid range. Valid: ' + validRanges.join(', ') });
    }

    // Validate interval
    const validIntervals = ['1m', '5m', '15m', '1h', '1d', '1wk', '1mo'];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({ error: 'Invalid interval. Valid: ' + validIntervals.join(', ') });
    }

    const history = await fetchHistoricalData(range, interval);
    res.json({
      range,
      interval,
      count: history.length,
      data: history
    });
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
});

/**
 * POST /api/price/refresh
 * Manual refresh - fetch latest price from Swissquote
 */
app.post('/api/price/refresh', async (req, res) => {
  try {
    console.log('📡 Manual refresh requested...');
    const price = await manualRefresh();
    if (!price) {
      return res.status(503).json({ error: 'Unable to fetch price data' });
    }
    res.json({ success: true, data: price });
  } catch (error) {
    console.error('Error during manual refresh:', error);
    res.status(500).json({ error: 'Failed to refresh price' });
  }
});

/**
 * GET /api/price/cached
 * Get cached price history from database
 * Query params: days (default 365)
 */
app.get('/api/price/cached', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 365;
    const history = getPriceHistory(Math.min(days, 1095)); // Max 3 years
    res.json({
      days,
      count: history.length,
      data: history
    });
  } catch (error) {
    console.error('Error fetching cached history:', error);
    res.status(500).json({ error: 'Failed to fetch cached data' });
  }
});

/**
 * GET /api/price/intraday
 * Get intraday Swissquote tick data
 * Query params: start (YYYY-MM-DD), end (YYYY-MM-DD)
 */
app.get('/api/price/intraday', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const start = req.query.start || today;
    const end = req.query.end || today;

    const ticks = getIntradayTicks(start, end);
    res.json({
      start,
      end,
      count: ticks.length,
      data: ticks
    });
  } catch (error) {
    console.error('Error fetching intraday ticks:', error);
    res.status(500).json({ error: 'Failed to fetch intraday data' });
  }
});

/**
 * GET /api/price/daily-aggregates
 * Get daily bid/ask high/low aggregates from Swissquote data
 * Query params: start (YYYY-MM-DD), end (YYYY-MM-DD)
 */
app.get('/api/price/daily-aggregates', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];
    
    const start = req.query.start || thirtyDaysAgo;
    const end = req.query.end || today;

    const aggregates = getDailyAggregates(start, end);
    res.json({
      start,
      end,
      count: aggregates.length,
      data: aggregates
    });
  } catch (error) {
    console.error('Error fetching daily aggregates:', error);
    res.status(500).json({ error: 'Failed to fetch daily aggregates' });
  }
});

/**
 * GET /api/price/accuracy
 * Compare Swissquote data against FreeGoldAPI for accuracy analysis
 * Query params: date (YYYY-MM-DD)
 */
app.get('/api/price/accuracy', (req, res) => {
  try {
    const date = req.query.date;
    if (!date) {
      return res.status(400).json({ error: 'Date parameter required (YYYY-MM-DD)' });
    }

    const comparison = getAccuracyComparison(date);
    if (!comparison) {
      return res.status(404).json({ 
        error: 'No data available for comparison on this date',
        date 
      });
    }

    res.json(comparison);
  } catch (error) {
    console.error('Error fetching accuracy comparison:', error);
    res.status(500).json({ error: 'Failed to fetch accuracy data' });
  }
});

/**
 * GET /api/price/database
 * Get chart data from database (combines historical + Swissquote aggregates)
 * Query params: days (default 365)
 */
app.get('/api/price/database', (req, res) => {
  try {
    const days = parseInt(req.query.days) || 365;
    const history = getHistoryFromDatabase(Math.min(days, 1095));
    res.json({
      days,
      count: history.length,
      sources: {
        historical: 'FreeGoldAPI',
        recent: 'Swissquote (aggregated)'
      },
      data: history
    });
  } catch (error) {
    console.error('Error fetching database history:', error);
    res.status(500).json({ error: 'Failed to fetch database history' });
  }
});

// ==================== SIGNAL ENDPOINTS ====================

/**
 * POST /api/signals
 * Save a new trading signal
 */
app.post('/api/signals', (req, res) => {
  try {
    const signal = req.body;
    
    // Validate required fields
    if (!signal.id || !signal.type || !signal.price) {
      return res.status(400).json({ error: 'Missing required fields: id, type, price' });
    }

    const saved = saveSignal(signal);
    res.status(201).json(saved);
  } catch (error) {
    console.error('Error saving signal:', error);
    res.status(500).json({ error: 'Failed to save signal' });
  }
});

/**
 * GET /api/signals
 * Get signals with pagination
 * Query params: limit, offset, type (BUY/SELL)
 */
app.get('/api/signals', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const type = req.query.type?.toUpperCase();

    if (type && !['BUY', 'SELL'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Valid: BUY, SELL' });
    }

    const signals = getSignals({ limit, offset, type });
    res.json({
      limit,
      offset,
      count: signals.length,
      data: signals
    });
  } catch (error) {
    console.error('Error fetching signals:', error);
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

/**
 * GET /api/signals/latest
 * Get the most recent signal
 */
app.get('/api/signals/latest', (req, res) => {
  try {
    const signal = getLatestSignal();
    if (!signal) {
      return res.status(404).json({ error: 'No signals found' });
    }
    res.json(signal);
  } catch (error) {
    console.error('Error fetching latest signal:', error);
    res.status(500).json({ error: 'Failed to fetch latest signal' });
  }
});

/**
 * GET /api/signals/stats
 * Get signal statistics
 */
app.get('/api/signals/stats', (req, res) => {
  try {
    const stats = getSignalStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

/**
 * GET /api/signals/range
 * Get signals within a date range
 * Query params: start, end (timestamps in ms)
 */
app.get('/api/signals/range', (req, res) => {
  try {
    const start = parseInt(req.query.start) || (Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = parseInt(req.query.end) || Date.now();

    const signals = getSignalsByDateRange(start, end);
    res.json({
      start,
      end,
      count: signals.length,
      data: signals
    });
  } catch (error) {
    console.error('Error fetching signals by range:', error);
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

// ==================== SETTINGS ENDPOINTS ====================

/**
 * GET /api/settings
 * Get all settings
 */
app.get('/api/settings', (req, res) => {
  try {
    const settings = getAllSettings();
    const providers = getAllApiProviders();
    const refresh = getRefreshSettings();
    
    res.json({
      ...settings,
      apiProviders: providers,
      refresh,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * GET /api/settings/providers
 * Get all API providers
 */
app.get('/api/settings/providers', (req, res) => {
  try {
    const providers = getAllApiProviders();
    res.json({ data: providers });
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({ error: 'Failed to fetch API providers' });
  }
});

/**
 * GET /api/settings/providers/active
 * Get the active API provider
 */
app.get('/api/settings/providers/active', (req, res) => {
  try {
    const provider = getActiveApiProvider();
    if (!provider) {
      return res.json({ data: null, message: 'No active provider configured' });
    }
    res.json({ data: provider });
  } catch (error) {
    console.error('Error fetching active provider:', error);
    res.status(500).json({ error: 'Failed to fetch active provider' });
  }
});

/**
 * POST /api/settings/providers
 * Add a new API provider
 */
app.post('/api/settings/providers', (req, res) => {
  try {
    const { name, endpoint, apiKey, requestType, isActive, headers, symbolFormat, currencyFormat } = req.body;
    
    if (!name || !endpoint || !apiKey) {
      return res.status(400).json({ error: 'Missing required fields: name, endpoint, apiKey' });
    }

    const provider = addApiProvider({
      name,
      endpoint,
      apiKey,
      requestType: requestType || 'GET',
      isActive: isActive || false,
      headers,
      symbolFormat,
      currencyFormat,
    });

    res.status(201).json({ data: provider });
  } catch (error) {
    console.error('Error adding provider:', error);
    res.status(500).json({ error: 'Failed to add API provider' });
  }
});

/**
 * PUT /api/settings/providers/:id
 * Update an API provider
 */
app.put('/api/settings/providers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const provider = updateApiProvider(id, updates);
    res.json({ data: provider });
  } catch (error) {
    console.error('Error updating provider:', error);
    if (error.message === 'API provider not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update API provider' });
  }
});

/**
 * DELETE /api/settings/providers/:id
 * Delete an API provider
 */
app.delete('/api/settings/providers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = deleteApiProvider(id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'API provider not found' });
    }
    
    res.json({ success: true, message: 'API provider deleted' });
  } catch (error) {
    console.error('Error deleting provider:', error);
    res.status(500).json({ error: 'Failed to delete API provider' });
  }
});

/**
 * GET /api/settings/refresh
 * Get refresh settings
 */
app.get('/api/settings/refresh', (req, res) => {
  try {
    const refresh = getRefreshSettings();
    res.json({ data: refresh });
  } catch (error) {
    console.error('Error fetching refresh settings:', error);
    res.status(500).json({ error: 'Failed to fetch refresh settings' });
  }
});

/**
 * PUT /api/settings/refresh
 * Update refresh settings
 */
app.put('/api/settings/refresh', (req, res) => {
  try {
    const { interval, intervalMs } = req.body;
    
    const validIntervals = ['realtime', 'hourly', 'daily', 'weekly'];
    if (interval && !validIntervals.includes(interval)) {
      return res.status(400).json({ error: 'Invalid interval. Valid: ' + validIntervals.join(', ') });
    }

    const refresh = setRefreshSettings({
      interval: interval || 'weekly',
      intervalMs: intervalMs || 7 * 24 * 60 * 60 * 1000,
      lastRefresh: Date.now(),
    });

    res.json({ data: refresh });
  } catch (error) {
    console.error('Error updating refresh settings:', error);
    res.status(500).json({ error: 'Failed to update refresh settings' });
  }
});

/**
 * POST /api/settings/providers/:id/test
 * Test an API provider connection
 */
app.post('/api/settings/providers/:id/test', async (req, res) => {
  try {
    const { id } = req.params;
    const provider = getApiProvider(id);
    
    if (!provider) {
      return res.status(404).json({ error: 'API provider not found' });
    }

    const result = await fetchFromConfiguredApi(provider);
    
    if (result) {
      res.json({ 
        success: true, 
        message: 'Connection successful',
        data: result 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: 'Failed to fetch data from provider'
      });
    }
  } catch (error) {
    console.error('Error testing provider:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Connection test failed'
    });
  }
});

// ==================== POLLING ENDPOINTS ====================

/**
 * GET /api/polling/stats
 * Get tick collection statistics
 */
app.get('/api/polling/stats', (req, res) => {
  try {
    const stats = getTickStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching polling stats:', error);
    res.status(500).json({ error: 'Failed to fetch polling stats' });
  }
});

/**
 * GET /api/polling/config
 * Get polling configuration
 */
app.get('/api/polling/config', (req, res) => {
  const intervalMs = parseInt(process.env.POLL_INTERVAL_MS) || 60000;
  res.json({
    enabled: true,
    intervalMs,
    intervalSeconds: intervalMs / 1000,
    source: 'Swissquote',
    retention: '1 year'
  });
});

// ==================== START SERVER ====================

// Polling configuration (default: 1 minute, can be set via env)
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS) || 60000; // 60 seconds default
let pollCount = 0;
let pollErrors = 0;

/**
 * Automatic Swissquote polling
 * Collects bid/ask data every minute (configurable)
 */
async function pollSwissquote() {
  try {
    const result = await fetchFromSwissquoteOnly();
    if (result) {
      pollCount++;
      if (pollCount % 60 === 0) { // Log every hour
        const stats = getTickStats();
        console.log(`📊 Polling stats: ${stats.today.tickCount} ticks today, ${stats.total.tickCount} total (${stats.total.dbSizeMB} MB)`);
      }
    } else {
      pollErrors++;
    }
  } catch (error) {
    pollErrors++;
    console.error('Poll error:', error.message);
  }
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
🥇 Gold Fib Signals API Server
================================
Port: ${PORT}
Time: ${new Date().toISOString()}
Poll Interval: ${POLL_INTERVAL_MS / 1000} seconds

Endpoints:
  GET  /health                      - Health check
  
  Price:
  GET  /api/price/current           - Current gold price (Swissquote)
  GET  /api/price/history           - Historical data (FreeGoldAPI)
  GET  /api/price/cached            - Cached history from DB
  GET  /api/price/database          - Chart data (historical + aggregates)
  GET  /api/price/intraday          - Intraday Swissquote ticks
  GET  /api/price/daily-aggregates  - Daily bid/ask high/low
  GET  /api/price/accuracy          - Compare data sources
  POST /api/price/refresh           - Manual refresh from Swissquote
  
  Signals:
  POST /api/signals                 - Save a signal
  GET  /api/signals                 - Get signals (paginated)
  GET  /api/signals/latest          - Get latest signal
  GET  /api/signals/stats           - Get statistics
  GET  /api/signals/range           - Get signals by date range
  
  Polling:
  GET  /api/polling/stats           - Tick collection statistics
  GET  /api/polling/config          - Polling configuration
  
  Settings:
  GET  /api/settings                - Get all settings
  GET  /api/settings/providers      - Get API providers
  POST /api/settings/providers      - Add API provider
  PUT  /api/settings/providers/:id  - Update API provider
  DELETE /api/settings/providers/:id - Delete API provider
  POST /api/settings/providers/:id/test - Test provider
  GET  /api/settings/refresh        - Get refresh settings
  PUT  /api/settings/refresh        - Update refresh settings
================================
  `);

  // Fetch initial data
  console.log('📊 Fetching initial price data...');
  fetchCurrentPrice().then(() => console.log('✅ Current price loaded'));
  fetchHistoricalData('1y', '1d').then(() => console.log('✅ 1-year history loaded'));

  // Start automatic polling
  console.log(`⏱️  Starting Swissquote polling every ${POLL_INTERVAL_MS / 1000} seconds...`);
  setInterval(pollSwissquote, POLL_INTERVAL_MS);
  
  // Initial poll
  setTimeout(pollSwissquote, 5000);
});
