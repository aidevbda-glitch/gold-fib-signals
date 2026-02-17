import express from 'express';
import cors from 'cors';
import { fetchCurrentPrice, fetchHistoricalData, getPriceHistory } from './goldPriceService.js';
import { saveSignal, getSignals, getSignalStats, getLatestSignal, getSignalsByDateRange } from './signalService.js';

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
    const price = await fetchCurrentPrice();
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

// ==================== START SERVER ====================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
🥇 Gold Fib Signals API Server
================================
Port: ${PORT}
Time: ${new Date().toISOString()}

Endpoints:
  GET  /health              - Health check
  GET  /api/price/current   - Current gold price
  GET  /api/price/history   - Historical data (Yahoo Finance)
  GET  /api/price/cached    - Cached history from DB
  POST /api/signals         - Save a signal
  GET  /api/signals         - Get signals (paginated)
  GET  /api/signals/latest  - Get latest signal
  GET  /api/signals/stats   - Get statistics
  GET  /api/signals/range   - Get signals by date range
================================
  `);

  // Fetch initial data
  console.log('📊 Fetching initial price data...');
  fetchCurrentPrice().then(() => console.log('✅ Current price loaded'));
  fetchHistoricalData('1y', '1d').then(() => console.log('✅ 1-year history loaded'));
});
