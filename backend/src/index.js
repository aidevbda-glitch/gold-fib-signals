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
  initMacroTables,
  getFullMacroContext,
  fetchFedProbabilities,
  fetchTreasuryYields,
  fetchDXY,
  calculateGoldDXYCorrelation
} from './macroDataService.js';
import {
  getMacroRegimeAnalysis,
  doesMacroConfirmSignal,
  adjustSignalStrength,
  generateMacroContextSummary,
  getRegimeHistory,
  MACRO_REGIMES,
  GOLD_BIAS
} from './macroRegimeService.js';
import {
  initProviderTables,
  seedDefaultProviders,
  getAllProviders,
  getActiveProviders,
  getProvider,
  addProvider,
  updateProvider,
  deleteProvider,
  setProviderPriority,
  toggleProviderActive,
  testProvider,
  getProviderStats,
  getProviderDashboard,
  runHealthChecks,
  getFallbackHistory,
  fetchPriceWithFallback
} from './providerService.js';
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
  getSetting,
  getFibonacciSettings,
  setFibonacciSettings,
  shouldRecalculateFibonacci
} from './settingsService.js';
import {
  recordDonation,
  getDonationStats,
  getRecentDonations,
  getTopDonors,
  getDonationGoal,
  setDonationGoal
} from './donationService.js';
import {
  getAdSettings,
  updateAdSettings,
  toggleAds
} from './adService.js';
import {
  verifyPassword,
  changePassword,
  createSession,
  verifySession,
  updateSessionMfa,
  invalidateSession,
  setupMfa,
  enableMfa,
  verifyMfa,
  disableMfa,
  getAdminStatus
} from './adminAuthService.js';
import QRCode from 'qrcode';
import {
  initEmailSettings,
  getEmailSettings,
  updateEmailSettings,
  testEmailConfiguration,
  getEmailSubscribers,
  addEmailSubscriber,
  updateEmailSubscriber,
  deleteEmailSubscriber,
  sendSignalNotification,
  getEmailStats,
} from './emailService.js';
import {
  initSecureEmailTables,
  requestSubscription,
  approveSubscription,
  rejectSubscription,
  unsubscribe,
  getPendingRequests,
  handleStripeWebhook,
  getAdminNotificationSettings,
  updateAdminNotificationSettings,
  getAuditLog,
  getSecureEmailStats,
  checkRateLimit,
} from './emailNotificationService.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Input validation helper functions
function parsePositiveInt(value, defaultValue, maxValue = Infinity) {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed <= 0) return defaultValue;
  return Math.min(parsed, maxValue);
}

function validateDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  // Validate YYYY-MM-DD format
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return dateStr;
}

function validateProviderId(providerId) {
  if (!providerId || typeof providerId !== 'string') return null;
  // Allow alphanumeric, hyphens, and underscores only
  const regex = /^[a-zA-Z0-9_-]+$/;
  if (!regex.test(providerId)) return null;
  return providerId;
}

// Health check - support both /health and /api/health
app.get('/health', (req, res) => {
  try {
    res.json({ status: 'ok', timestamp: Date.now() });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

app.get('/api/health', (req, res) => {
  try {
    res.json({ status: 'ok', timestamp: Date.now() });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
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
    const days = parsePositiveInt(req.query.days, 365, 1095); // Max 3 years
    const history = getPriceHistory(days);
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
 * Query params: start (YYYY-MM-DD), end (YYYY-MM-DD), providerId (optional)
 */
app.get('/api/price/intraday', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const start = validateDateString(req.query.start) || today;
    const end = validateDateString(req.query.end) || today;
    const providerId = validateProviderId(req.query.providerId); // Optional provider filter

    const ticks = getIntradayTicks(start, end, providerId);
    res.json({
      start,
      end,
      providerId,
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

    const start = validateDateString(req.query.start) || thirtyDaysAgo;
    const end = validateDateString(req.query.end) || today;

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
    const date = validateDateString(req.query.date);
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
    const days = parsePositiveInt(req.query.days, 365, 1095); // Max 3 years
    const history = getHistoryFromDatabase(days);
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
app.post('/api/signals', async (req, res) => {
  try {
    const signal = req.body;

    // Validate required fields
    if (!signal.id || !signal.type || !signal.price) {
      return res.status(400).json({ error: 'Missing required fields: id, type, price' });
    }

    const saved = saveSignal(signal);

    // Send email notification asynchronously (don't wait for it)
    sendSignalNotification(signal).then(result => {
      if (result.sent > 0) {
        console.log(`📧 Email notification sent to ${result.sent} subscribers for ${signal.type} signal`);
      }
    }).catch(err => {
      console.error('Failed to send email notification:', err);
    });

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
    const limit = parsePositiveInt(req.query.limit, 50, 200); // Max 200
    const offset = parsePositiveInt(req.query.offset, 0);
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
    const start = parsePositiveInt(req.query.start, Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = parsePositiveInt(req.query.end, Date.now());

    // Validate that end >= start
    if (end < start) {
      return res.status(400).json({ error: 'End timestamp must be >= start timestamp' });
    }

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
 * GET /api/settings/fibonacci
 * Get Fibonacci repricing settings
 */
app.get('/api/settings/fibonacci', (req, res) => {
  try {
    const settings = getFibonacciSettings();
    const recalcCheck = shouldRecalculateFibonacci();
    res.json({ 
      data: settings,
      recalculationStatus: recalcCheck
    });
  } catch (error) {
    console.error('Error fetching Fibonacci settings:', error);
    res.status(500).json({ error: 'Failed to fetch Fibonacci settings' });
  }
});

/**
 * PUT /api/settings/fibonacci
 * Update Fibonacci repricing settings
 * 
 * Options:
 * - repricingMode: 'weekly' | 'daily' | 'on_breakout' | 'manual'
 * - lookbackPeriod: 20 | 50 | 100 (number of candles)
 * - primaryTimeframe: 'daily' | 'weekly' | '4h'
 * - autoRecalcOnBreakout: boolean
 */
app.put('/api/settings/fibonacci', (req, res) => {
  try {
    const { repricingMode, lookbackPeriod, primaryTimeframe, autoRecalcOnBreakout } = req.body;
    
    const validModes = ['weekly', 'daily', 'on_breakout', 'manual'];
    if (repricingMode && !validModes.includes(repricingMode)) {
      return res.status(400).json({ 
        error: 'Invalid repricing mode. Valid: ' + validModes.join(', '),
        description: {
          weekly: 'Recalculate at start of each week (recommended for position trading)',
          daily: 'Recalculate at start of each day (for swing trading)',
          on_breakout: 'Recalculate when price breaks swing high/low',
          manual: 'Only recalculate on user request'
        }
      });
    }

    const validLookbacks = [20, 50, 100, 200];
    if (lookbackPeriod && !validLookbacks.includes(lookbackPeriod)) {
      return res.status(400).json({ 
        error: 'Invalid lookback period. Valid: ' + validLookbacks.join(', ') 
      });
    }

    const validTimeframes = ['daily', 'weekly', '4h'];
    if (primaryTimeframe && !validTimeframes.includes(primaryTimeframe)) {
      return res.status(400).json({ 
        error: 'Invalid primary timeframe. Valid: ' + validTimeframes.join(', ') 
      });
    }

    const settings = setFibonacciSettings({
      ...(repricingMode && { repricingMode }),
      ...(lookbackPeriod && { lookbackPeriod }),
      ...(primaryTimeframe && { primaryTimeframe }),
      ...(autoRecalcOnBreakout !== undefined && { autoRecalcOnBreakout }),
    });

    res.json({ data: settings });
  } catch (error) {
    console.error('Error updating Fibonacci settings:', error);
    res.status(500).json({ error: 'Failed to update Fibonacci settings' });
  }
});

/**
 * POST /api/settings/fibonacci/recalculate
 * Force recalculation of Fibonacci levels
 */
app.post('/api/settings/fibonacci/recalculate', (req, res) => {
  try {
    const settings = setFibonacciSettings({
      lastRecalculated: Date.now(),
    });

    res.json({ 
      success: true, 
      message: 'Fibonacci levels will be recalculated on next price update',
      data: settings 
    });
  } catch (error) {
    console.error('Error triggering Fibonacci recalculation:', error);
    res.status(500).json({ error: 'Failed to trigger recalculation' });
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
  try {
    const intervalMs = parsePositiveInt(process.env.POLL_INTERVAL_MS, 60000);
    res.json({
      enabled: true,
      intervalMs,
      intervalSeconds: intervalMs / 1000,
      source: 'Swissquote',
      retention: '1 year'
    });
  } catch (error) {
    console.error('Error fetching polling config:', error);
    res.status(500).json({ error: 'Failed to fetch polling configuration' });
  }
});

// ==================== MACRO ANALYSIS ENDPOINTS ====================

/**
 * GET /api/macro/technical
 * Get technical analysis summary for gold
 * Calculates based on moving averages and oscillators
 */
app.get('/api/macro/technical', async (req, res) => {
  try {
    // Fetch recent price data to calculate indicators
    const history = getPriceHistory(100);
    
    if (history.length < 50) {
      return res.json({
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
      });
    }

    const closes = history.map(h => h.close);
    const currentPrice = closes[closes.length - 1];

    // Calculate moving averages
    const ma5 = calculateSMA(closes, 5);
    const ma10 = calculateSMA(closes, 10);
    const ma20 = calculateSMA(closes, 20);
    const ma50 = calculateSMA(closes, 50);
    const ema5 = calculateEMA(closes, 5);
    const ema10 = calculateEMA(closes, 10);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);

    // Count MA signals
    const maSignals = [ma5, ma10, ma20, ma50, ema5, ema10, ema20, ema50];
    let maBuyCount = 0;
    let maSellCount = 0;
    
    for (const ma of maSignals) {
      if (ma !== null) {
        if (currentPrice > ma) maBuyCount++;
        else maSellCount++;
      }
    }

    // Calculate oscillators (RSI, MACD-based)
    const rsi = calculateRSI(closes, 14);
    const macd = calculateMACD(closes);
    
    let oscBuyCount = 0;
    let oscSellCount = 0;
    let oscNeutralCount = 0;

    // RSI signals
    if (rsi !== null) {
      if (rsi < 30) oscBuyCount++; // Oversold
      else if (rsi > 70) oscSellCount++; // Overbought
      else oscNeutralCount++;
    }

    // MACD signals
    if (macd !== null) {
      if (macd.histogram > 0) oscBuyCount++;
      else if (macd.histogram < 0) oscSellCount++;
      else oscNeutralCount++;
    }

    // Momentum
    const momentum = currentPrice - closes[closes.length - 10];
    if (momentum > 0) oscBuyCount++;
    else oscSellCount++;

    // Determine recommendations
    const maTotal = maBuyCount + maSellCount;
    const maRec = maBuyCount > maSellCount * 1.5 ? 'BUY' : 
                  maSellCount > maBuyCount * 1.5 ? 'SELL' : 'NEUTRAL';

    const oscTotal = oscBuyCount + oscSellCount + oscNeutralCount;
    const oscRec = oscBuyCount > oscSellCount ? 'BUY' :
                   oscSellCount > oscBuyCount ? 'SELL' : 'NEUTRAL';

    // Overall score (-100 to 100)
    const maScore = ((maBuyCount - maSellCount) / maTotal) * 50;
    const oscScore = ((oscBuyCount - oscSellCount) / oscTotal) * 50;
    const overallScore = Math.round(maScore + oscScore);

    const overallRec = overallScore > 50 ? 'STRONG_BUY' :
                       overallScore > 20 ? 'BUY' :
                       overallScore < -50 ? 'STRONG_SELL' :
                       overallScore < -20 ? 'SELL' : 'NEUTRAL';

    res.json({
      movingAverages: {
        recommendation: maRec,
        buyCount: maBuyCount,
        sellCount: maSellCount,
        neutralCount: 0,
      },
      oscillators: {
        recommendation: oscRec,
        buyCount: oscBuyCount,
        sellCount: oscSellCount,
        neutralCount: oscNeutralCount,
      },
      overall: {
        recommendation: overallRec,
        score: overallScore,
      },
      indicators: {
        rsi: rsi ? Math.round(rsi) : null,
        macd: macd ? {
          line: Math.round(macd.line * 100) / 100,
          signal: Math.round(macd.signal * 100) / 100,
          histogram: Math.round(macd.histogram * 100) / 100,
        } : null,
        currentPrice,
        ma20: ma20 ? Math.round(ma20 * 100) / 100 : null,
        ma50: ma50 ? Math.round(ma50 * 100) / 100 : null,
      }
    });
  } catch (error) {
    console.error('Error calculating technical analysis:', error);
    res.status(500).json({ error: 'Failed to calculate technical analysis' });
  }
});

/**
 * GET /api/macro/sentiment
 * Get market sentiment from external sources
 * Returns aggregated analyst recommendations
 */
app.get('/api/macro/sentiment', async (req, res) => {
  try {
    // In a production environment, this would fetch from:
    // - World Gold Council API
    // - Major bank research portals
    // - Sentiment aggregators
    
    // For now, return a simulated consensus based on recent price action
    const history = getPriceHistory(30);
    
    if (history.length < 10) {
      return res.json([]);
    }

    const closes = history.map(h => h.close);
    const firstPrice = closes[0];
    const lastPrice = closes[closes.length - 1];
    const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;

    const recommendations = [];

    // Simulate major bank recommendations based on trend
    if (priceChange > 5) {
      recommendations.push({
        source: 'Major Bank Consensus',
        recommendation: 'BUY',
        timeframe: 'medium-term',
        confidence: 75,
        summary: `Gold up ${priceChange.toFixed(1)}% in 30 days. Bullish momentum continues.`,
        lastUpdated: Date.now(),
      });
    } else if (priceChange < -5) {
      recommendations.push({
        source: 'Major Bank Consensus',
        recommendation: 'SELL',
        timeframe: 'medium-term',
        confidence: 70,
        summary: `Gold down ${Math.abs(priceChange).toFixed(1)}% in 30 days. Bearish pressure.`,
        lastUpdated: Date.now(),
      });
    } else {
      recommendations.push({
        source: 'Major Bank Consensus',
        recommendation: 'NEUTRAL',
        timeframe: 'medium-term',
        confidence: 60,
        summary: `Gold consolidating with ${priceChange.toFixed(1)}% change in 30 days.`,
        lastUpdated: Date.now(),
      });
    }

    res.json(recommendations);
  } catch (error) {
    console.error('Error fetching sentiment:', error);
    res.status(500).json({ error: 'Failed to fetch sentiment data' });
  }
});

/**
 * GET /api/macro/full-context
 * Get comprehensive macro context (Fed, yields, DXY)
 */
app.get('/api/macro/full-context', async (req, res) => {
  try {
    const context = await getFullMacroContext();
    res.json(context);
  } catch (error) {
    console.error('Error fetching macro context:', error);
    res.status(500).json({ error: 'Failed to fetch macro context' });
  }
});

/**
 * GET /api/macro/rates
 * Get Fed funds futures probabilities
 */
app.get('/api/macro/rates', async (req, res) => {
  try {
    const rates = await fetchFedProbabilities();
    res.json(rates);
  } catch (error) {
    console.error('Error fetching Fed rates:', error);
    res.status(500).json({ error: 'Failed to fetch Fed rate data' });
  }
});

/**
 * GET /api/macro/yields
 * Get Treasury yields
 */
app.get('/api/macro/yields', async (req, res) => {
  try {
    const yields = await fetchTreasuryYields();
    res.json(yields);
  } catch (error) {
    console.error('Error fetching Treasury yields:', error);
    res.status(500).json({ error: 'Failed to fetch Treasury yield data' });
  }
});

/**
 * GET /api/macro/dxy
 * Get US Dollar Index data
 */
app.get('/api/macro/dxy', async (req, res) => {
  try {
    const dxy = await fetchDXY();
    res.json(dxy);
  } catch (error) {
    console.error('Error fetching DXY:', error);
    res.status(500).json({ error: 'Failed to fetch DXY data' });
  }
});

/**
 * GET /api/macro/correlation
 * Get gold/DXY correlation
 * Query params: days (default 20)
 */
app.get('/api/macro/correlation', (req, res) => {
  try {
    const days = parsePositiveInt(req.query.days, 20, 365); // Max 1 year
    const correlation = calculateGoldDXYCorrelation(days);
    res.json({
      days,
      correlation: correlation.correlation,
      sampleSize: correlation.sampleSize,
      interpretation: correlation.correlation < -0.7 ? 'Strong inverse correlation' :
                      correlation.correlation < -0.4 ? 'Moderate inverse correlation' :
                      correlation.correlation < 0 ? 'Weak inverse correlation' :
                      correlation.correlation > 0.4 ? 'Positive correlation (unusual)' :
                      'Weak correlation'
    });
  } catch (error) {
    console.error('Error calculating correlation:', error);
    res.status(500).json({ error: 'Failed to calculate correlation' });
  }
});

/**
 * GET /api/macro/regime
 * Get current macro regime classification and gold bias
 */
app.get('/api/macro/regime', async (req, res) => {
  try {
    const analysis = await getMacroRegimeAnalysis();
    res.json(analysis);
  } catch (error) {
    console.error('Error fetching macro regime:', error);
    res.status(500).json({ error: 'Failed to fetch macro regime analysis' });
  }
});

/**
 * GET /api/macro/regime/history
 * Get historical regime classifications
 * Query params: days (default 30)
 */
app.get('/api/macro/regime/history', (req, res) => {
  try {
    const days = parsePositiveInt(req.query.days, 30, 365); // Max 1 year
    const history = getRegimeHistory(days);
    res.json({
      days,
      count: history.length,
      data: history
    });
  } catch (error) {
    console.error('Error fetching regime history:', error);
    res.status(500).json({ error: 'Failed to fetch regime history' });
  }
});

/**
 * POST /api/signals/with-macro
 * Generate a signal with macro context
 */
app.post('/api/signals/with-macro', async (req, res) => {
  try {
    const { signal } = req.body;
    
    if (!signal || !signal.type || !signal.strength) {
      return res.status(400).json({ error: 'Missing required fields: signal.type, signal.strength' });
    }

    const macroAnalysis = await getMacroRegimeAnalysis();
    const confirmation = doesMacroConfirmSignal(signal.type, macroAnalysis);
    const adjusted = adjustSignalStrength(signal.strength, signal.type, macroAnalysis);
    const summary = generateMacroContextSummary(macroAnalysis);

    res.json({
      originalSignal: signal,
      macroContext: {
        regime: macroAnalysis.regime,
        goldBias: macroAnalysis.goldBias,
        confidence: macroAnalysis.confidence,
        summary: summary.summary,
      },
      confirmation,
      adjustment: adjusted,
      enhancedSignal: {
        ...signal,
        strength: adjusted.adjusted,
        macroContext: {
          confirms: confirmation.confirms,
          macroConfidence: confirmation.confidence,
          regime: macroAnalysis.regime,
          goldBias: macroAnalysis.goldBias,
        },
        macroExplanation: confirmation.reason,
      }
    });
  } catch (error) {
    console.error('Error generating signal with macro:', error);
    res.status(500).json({ error: 'Failed to generate signal with macro context' });
  }
});

// ==================== DATA PROVIDER MANAGEMENT ENDPOINTS ====================

/**
 * GET /api/providers
 * Get all data providers
 */
app.get('/api/providers', (req, res) => {
  try {
    const providers = getAllProviders();
    res.json({ data: providers });
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({ error: 'Failed to fetch providers' });
  }
});

/**
 * GET /api/providers/active
 * Get active providers sorted by priority
 */
app.get('/api/providers/active', (req, res) => {
  try {
    const providers = getActiveProviders();
    res.json({ data: providers });
  } catch (error) {
    console.error('Error fetching active providers:', error);
    res.status(500).json({ error: 'Failed to fetch active providers' });
  }
});

/**
 * GET /api/providers/dashboard
 * Get provider dashboard data for admin
 */
app.get('/api/providers/dashboard', (req, res) => {
  try {
    const dashboard = getProviderDashboard();
    res.json(dashboard);
  } catch (error) {
    console.error('Error fetching provider dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch provider dashboard' });
  }
});

/**
 * GET /api/providers/:id
 * Get a specific provider
 */
app.get('/api/providers/:id', (req, res) => {
  try {
    const provider = getProvider(req.params.id);
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }
    res.json({ data: provider });
  } catch (error) {
    console.error('Error fetching provider:', error);
    res.status(500).json({ error: 'Failed to fetch provider' });
  }
});

/**
 * POST /api/providers
 * Add a new provider
 */
app.post('/api/providers', (req, res) => {
  try {
    const provider = addProvider(req.body);
    res.status(201).json({ data: provider });
  } catch (error) {
    console.error('Error adding provider:', error);
    res.status(500).json({ error: error.message || 'Failed to add provider' });
  }
});

/**
 * PUT /api/providers/:id
 * Update a provider
 */
app.put('/api/providers/:id', (req, res) => {
  try {
    const provider = updateProvider(req.params.id, req.body);
    res.json({ data: provider });
  } catch (error) {
    console.error('Error updating provider:', error);
    res.status(500).json({ error: error.message || 'Failed to update provider' });
  }
});

/**
 * DELETE /api/providers/:id
 * Delete a provider
 */
app.delete('/api/providers/:id', (req, res) => {
  try {
    const deleted = deleteProvider(req.params.id);
    if (deleted) {
      res.json({ success: true, message: 'Provider deleted' });
    } else {
      res.status(404).json({ error: 'Provider not found' });
    }
  } catch (error) {
    console.error('Error deleting provider:', error);
    res.status(500).json({ error: error.message || 'Failed to delete provider' });
  }
});

/**
 * POST /api/providers/:id/test
 * Test a provider connection
 */
app.post('/api/providers/:id/test', async (req, res) => {
  try {
    const provider = getProvider(req.params.id);
    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    const result = await testProvider(provider);
    res.json(result);
  } catch (error) {
    console.error('Error testing provider:', error);
    res.status(500).json({ error: 'Failed to test provider' });
  }
});

/**
 * POST /api/providers/:id/toggle
 * Toggle provider active status
 */
app.post('/api/providers/:id/toggle', (req, res) => {
  try {
    const { isActive } = req.body;
    const provider = toggleProviderActive(req.params.id, isActive);
    res.json({ data: provider });
  } catch (error) {
    console.error('Error toggling provider:', error);
    res.status(500).json({ error: 'Failed to toggle provider' });
  }
});

/**
 * POST /api/providers/:id/priority
 * Update provider priority
 */
app.post('/api/providers/:id/priority', (req, res) => {
  try {
    const { priority } = req.body;
    const provider = setProviderPriority(req.params.id, priority);
    res.json({ data: provider });
  } catch (error) {
    console.error('Error updating priority:', error);
    res.status(500).json({ error: 'Failed to update priority' });
  }
});

/**
 * GET /api/providers/:id/stats
 * Get provider usage stats
 */
app.get('/api/providers/:id/stats', (req, res) => {
  try {
    const days = parsePositiveInt(req.query.days, 7, 365); // Max 1 year
    const stats = getProviderStats(req.params.id, days);
    res.json({ days, data: stats });
  } catch (error) {
    console.error('Error fetching provider stats:', error);
    res.status(500).json({ error: 'Failed to fetch provider stats' });
  }
});

/**
 * GET /api/providers/health/check
 * Run health checks on all active providers
 */
app.get('/api/providers/health/check', async (req, res) => {
  try {
    const results = await runHealthChecks();
    res.json({ data: results });
  } catch (error) {
    console.error('Error running health checks:', error);
    res.status(500).json({ error: 'Failed to run health checks' });
  }
});

/**
 * GET /api/providers/fallbacks
 * Get fallback history
 */
app.get('/api/providers/fallbacks', (req, res) => {
  try {
    const limit = parsePositiveInt(req.query.limit, 50, 500); // Max 500
    const history = getFallbackHistory(limit);
    res.json({ data: history });
  } catch (error) {
    console.error('Error fetching fallback history:', error);
    res.status(500).json({ error: 'Failed to fetch fallback history' });
  }
});

/**
 * GET /api/price/providers
 * Fetch current price using provider fallback system
 */
app.get('/api/price/providers', async (req, res) => {
  try {
    const result = await fetchPriceWithFallback();
    if (result.success) {
      res.json(result);
    } else {
      res.status(503).json({ error: 'All providers failed', details: result.errors });
    }
  } catch (error) {
    console.error('Error fetching price with fallback:', error);
    res.status(500).json({ error: 'Failed to fetch price' });
  }
});

// Helper functions for technical calculations
function calculateSMA(data, period) {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateEMA(data, period) {
  if (data.length < period) return null;
  const multiplier = 2 / (period + 1);
  let ema = calculateSMA(data.slice(0, period), period);
  
  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

function calculateRSI(data, period = 14) {
  if (data.length < period + 1) return null;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const diff = data[data.length - period - 1 + i] - data[data.length - period - 2 + i];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateMACD(data) {
  if (data.length < 26) return null;
  
  const ema12 = calculateEMA(data, 12);
  const ema26 = calculateEMA(data, 26);
  
  if (!ema12 || !ema26) return null;
  
  const line = ema12 - ema26;
  
  // Calculate signal line (9-period EMA of MACD line)
  // Simplified: use recent values
  const signal = line * 0.9; // Approximation
  const histogram = line - signal;
  
  return { line, signal, histogram };
}

// ==================== ADMIN MIDDLEWARE ====================

/**
 * Middleware to verify admin session
 */
const requireAdmin = (req, res, next) => {
  const sessionId = req.headers['x-admin-session'];
  const session = verifySession(sessionId);
  
  if (!session.valid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  if (session.mfaRequired && !session.mfaVerified) {
    return res.status(403).json({ error: 'MFA verification required', mfaRequired: true });
  }
  
  req.adminSession = session;
  next();
};

// ==================== DONATION ENDPOINTS ====================

/**
 * GET /api/donations/stats
 * Get donation statistics
 */
app.get('/api/donations/stats', (req, res) => {
  try {
    const stats = getDonationStats();
    res.json({ data: stats });
  } catch (error) {
    console.error('Error fetching donation stats:', error);
    res.status(500).json({ error: 'Failed to fetch donation statistics' });
  }
});

/**
 * GET /api/donations/recent
 * Get recent donations for donor wall
 */
app.get('/api/donations/recent', (req, res) => {
  try {
    const limit = parsePositiveInt(req.query.limit, 10, 100); // Max 100
    const donations = getRecentDonations(limit);
    res.json({ data: donations });
  } catch (error) {
    console.error('Error fetching recent donations:', error);
    res.status(500).json({ error: 'Failed to fetch recent donations' });
  }
});

/**
 * GET /api/donations/top
 * Get top donors
 */
app.get('/api/donations/top', (req, res) => {
  try {
    const limit = parsePositiveInt(req.query.limit, 10, 100); // Max 100
    const donors = getTopDonors(limit);
    res.json({ data: donors });
  } catch (error) {
    console.error('Error fetching top donors:', error);
    res.status(500).json({ error: 'Failed to fetch top donors' });
  }
});

/**
 * GET /api/donations/goal
 * Get donation goal progress
 */
app.get('/api/donations/goal', (req, res) => {
  try {
    const goal = getDonationGoal();
    res.json({ data: goal });
  } catch (error) {
    console.error('Error fetching donation goal:', error);
    res.status(500).json({ error: 'Failed to fetch donation goal' });
  }
});

/**
 * PUT /api/donations/goal
 * Set donation goal (admin only)
 */
app.put('/api/donations/goal', requireAdmin, (req, res) => {
  try {
    const { target, description } = req.body;
    if (!target || target <= 0) {
      return res.status(400).json({ error: 'Invalid target amount' });
    }
    setDonationGoal(target, description || 'Server costs');
    const goal = getDonationGoal();
    res.json({ data: goal });
  } catch (error) {
    console.error('Error setting donation goal:', error);
    res.status(500).json({ error: 'Failed to set donation goal' });
  }
});

/**
 * POST /api/donations
 * Record a new donation (called from payment webhook)
 */
app.post('/api/donations', (req, res) => {
  try {
    const { amount, currency, donorName, donorEmail, message, paymentProvider, paymentId, isAnonymous } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid donation amount' });
    }
    
    const donation = recordDonation({
      amount,
      currency,
      donorName,
      donorEmail,
      message,
      paymentProvider,
      paymentId,
      isAnonymous
    });
    
    res.json({ data: donation });
  } catch (error) {
    console.error('Error recording donation:', error);
    res.status(500).json({ error: 'Failed to record donation' });
  }
});

// ==================== ADMIN AUTH ENDPOINTS ====================

/**
 * POST /api/admin/login
 * Login with password
 */
app.post('/api/admin/login', (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }
    
    if (!verifyPassword(password)) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    const status = getAdminStatus();
    const session = createSession(!status.mfaEnabled); // Auto-verify MFA if not enabled
    
    res.json({
      data: {
        sessionId: session.sessionId,
        expiresAt: session.expiresAt,
        mfaRequired: status.mfaEnabled,
        isTempPassword: status.isTempPassword
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/admin/verify-mfa
 * Verify MFA token after login
 */
app.post('/api/admin/verify-mfa', async (req, res) => {
  try {
    const sessionId = req.headers['x-admin-session'];
    const { token } = req.body;
    
    const session = verifySession(sessionId);
    if (!session.valid) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    
    const result = await verifyMfa(token);
    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }
    
    updateSessionMfa(sessionId, true);
    
    res.json({
      data: {
        success: true,
        usedBackupCode: result.usedBackupCode,
        remainingBackupCodes: result.remainingBackupCodes
      }
    });
  } catch (error) {
    console.error('MFA verification error:', error);
    res.status(500).json({ error: 'MFA verification failed' });
  }
});

/**
 * POST /api/admin/logout
 * Logout and invalidate session
 */
app.post('/api/admin/logout', (req, res) => {
  try {
    const sessionId = req.headers['x-admin-session'];
    if (sessionId) {
      invalidateSession(sessionId);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * GET /api/admin/status
 * Get admin account status
 */
app.get('/api/admin/status', (req, res) => {
  try {
    const sessionId = req.headers['x-admin-session'];
    const session = verifySession(sessionId);
    const status = getAdminStatus();

    res.json({
      data: {
        ...status,
        isLoggedIn: session.valid,
        mfaVerified: session.mfaVerified
      }
    });
  } catch (error) {
    console.error('Error fetching admin status:', error);
    res.status(500).json({ error: 'Failed to fetch admin status' });
  }
});

/**
 * POST /api/admin/change-password
 * Change admin password
 */
app.post('/api/admin/change-password', requireAdmin, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current and new password required' });
    }
    
    const result = changePassword(currentPassword, newPassword);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Password change failed' });
  }
});

/**
 * POST /api/admin/mfa/setup
 * Start MFA setup - get QR code
 */
app.post('/api/admin/mfa/setup', requireAdmin, async (req, res) => {
  try {
    const mfaSetup = setupMfa();
    
    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(mfaSetup.otpauthUrl);
    
    res.json({
      data: {
        secret: mfaSetup.secret,
        qrCode: qrCodeDataUrl,
        backupCodes: mfaSetup.backupCodes
      }
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({ error: 'MFA setup failed' });
  }
});

/**
 * POST /api/admin/mfa/enable
 * Verify token and enable MFA
 */
app.post('/api/admin/mfa/enable', requireAdmin, async (req, res) => {
  try {
    const { secret, token, backupCodes } = req.body;
    
    if (!secret || !token || !backupCodes) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const result = await enableMfa(secret, token, backupCodes);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('MFA enable error:', error);
    res.status(500).json({ error: 'Failed to enable MFA' });
  }
});

/**
 * POST /api/admin/mfa/disable
 * Disable MFA (requires password)
 */
app.post('/api/admin/mfa/disable', requireAdmin, (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }
    
    const result = disableMfa(password);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('MFA disable error:', error);
    res.status(500).json({ error: 'Failed to disable MFA' });
  }
});

// ==================== AD SETTINGS ENDPOINTS ====================

/**
 * GET /api/ads/settings
 * Get ad settings
 */
app.get('/api/ads/settings', (req, res) => {
  try {
    const settings = getAdSettings();
    res.json({ data: settings });
  } catch (error) {
    console.error('Error fetching ad settings:', error);
    res.status(500).json({ error: 'Failed to fetch ad settings' });
  }
});

/**
 * PUT /api/ads/settings
 * Update ad settings (admin only)
 */
app.put('/api/ads/settings', requireAdmin, (req, res) => {
  try {
    const { adsEnabled, adsensePublisherId, placements } = req.body;
    const settings = updateAdSettings({ adsEnabled, adsensePublisherId, placements });
    res.json({ data: settings });
  } catch (error) {
    console.error('Error updating ad settings:', error);
    res.status(500).json({ error: 'Failed to update ad settings' });
  }
});

/**
 * POST /api/ads/toggle
 * Toggle ads on/off (admin only)
 */
app.post('/api/ads/toggle', requireAdmin, (req, res) => {
  try {
    const { enabled } = req.body;
    const settings = toggleAds(enabled);
    res.json({ data: settings });
  } catch (error) {
    console.error('Error toggling ads:', error);
    res.status(500).json({ error: 'Failed to toggle ads' });
  }
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

// Initialize macro tables
initMacroTables();

// Initialize provider management tables
initProviderTables();
seedDefaultProviders();

// Initialize email settings
initEmailSettings();

// Initialize secure email notification tables
initSecureEmailTables();

// ==================== EMAIL NOTIFICATION ENDPOINTS ====================

/**
 * GET /api/email/settings
 * Get email settings (admin only)
 */
app.get('/api/email/settings', requireAdmin, (req, res) => {
  try {
    const settings = getEmailSettings();
    // Don't return the password
    const { smtpPass, ...safeSettings } = settings;
    res.json({ data: { ...safeSettings, hasPassword: !!smtpPass } });
  } catch (error) {
    console.error('Error fetching email settings:', error);
    res.status(500).json({ error: 'Failed to fetch email settings' });
  }
});

/**
 * PUT /api/email/settings
 * Update email settings (admin only)
 */
app.put('/api/email/settings', requireAdmin, (req, res) => {
  try {
    const settings = updateEmailSettings(req.body);
    const { smtpPass, ...safeSettings } = settings;
    res.json({ data: { ...safeSettings, hasPassword: !!smtpPass } });
  } catch (error) {
    console.error('Error updating email settings:', error);
    res.status(500).json({ error: 'Failed to update email settings' });
  }
});

/**
 * POST /api/email/test
 * Test email configuration (admin only)
 */
app.post('/api/email/test', requireAdmin, async (req, res) => {
  try {
    const result = await testEmailConfiguration(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error testing email:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/email/subscribers
 * Get all email subscribers (admin only)
 */
app.get('/api/email/subscribers', requireAdmin, (req, res) => {
  try {
    const subscribers = getEmailSubscribers();
    res.json({ data: subscribers });
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

/**
 * POST /api/email/subscribers
 * Add email subscriber (admin only)
 */
app.post('/api/email/subscribers', requireAdmin, (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const subscriber = addEmailSubscriber(email, name);
    res.status(201).json({ data: subscriber });
  } catch (error) {
    console.error('Error adding subscriber:', error);
    res.status(500).json({ error: 'Failed to add subscriber' });
  }
});

/**
 * PUT /api/email/subscribers/:id
 * Update email subscriber (admin only)
 */
app.put('/api/email/subscribers/:id', requireAdmin, (req, res) => {
  try {
    const subscriber = updateEmailSubscriber(req.params.id, req.body);
    if (!subscriber) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }
    res.json({ data: subscriber });
  } catch (error) {
    console.error('Error updating subscriber:', error);
    res.status(500).json({ error: 'Failed to update subscriber' });
  }
});

/**
 * DELETE /api/email/subscribers/:id
 * Delete email subscriber (admin only)
 */
app.delete('/api/email/subscribers/:id', requireAdmin, (req, res) => {
  try {
    const deleted = deleteEmailSubscriber(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting subscriber:', error);
    res.status(500).json({ error: 'Failed to delete subscriber' });
  }
});

/**
 * GET /api/email/stats
 * Get email notification statistics (admin only)
 */
app.get('/api/email/stats', requireAdmin, (req, res) => {
  try {
    const stats = getEmailStats();
    res.json({ data: stats });
  } catch (error) {
    console.error('Error fetching email stats:', error);
    res.status(500).json({ error: 'Failed to fetch email stats' });
  }
});

/**
 * POST /api/email/send-test
 * Send test signal notification (admin only)
 */
app.post('/api/email/send-test', requireAdmin, async (req, res) => {
  try {
    const testSignal = {
      id: 'test-' + Date.now(),
      type: req.body.type || 'BUY',
      strength: req.body.strength || 'STRONG',
      price: req.body.price || 4500,
      timestamp: Date.now(),
      fibLevel: '61.8%',
      fibValue: 4450,
      explanation: 'This is a test signal to verify email notifications are working correctly.',
      technicalDetails: {
        currentPrice: 4500,
        nearestFibLevel: '61.8%',
        distanceToLevel: 50,
        trendDirection: 'UP',
        priceAction: 'Bullish momentum',
      },
    };
    
    const result = await sendSignalNotification(testSignal);
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: 'Failed to send test email' });
  }
});

// ==================== SECURE EMAIL NOTIFICATION ENDPOINTS ====================

/**
 * POST /api/notifications/request
 * Request email subscription (rate limited: 3 per IP per day)
 */
app.post('/api/notifications/request', async (req, res) => {
  try {
    const { email, name } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const result = requestSubscription(email, name, ip, userAgent);
    res.json(result);
  } catch (error) {
    console.error('Error requesting subscription:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/notifications/rate-limit
 * Check current rate limit status
 */
app.get('/api/notifications/rate-limit', (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const status = checkRateLimit(ip);
    res.json({
      allowed: status.allowed,
      remaining: status.remaining,
      resetAt: new Date(status.resetAt).toISOString()
    });
  } catch (error) {
    console.error('Error checking rate limit:', error);
    res.status(500).json({ error: 'Failed to check rate limit' });
  }
});

/**
 * POST /api/notifications/approve/:token
 * Approve subscription request (admin only)
 */
app.post('/api/notifications/approve/:token', requireAdmin, (req, res) => {
  try {
    const { token } = req.params;
    const adminEmail = req.adminSession?.email || 'admin';
    
    const result = approveSubscription(token, adminEmail);
    res.json(result);
  } catch (error) {
    console.error('Error approving subscription:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/notifications/approve-link/:token
 * Simple approval link (for email links, returns HTML)
 */
app.get('/api/notifications/approve/:token', (req, res) => {
  try {
    const { token } = req.params;
    
    const result = approveSubscription(token, 'email_link');
    
    // Return HTML response for better UX
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Subscription Approved</title>
  <style>
    body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #111827; }
    .container { text-align: center; padding: 40px; background: #1f2937; border-radius: 16px; max-width: 500px; }
    .success { color: #22c55e; font-size: 64px; margin-bottom: 20px; }
    h1 { color: white; margin-bottom: 10px; }
    p { color: #9ca3af; margin-bottom: 20px; }
    a { color: #f59e0b; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="success">✓</div>
    <h1>Subscription Approved!</h1>
    <p>${result.message}</p>
    <p>A welcome email has been sent to ${result.email}.</p>
    <p><a href="/">Return to Gold Fib Signals</a></p>
  </div>
</body>
</html>
    `);
  } catch (error) {
    console.error('Error approving subscription:', error);
    res.status(400).send(`
<!DOCTYPE html>
<html>
<head>
  <title>Error</title>
  <style>
    body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #111827; }
    .container { text-align: center; padding: 40px; background: #1f2937; border-radius: 16px; max-width: 500px; }
    .error { color: #ef4444; font-size: 64px; margin-bottom: 20px; }
    h1 { color: white; margin-bottom: 10px; }
    p { color: #9ca3af; margin-bottom: 20px; }
    a { color: #f59e0b; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="error">✗</div>
    <h1>Unable to Approve</h1>
    <p>${error.message}</p>
    <p><a href="/">Return to Gold Fib Signals</a></p>
  </div>
</body>
</html>
    `);
  }
});

/**
 * POST /api/notifications/reject/:token
 * Reject subscription request (admin only)
 */
app.post('/api/notifications/reject/:token', requireAdmin, (req, res) => {
  try {
    const { token } = req.params;
    const { reason } = req.body;
    const adminEmail = req.adminSession?.email || 'admin';
    
    const result = rejectSubscription(token, reason, adminEmail);
    res.json(result);
  } catch (error) {
    console.error('Error rejecting subscription:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/notifications/reject/:token
 * Simple reject link (for email links, returns HTML)
 */
app.get('/api/notifications/reject/:token', (req, res) => {
  try {
    const { token } = req.params;
    
    const result = rejectSubscription(token, 'Rejected via email link', 'email_link');
    
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Subscription Rejected</title>
  <style>
    body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #111827; }
    .container { text-align: center; padding: 40px; background: #1f2937; border-radius: 16px; max-width: 500px; }
    .info { color: #6b7280; font-size: 64px; margin-bottom: 20px; }
    h1 { color: white; margin-bottom: 10px; }
    p { color: #9ca3af; margin-bottom: 20px; }
    a { color: #f59e0b; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="info">✓</div>
    <h1>Subscription Rejected</h1>
    <p>${result.message}</p>
    <p>The user at ${result.email} has been notified.</p>
    <p><a href="/">Return to Gold Fib Signals</a></p>
  </div>
</body>
</html>
    `);
  } catch (error) {
    console.error('Error rejecting subscription:', error);
    res.status(400).send(`
<!DOCTYPE html>
<html>
<head>
  <title>Error</title>
  <style>
    body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #111827; }
    .container { text-align: center; padding: 40px; background: #1f2937; border-radius: 16px; max-width: 500px; }
    .error { color: #ef4444; font-size: 64px; margin-bottom: 20px; }
    h1 { color: white; margin-bottom: 10px; }
    p { color: #9ca3af; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="error">✗</div>
    <h1>Error</h1>
    <p>${error.message}</p>
  </div>
</body>
</html>
    `);
  }
});

/**
 * GET /api/notifications/pending
 * Get pending subscription requests (admin only)
 */
app.get('/api/notifications/pending', requireAdmin, (req, res) => {
  try {
    const requests = getPendingRequests();
    res.json({ data: requests });
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({ error: 'Failed to fetch pending requests' });
  }
});

/**
 * POST /api/notifications/unsubscribe/:token
 * Unsubscribe using token
 */
app.post('/api/notifications/unsubscribe/:token', (req, res) => {
  try {
    const { token } = req.params;
    
    const result = unsubscribe(token);
    res.json(result);
  } catch (error) {
    console.error('Error unsubscribing:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/notifications/unsubscribe/:token
 * Unsubscribe page (HTML)
 */
app.get('/api/notifications/unsubscribe/:token', (req, res) => {
  try {
    const { token } = req.params;
    
    const result = unsubscribe(token);
    
    res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Unsubscribed</title>
  <style>
    body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #111827; }
    .container { text-align: center; padding: 40px; background: #1f2937; border-radius: 16px; max-width: 500px; }
    .success { color: #22c55e; font-size: 64px; margin-bottom: 20px; }
    h1 { color: white; margin-bottom: 10px; }
    p { color: #9ca3af; margin-bottom: 20px; }
    a { color: #f59e0b; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="success">✓</div>
    <h1>Unsubscribed Successfully</h1>
    <p>${result.message}</p>
    <p>You will no longer receive email notifications from Gold Fib Signals.</p>
    <p><a href="/">Return to Gold Fib Signals</a></p>
  </div>
</body>
</html>
    `);
  } catch (error) {
    console.error('Error unsubscribing:', error);
    res.status(400).send(`
<!DOCTYPE html>
<html>
<head>
  <title>Error</title>
  <style>
    body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #111827; }
    .container { text-align: center; padding: 40px; background: #1f2937; border-radius: 16px; max-width: 500px; }
    .error { color: #ef4444; font-size: 64px; margin-bottom: 20px; }
    h1 { color: white; margin-bottom: 10px; }
    p { color: #9ca3af; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="error">✗</div>
    <h1>Error</h1>
    <p>${error.message}</p>
  </div>
</body>
</html>
    `);
  }
});

/**
 * POST /api/stripe/webhook
 * Stripe webhook for donation verification
 */
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const event = JSON.parse(req.body);
    
    const result = handleStripeWebhook(event);
    res.json(result);
  } catch (error) {
    console.error('Error handling Stripe webhook:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/admin/notification-settings
 * Get admin notification settings (admin only)
 */
app.get('/api/admin/notification-settings', requireAdmin, (req, res) => {
  try {
    const settings = getAdminNotificationSettings();
    res.json({ data: settings });
  } catch (error) {
    console.error('Error fetching notification settings:', error);
    res.status(500).json({ error: 'Failed to fetch notification settings' });
  }
});

/**
 * PUT /api/admin/notification-settings
 * Update admin notification settings (admin only)
 */
app.put('/api/admin/notification-settings', requireAdmin, (req, res) => {
  try {
    const updates = req.body;
    const settings = updateAdminNotificationSettings(updates);
    res.json({ data: settings });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({ error: 'Failed to update notification settings' });
  }
});

/**
 * GET /api/admin/notification-stats
 * Get secure email notification stats (admin only)
 */
app.get('/api/admin/notification-stats', requireAdmin, (req, res) => {
  try {
    const stats = getSecureEmailStats();
    res.json({ data: stats });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({ error: 'Failed to fetch notification stats' });
  }
});

/**
 * GET /api/admin/audit-log
 * Get email audit log (admin only)
 */
app.get('/api/admin/audit-log', requireAdmin, (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const logs = getAuditLog(limit);
    res.json({ data: logs });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

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
  
  Macro Analysis:
  GET  /api/macro/full-context      - Comprehensive macro context
  GET  /api/macro/rates             - Fed funds futures probabilities
  GET  /api/macro/yields            - Treasury yields
  GET  /api/macro/dxy               - US Dollar Index
  GET  /api/macro/correlation       - Gold/DXY correlation
  GET  /api/macro/regime            - Macro regime classification
  GET  /api/macro/regime/history    - Historical regime data
  
  Data Providers:
  GET  /api/providers               - List all providers
  GET  /api/providers/active        - List active providers
  GET  /api/providers/dashboard     - Provider dashboard
  GET  /api/providers/:id           - Get provider details
  POST /api/providers               - Add new provider
  PUT  /api/providers/:id           - Update provider
  DELETE /api/providers/:id         - Delete provider
  POST /api/providers/:id/test      - Test provider connection
  POST /api/providers/:id/toggle    - Enable/disable provider
  POST /api/providers/:id/priority  - Set provider priority
  GET  /api/providers/health/check  - Run health checks
  GET  /api/price/providers         - Fetch price with fallback
  
  Settings:
  GET  /api/settings                - Get all settings
  GET  /api/settings/providers      - Get API providers
  POST /api/settings/providers      - Add API provider
  PUT  /api/settings/providers/:id  - Update API provider
  DELETE /api/settings/providers/:id - Delete API provider
  POST /api/settings/providers/:id/test - Test provider
  GET  /api/settings/refresh        - Get refresh settings
  PUT  /api/settings/refresh        - Update refresh settings
  GET  /api/settings/fibonacci      - Get Fibonacci repricing settings
  PUT  /api/settings/fibonacci      - Update Fibonacci settings
  POST /api/settings/fibonacci/recalculate - Force recalculation
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
