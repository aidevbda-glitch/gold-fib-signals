import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

// Ensure data directory exists
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const dbPath = join(dataDir, 'gold_signals.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Initialize tables
db.exec(`
  -- Historical daily price data (from FreeGoldAPI)
  -- Used as reference for charts
  CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL UNIQUE,
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
    volume INTEGER,
    source TEXT DEFAULT 'freegoldapi',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Intraday price ticks from Swissquote
  -- Stores every price update for accuracy tracking
  -- Retained for up to 1 year
  CREATE TABLE IF NOT EXISTS intraday_ticks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    bid REAL NOT NULL,
    ask REAL NOT NULL,
    mid REAL NOT NULL,
    spread REAL NOT NULL,
    source TEXT DEFAULT 'swissquote',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Daily aggregated data from Swissquote intraday ticks
  -- One row per day with bid/ask high/low tracking
  CREATE TABLE IF NOT EXISTS daily_aggregates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL UNIQUE,  -- YYYY-MM-DD format
    bid_open REAL,
    bid_high REAL NOT NULL,
    bid_low REAL NOT NULL,
    bid_close REAL,
    ask_open REAL,
    ask_high REAL NOT NULL,
    ask_low REAL NOT NULL,
    ask_close REAL,
    mid_open REAL,
    mid_high REAL NOT NULL,
    mid_low REAL NOT NULL,
    mid_close REAL,
    tick_count INTEGER DEFAULT 0,
    first_tick_at INTEGER,
    last_tick_at INTEGER,
    source TEXT DEFAULT 'swissquote',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Trading signals table
  CREATE TABLE IF NOT EXISTS signals (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('BUY', 'SELL')),
    strength TEXT NOT NULL CHECK(strength IN ('STRONG', 'MODERATE', 'WEAK')),
    price REAL NOT NULL,
    timestamp INTEGER NOT NULL,
    fib_level TEXT NOT NULL,
    fib_value REAL NOT NULL,
    explanation TEXT NOT NULL,
    technical_details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Current price snapshots (for 24h stats)
  CREATE TABLE IF NOT EXISTS price_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    price REAL NOT NULL,
    bid REAL,
    ask REAL,
    high_24h REAL,
    low_24h REAL,
    change_24h REAL,
    change_percent_24h REAL,
    timestamp INTEGER NOT NULL,
    source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Indexes for faster queries
  CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON price_history(timestamp);
  CREATE INDEX IF NOT EXISTS idx_intraday_ticks_timestamp ON intraday_ticks(timestamp);
  CREATE INDEX IF NOT EXISTS idx_daily_aggregates_date ON daily_aggregates(date);
  CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp);
  CREATE INDEX IF NOT EXISTS idx_signals_type ON signals(type);
  CREATE INDEX IF NOT EXISTS idx_price_snapshots_timestamp ON price_snapshots(timestamp);
`);

console.log('✅ Database initialized at:', dbPath);

export default db;
