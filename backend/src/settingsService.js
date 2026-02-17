import db from './database.js';
import { randomUUID } from 'crypto';

// Initialize settings table
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS api_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    api_key TEXT NOT NULL,
    request_type TEXT DEFAULT 'GET',
    is_active INTEGER DEFAULT 0,
    headers TEXT,
    symbol_format TEXT DEFAULT 'XAU',
    currency_format TEXT DEFAULT 'USD',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

/**
 * Get a setting by key
 */
export function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : null;
}

/**
 * Set a setting
 */
export function setSetting(key, value) {
  db.prepare(`
    INSERT OR REPLACE INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `).run(key, JSON.stringify(value));
}

/**
 * Get all settings
 */
export function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = JSON.parse(row.value);
  }
  return settings;
}

/**
 * Add a new API provider
 */
export function addApiProvider(provider) {
  const id = provider.id || randomUUID();
  const now = Date.now();

  db.prepare(`
    INSERT INTO api_providers (id, name, endpoint, api_key, request_type, is_active, headers, symbol_format, currency_format, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    provider.name,
    provider.endpoint,
    provider.apiKey,
    provider.requestType || 'GET',
    provider.isActive ? 1 : 0,
    provider.headers ? JSON.stringify(provider.headers) : null,
    provider.symbolFormat || 'XAU',
    provider.currencyFormat || 'USD',
    now,
    now
  );

  return getApiProvider(id);
}

/**
 * Update an API provider
 */
export function updateApiProvider(id, updates) {
  const existing = getApiProvider(id);
  if (!existing) {
    throw new Error('API provider not found');
  }

  const fields = [];
  const values = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.endpoint !== undefined) {
    fields.push('endpoint = ?');
    values.push(updates.endpoint);
  }
  if (updates.apiKey !== undefined) {
    fields.push('api_key = ?');
    values.push(updates.apiKey);
  }
  if (updates.requestType !== undefined) {
    fields.push('request_type = ?');
    values.push(updates.requestType);
  }
  if (updates.isActive !== undefined) {
    fields.push('is_active = ?');
    values.push(updates.isActive ? 1 : 0);
    
    // If activating this provider, deactivate others
    if (updates.isActive) {
      db.prepare('UPDATE api_providers SET is_active = 0 WHERE id != ?').run(id);
    }
  }
  if (updates.headers !== undefined) {
    fields.push('headers = ?');
    values.push(JSON.stringify(updates.headers));
  }
  if (updates.symbolFormat !== undefined) {
    fields.push('symbol_format = ?');
    values.push(updates.symbolFormat);
  }
  if (updates.currencyFormat !== undefined) {
    fields.push('currency_format = ?');
    values.push(updates.currencyFormat);
  }

  if (fields.length > 0) {
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    db.prepare(`
      UPDATE api_providers SET ${fields.join(', ')} WHERE id = ?
    `).run(...values);
  }

  return getApiProvider(id);
}

/**
 * Delete an API provider
 */
export function deleteApiProvider(id) {
  const result = db.prepare('DELETE FROM api_providers WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Get an API provider by ID
 */
export function getApiProvider(id) {
  const row = db.prepare('SELECT * FROM api_providers WHERE id = ?').get(id);
  return row ? mapProviderRow(row) : null;
}

/**
 * Get all API providers
 */
export function getAllApiProviders() {
  const rows = db.prepare('SELECT * FROM api_providers ORDER BY created_at DESC').all();
  return rows.map(mapProviderRow);
}

/**
 * Get the active API provider
 */
export function getActiveApiProvider() {
  const row = db.prepare('SELECT * FROM api_providers WHERE is_active = 1').get();
  return row ? mapProviderRow(row) : null;
}

/**
 * Map database row to provider object
 */
function mapProviderRow(row) {
  return {
    id: row.id,
    name: row.name,
    endpoint: row.endpoint,
    apiKey: row.api_key,
    requestType: row.request_type,
    isActive: row.is_active === 1,
    headers: row.headers ? JSON.parse(row.headers) : null,
    symbolFormat: row.symbol_format,
    currencyFormat: row.currency_format,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

/**
 * Get refresh settings
 */
export function getRefreshSettings() {
  return getSetting('refresh') || {
    interval: 'weekly',
    intervalMs: 7 * 24 * 60 * 60 * 1000,
    lastRefresh: null,
  };
}

/**
 * Update refresh settings
 */
export function setRefreshSettings(settings) {
  setSetting('refresh', settings);
  return getRefreshSettings();
}
