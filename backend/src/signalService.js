import db from './database.js';

/**
 * Save a trading signal to the database
 */
export function saveSignal(signal) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO signals (id, type, strength, price, timestamp, fib_level, fib_value, explanation, technical_details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    signal.id,
    signal.type,
    signal.strength,
    signal.price,
    signal.timestamp,
    signal.fibLevel,
    signal.fibValue,
    signal.explanation,
    JSON.stringify(signal.technicalDetails)
  );

  console.log(`✅ Saved signal: ${signal.type} at $${signal.price}`);
  return signal;
}

/**
 * Get all signals with pagination
 */
export function getSignals({ limit = 50, offset = 0, type = null } = {}) {
  let query = `
    SELECT * FROM signals
    ${type ? 'WHERE type = ?' : ''}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `;

  const params = type ? [type, limit, offset] : [limit, offset];
  const rows = db.prepare(query).all(...params);

  return rows.map(row => ({
    id: row.id,
    type: row.type,
    strength: row.strength,
    price: row.price,
    timestamp: row.timestamp,
    fibLevel: row.fib_level,
    fibValue: row.fib_value,
    explanation: row.explanation,
    technicalDetails: JSON.parse(row.technical_details || '{}')
  }));
}

/**
 * Get signals within a time range
 */
export function getSignalsByDateRange(startDate, endDate) {
  const rows = db.prepare(`
    SELECT * FROM signals
    WHERE timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp DESC
  `).all(startDate, endDate);

  return rows.map(row => ({
    id: row.id,
    type: row.type,
    strength: row.strength,
    price: row.price,
    timestamp: row.timestamp,
    fibLevel: row.fib_level,
    fibValue: row.fib_value,
    explanation: row.explanation,
    technicalDetails: JSON.parse(row.technical_details || '{}')
  }));
}

/**
 * Get signal statistics
 */
export function getSignalStats() {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN type = 'BUY' THEN 1 ELSE 0 END) as buy_count,
      SUM(CASE WHEN type = 'SELL' THEN 1 ELSE 0 END) as sell_count,
      SUM(CASE WHEN strength = 'STRONG' THEN 1 ELSE 0 END) as strong_count,
      SUM(CASE WHEN strength = 'MODERATE' THEN 1 ELSE 0 END) as moderate_count,
      SUM(CASE WHEN strength = 'WEAK' THEN 1 ELSE 0 END) as weak_count,
      MIN(timestamp) as first_signal,
      MAX(timestamp) as last_signal
    FROM signals
  `).get();

  return {
    total: stats.total,
    buyCount: stats.buy_count,
    sellCount: stats.sell_count,
    strongCount: stats.strong_count,
    moderateCount: stats.moderate_count,
    weakCount: stats.weak_count,
    firstSignal: stats.first_signal,
    lastSignal: stats.last_signal
  };
}

/**
 * Delete old signals (cleanup)
 */
export function cleanupOldSignals(daysToKeep = 365) {
  const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
  
  const result = db.prepare(`
    DELETE FROM signals WHERE timestamp < ?
  `).run(cutoff);

  console.log(`🧹 Cleaned up ${result.changes} old signals`);
  return result.changes;
}

/**
 * Get latest signal
 */
export function getLatestSignal() {
  const row = db.prepare(`
    SELECT * FROM signals ORDER BY timestamp DESC LIMIT 1
  `).get();

  if (!row) return null;

  return {
    id: row.id,
    type: row.type,
    strength: row.strength,
    price: row.price,
    timestamp: row.timestamp,
    fibLevel: row.fib_level,
    fibValue: row.fib_value,
    explanation: row.explanation,
    technicalDetails: JSON.parse(row.technical_details || '{}')
  };
}
