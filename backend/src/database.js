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
  -- Price history table
  CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL UNIQUE,
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
    volume INTEGER,
    source TEXT DEFAULT 'api',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

  -- Current price snapshots
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
  CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp);
  CREATE INDEX IF NOT EXISTS idx_signals_type ON signals(type);
  CREATE INDEX IF NOT EXISTS idx_price_snapshots_timestamp ON price_snapshots(timestamp);
`);

console.log('✅ Database initialized at:', dbPath);

export default db;
