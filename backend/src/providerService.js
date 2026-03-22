/**
 * Data Provider Management Service
 * 
 * Manages multiple data providers for gold price data with:
 * - Provider registration and configuration
 * - Priority-based fallback system
 * - Health monitoring and status tracking
 * - Rate limiting and quota management
 */

import db from './database.js';

// Default providers configuration
export const DEFAULT_PROVIDERS = [
  {
    id: 'gold-api-com',
    name: 'Gold-API.com',
    type: 'rest',
    endpoint: 'https://api.gold-api.com/price/XAU',
    requestType: 'GET',
    headers: {},
    authType: 'none',
    apiKey: null,
    isActive: true,
    priority: 1, // Highest priority
    rateLimitPerMinute: 60,
    timeoutMs: 5000,
    supportsHistorical: false,
    supportsIntraday: false,
    responseFormat: {
      pricePath: 'price',
      bidPath: null,
      askPath: null,
      timestampPath: 'updatedAt',
      symbolPath: 'symbol'
    }
  },
  {
    id: 'swissquote',
    name: 'Swissquote Forex Feed',
    type: 'rest',
    endpoint: 'https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD',
    requestType: 'GET',
    headers: {
      'User-Agent': 'GoldFibSignals/1.0',
      'Accept': 'application/json'
    },
    authType: 'none',
    apiKey: null,
    isActive: true,
    priority: 2,
    rateLimitPerMinute: 120,
    timeoutMs: 5000,
    supportsHistorical: false,
    supportsIntraday: true,
    responseFormat: {
      pricePath: 'spreadProfilePrices[0].bid', // Will need custom parsing
      bidPath: 'spreadProfilePrices[0].bid',
      askPath: 'spreadProfilePrices[0].ask',
      timestampPath: 'ts',
      symbolPath: null
    }
  },
  {
    id: 'yahoo-finance',
    name: 'Yahoo Finance',
    type: 'rest',
    endpoint: 'https://query1.finance.yahoo.com/v8/finance/chart/GC=F',
    requestType: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    authType: 'none',
    apiKey: null,
    isActive: true,
    priority: 3,
    rateLimitPerMinute: 30,
    timeoutMs: 10000,
    supportsHistorical: true,
    supportsIntraday: true,
    responseFormat: {
      pricePath: 'chart.result[0].meta.regularMarketPrice',
      bidPath: null,
      askPath: null,
      timestampPath: 'chart.result[0].meta.regularMarketTime',
      symbolPath: 'chart.result[0].meta.symbol'
    }
  },
  {
    id: 'freegoldapi',
    name: 'FreeGoldAPI',
    type: 'rest',
    endpoint: 'https://freegoldapi.com/data/latest.json',
    requestType: 'GET',
    headers: {},
    authType: 'none',
    apiKey: null,
    isActive: true,
    priority: 4,
    rateLimitPerMinute: 10,
    timeoutMs: 10000,
    supportsHistorical: true,
    supportsIntraday: false,
    responseFormat: {
      pricePath: '[-1].price', // Last item in array
      bidPath: null,
      askPath: null,
      timestampPath: '[-1].date',
      symbolPath: null
    }
  },
  {
    id: 'goldapi-io',
    name: 'GoldAPI.io',
    type: 'rest',
    endpoint: 'https://www.goldapi.io/api/XAU/USD',
    requestType: 'GET',
    headers: {},
    authType: 'header',
    apiKeyHeader: 'x-access-token',
    apiKey: null,
    isActive: false, // Disabled by default (requires API key)
    priority: 5,
    rateLimitPerMinute: 60,
    timeoutMs: 5000,
    supportsHistorical: true,
    supportsIntraday: false,
    responseFormat: {
      pricePath: 'price',
      bidPath: 'bid',
      askPath: 'ask',
      timestampPath: 'timestamp',
      symbolPath: 'metal'
    }
  }
];

/**
 * Initialize provider management tables
 */
export function initProviderTables() {
  // Providers table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS data_providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      requestType TEXT DEFAULT 'GET',
      headers TEXT,
      authType TEXT DEFAULT 'none',
      apiKeyHeader TEXT,
      apiKey TEXT,
      isActive BOOLEAN DEFAULT 1,
      priority INTEGER DEFAULT 99,
      rateLimitPerMinute INTEGER DEFAULT 60,
      timeoutMs INTEGER DEFAULT 5000,
      supportsHistorical BOOLEAN DEFAULT 0,
      supportsIntraday BOOLEAN DEFAULT 0,
      responseFormat TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Provider usage tracking
  db.prepare(`
    CREATE TABLE IF NOT EXISTS provider_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL,
      request_count INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      last_request_at INTEGER,
      last_success_at INTEGER,
      last_error_at INTEGER,
      last_error_message TEXT,
      average_response_time_ms INTEGER,
      date TEXT NOT NULL,
      FOREIGN KEY (provider_id) REFERENCES data_providers(id),
      UNIQUE(provider_id, date)
    )
  `).run();

  // Provider health checks
  db.prepare(`
    CREATE TABLE IF NOT EXISTS provider_health (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider_id TEXT NOT NULL,
      status TEXT DEFAULT 'unknown',
      response_time_ms INTEGER,
      last_check_at INTEGER,
      consecutive_failures INTEGER DEFAULT 0,
      FOREIGN KEY (provider_id) REFERENCES data_providers(id)
    )
  `).run();

  // Provider fallback log
  db.prepare(`
    CREATE TABLE IF NOT EXISTS provider_fallback_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      failed_provider_id TEXT NOT NULL,
      fallback_provider_id TEXT NOT NULL,
      reason TEXT,
      FOREIGN KEY (failed_provider_id) REFERENCES data_providers(id),
      FOREIGN KEY (fallback_provider_id) REFERENCES data_providers(id)
    )
  `).run();

  console.log('✅ Provider management tables initialized');
}

/**
 * Seed default providers if table is empty
 */
export function seedDefaultProviders() {
  const count = db.prepare('SELECT COUNT(*) as count FROM data_providers').get();
  
  if (count.count === 0) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO data_providers 
      (id, name, type, endpoint, requestType, headers, authType, apiKeyHeader, apiKey, 
       isActive, priority, rateLimitPerMinute, timeoutMs, supportsHistorical, supportsIntraday, responseFormat)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const provider of DEFAULT_PROVIDERS) {
      stmt.run(
        provider.id,
        provider.name,
        provider.type,
        provider.endpoint,
        provider.requestType,
        JSON.stringify(provider.headers),
        provider.authType,
        provider.apiKeyHeader || null,
        provider.apiKey,
        provider.isActive ? 1 : 0,
        provider.priority,
        provider.rateLimitPerMinute,
        provider.timeoutMs,
        provider.supportsHistorical ? 1 : 0,
        provider.supportsIntraday ? 1 : 0,
        JSON.stringify(provider.responseFormat)
      );
    }
    console.log(`✅ Seeded ${DEFAULT_PROVIDERS.length} default providers`);
  }
}

/**
 * Get all providers
 */
export function getAllProviders() {
  const providers = db.prepare(`
    SELECT * FROM data_providers ORDER BY priority ASC, name ASC
  `).all();

  return providers.map(p => ({
    ...p,
    headers: JSON.parse(p.headers || '{}'),
    responseFormat: JSON.parse(p.responseFormat || '{}'),
    isActive: Boolean(p.isActive),
    supportsHistorical: Boolean(p.supportsHistorical),
    supportsIntraday: Boolean(p.supportsIntraday)
  }));
}

/**
 * Get active providers sorted by priority
 */
export function getActiveProviders() {
  const providers = db.prepare(`
    SELECT * FROM data_providers WHERE isActive = 1 ORDER BY priority ASC
  `).all();

  return providers.map(p => ({
    ...p,
    headers: JSON.parse(p.headers || '{}'),
    responseFormat: JSON.parse(p.responseFormat || '{}'),
    isActive: true,
    supportsHistorical: Boolean(p.supportsHistorical),
    supportsIntraday: Boolean(p.supportsIntraday)
  }));
}

/**
 * Get provider by ID
 */
export function getProvider(id) {
  const provider = db.prepare('SELECT * FROM data_providers WHERE id = ?').get(id);
  if (!provider) return null;

  return {
    ...provider,
    headers: JSON.parse(provider.headers || '{}'),
    responseFormat: JSON.parse(provider.responseFormat || '{}'),
    isActive: Boolean(provider.isActive),
    supportsHistorical: Boolean(provider.supportsHistorical),
    supportsIntraday: Boolean(provider.supportsIntraday)
  };
}

/**
 * Add a new provider
 */
export function addProvider(provider) {
  const stmt = db.prepare(`
    INSERT INTO data_providers 
    (id, name, type, endpoint, requestType, headers, authType, apiKeyHeader, apiKey,
     isActive, priority, rateLimitPerMinute, timeoutMs, supportsHistorical, supportsIntraday, responseFormat)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    provider.id,
    provider.name,
    provider.type,
    provider.endpoint,
    provider.requestType || 'GET',
    JSON.stringify(provider.headers || {}),
    provider.authType || 'none',
    provider.apiKeyHeader || null,
    provider.apiKey || null,
    provider.isActive !== false ? 1 : 0,
    provider.priority || 99,
    provider.rateLimitPerMinute || 60,
    provider.timeoutMs || 5000,
    provider.supportsHistorical ? 1 : 0,
    provider.supportsIntraday ? 1 : 0,
    JSON.stringify(provider.responseFormat || {})
  );

  return getProvider(provider.id);
}

/**
 * Update a provider
 */
export function updateProvider(id, updates) {
  const provider = getProvider(id);
  if (!provider) throw new Error('Provider not found');

  const fields = [];
  const values = [];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.endpoint !== undefined) { fields.push('endpoint = ?'); values.push(updates.endpoint); }
  if (updates.requestType !== undefined) { fields.push('requestType = ?'); values.push(updates.requestType); }
  if (updates.headers !== undefined) { fields.push('headers = ?'); values.push(JSON.stringify(updates.headers)); }
  if (updates.authType !== undefined) { fields.push('authType = ?'); values.push(updates.authType); }
  if (updates.apiKeyHeader !== undefined) { fields.push('apiKeyHeader = ?'); values.push(updates.apiKeyHeader); }
  if (updates.apiKey !== undefined) { fields.push('apiKey = ?'); values.push(updates.apiKey); }
  if (updates.isActive !== undefined) { fields.push('isActive = ?'); values.push(updates.isActive ? 1 : 0); }
  if (updates.priority !== undefined) { fields.push('priority = ?'); values.push(updates.priority); }
  if (updates.rateLimitPerMinute !== undefined) { fields.push('rateLimitPerMinute = ?'); values.push(updates.rateLimitPerMinute); }
  if (updates.timeoutMs !== undefined) { fields.push('timeoutMs = ?'); values.push(updates.timeoutMs); }
  if (updates.supportsHistorical !== undefined) { fields.push('supportsHistorical = ?'); values.push(updates.supportsHistorical ? 1 : 0); }
  if (updates.supportsIntraday !== undefined) { fields.push('supportsIntraday = ?'); values.push(updates.supportsIntraday ? 1 : 0); }
  if (updates.responseFormat !== undefined) { fields.push('responseFormat = ?'); values.push(JSON.stringify(updates.responseFormat)); }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  db.prepare(`UPDATE data_providers SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  return getProvider(id);
}

/**
 * Delete a provider
 */
export function deleteProvider(id) {
  // Don't allow deleting system providers
  if (['gold-api-com', 'swissquote', 'yahoo-finance', 'freegoldapi'].includes(id)) {
    throw new Error('Cannot delete system default providers');
  }

  const result = db.prepare('DELETE FROM data_providers WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Set provider priority
 */
export function setProviderPriority(id, priority) {
  db.prepare('UPDATE data_providers SET priority = ? WHERE id = ?').run(priority, id);
  return getProvider(id);
}

/**
 * Toggle provider active status
 */
export function toggleProviderActive(id, isActive) {
  db.prepare('UPDATE data_providers SET isActive = ? WHERE id = ?').run(isActive ? 1 : 0, id);
  return getProvider(id);
}

/**
 * Test a provider connection
 */
export async function testProvider(provider) {
  const startTime = Date.now();
  
  try {
    const headers = {
      'Accept': 'application/json',
      ...provider.headers
    };

    if (provider.authType === 'header' && provider.apiKey) {
      headers[provider.apiKeyHeader || 'Authorization'] = provider.apiKey;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), provider.timeoutMs || 5000);

    const response = await fetch(provider.endpoint, {
      method: provider.requestType || 'GET',
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        success: false,
        status: response.status,
        responseTime,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const data = await response.json();

    // Try to extract price using response format
    let price = null;
    try {
      price = extractValueFromPath(data, provider.responseFormat?.pricePath);
    } catch (e) {
      // Price extraction failed but connection worked
    }

    return {
      success: true,
      status: response.status,
      responseTime,
      price,
      sample: JSON.stringify(data).substring(0, 200) + '...'
    };

  } catch (error) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      error: error.message
    };
  }
}

/**
 * Extract value from nested object using dot notation path
 */
function extractValueFromPath(obj, path) {
  if (!path) return null;

  // Handle array index notation like "[-1].price" or "result[0].price"
  const parts = path.match(/[^.\[\]]+|\[\d+\]|\[-\d+\]/g) || [];
  
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return null;

    if (part.startsWith('[') && part.endsWith(']')) {
      // Array index
      const index = parseInt(part.slice(1, -1));
      if (Array.isArray(current)) {
        current = current.at(index);
      } else {
        return null;
      }
    } else {
      current = current[part];
    }
  }

  return current;
}

/**
 * Get provider usage stats
 */
export function getProviderStats(providerId, days = 7) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().split('T')[0];

  const stats = db.prepare(`
    SELECT 
      date,
      request_count,
      success_count,
      error_count,
      last_request_at,
      last_success_at,
      last_error_at,
      average_response_time_ms
    FROM provider_usage
    WHERE provider_id = ? AND date >= ?
    ORDER BY date DESC
  `).all(providerId, sinceStr);

  return stats;
}

/**
 * Record provider request
 */
export function recordProviderRequest(providerId, success, responseTimeMs, errorMessage = null) {
  const today = new Date().toISOString().split('T')[0];
  const now = Date.now();

  // Check if record exists for today
  const existing = db.prepare(`
    SELECT * FROM provider_usage WHERE provider_id = ? AND date = ?
  `).get(providerId, today);

  if (existing) {
    const updates = ['request_count = request_count + 1'];
    const values = [];

    if (success) {
      updates.push('success_count = success_count + 1');
      updates.push('last_success_at = ?');
      values.push(now);
    } else {
      updates.push('error_count = error_count + 1');
      updates.push('last_error_at = ?');
      updates.push('last_error_message = ?');
      values.push(now, errorMessage);
    }

    // Update average response time
    const newAvg = Math.round(
      ((existing.average_response_time_ms || 0) * existing.request_count + responseTimeMs) /
      (existing.request_count + 1)
    );
    updates.push('average_response_time_ms = ?');
    updates.push('last_request_at = ?');
    values.push(newAvg, now, providerId, today);

    db.prepare(`UPDATE provider_usage SET ${updates.join(', ')} WHERE provider_id = ? AND date = ?`)
      .run(...values);
  } else {
    db.prepare(`
      INSERT INTO provider_usage 
      (provider_id, date, request_count, success_count, error_count, last_request_at, last_success_at, last_error_at, last_error_message, average_response_time_ms)
      VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      providerId,
      today,
      success ? 1 : 0,
      success ? 0 : 1,
      now,
      success ? now : null,
      success ? null : now,
      success ? null : errorMessage,
      responseTimeMs
    );
  }
}

/**
 * Fetch price from provider with fallback
 */
export async function fetchPriceWithFallback() {
  const providers = getActiveProviders();
  const errors = [];

  for (const provider of providers) {
    const startTime = Date.now();
    
    try {
      const result = await fetchFromProvider(provider);
      const responseTime = Date.now() - startTime;

      // Record successful request
      recordProviderRequest(provider.id, true, responseTime);

      // Log fallback if this wasn't the first provider
      if (errors.length > 0) {
        logFallback(errors[errors.length - 1].providerId, provider.id, errors[errors.length - 1].error);
      }

      return {
        success: true,
        provider: provider.id,
        providerName: provider.name,
        ...result
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      recordProviderRequest(provider.id, false, responseTime, error.message);
      errors.push({ providerId: provider.id, error: error.message });
    }
  }

  // All providers failed
  return {
    success: false,
    errors: errors.map(e => `${e.providerId}: ${e.error}`).join('; ')
  };
}

/**
 * Fetch from a specific provider
 */
async function fetchFromProvider(provider) {
  const headers = {
    'Accept': 'application/json',
    ...provider.headers
  };

  if (provider.authType === 'header' && provider.apiKey) {
    headers[provider.apiKeyHeader || 'Authorization'] = provider.apiKey;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), provider.timeoutMs || 5000);

  try {
    const response = await fetch(provider.endpoint, {
      method: provider.requestType || 'GET',
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Parse based on provider type
    switch (provider.id) {
      case 'gold-api-com':
        return {
          price: data.price,
          bid: data.price * 0.9995,
          ask: data.price * 1.0005,
          timestamp: new Date(data.updatedAt).getTime(),
          source: provider.name
        };

      case 'swissquote':
        const quote = data[0];
        const prices = quote.spreadProfilePrices.find(p => p.spreadProfile === 'premium') 
          || quote.spreadProfilePrices[0];
        return {
          price: (prices.bid + prices.ask) / 2,
          bid: prices.bid,
          ask: prices.ask,
          timestamp: quote.ts || Date.now(),
          source: provider.name
        };

      case 'yahoo-finance':
        const meta = data.chart.result[0].meta;
        const currentPrice = meta.regularMarketPrice || data.chart.result[0].indicators.quote[0].close.slice(-1)[0];
        return {
          price: currentPrice,
          bid: currentPrice * 0.9995,
          ask: currentPrice * 1.0005,
          timestamp: Date.now(),
          source: provider.name
        };

      case 'freegoldapi':
        const latest = data[data.length - 1];
        return {
          price: latest.price,
          bid: latest.price * 0.9995,
          ask: latest.price * 1.0005,
          timestamp: new Date(latest.date).getTime(),
          source: provider.name
        };

      default:
        // Generic parsing using response format paths
        return {
          price: extractValueFromPath(data, provider.responseFormat?.pricePath),
          bid: extractValueFromPath(data, provider.responseFormat?.bidPath) || extractValueFromPath(data, provider.responseFormat?.pricePath) * 0.9995,
          ask: extractValueFromPath(data, provider.responseFormat?.askPath) || extractValueFromPath(data, provider.responseFormat?.pricePath) * 1.0005,
          timestamp: Date.now(),
          source: provider.name
        };
    }

  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Log fallback event
 */
function logFallback(failedProviderId, fallbackProviderId, reason) {
  db.prepare(`
    INSERT INTO provider_fallback_log (timestamp, failed_provider_id, fallback_provider_id, reason)
    VALUES (?, ?, ?, ?)
  `).run(Date.now(), failedProviderId, fallbackProviderId, reason);
}

/**
 * Get fallback history
 */
export function getFallbackHistory(limit = 50) {
  return db.prepare(`
    SELECT 
      l.*,
      fp.name as failed_provider_name,
      bp.name as fallback_provider_name
    FROM provider_fallback_log l
    JOIN data_providers fp ON l.failed_provider_id = fp.id
    JOIN data_providers bp ON l.fallback_provider_id = bp.id
    ORDER BY l.timestamp DESC
    LIMIT ?
  `).all(limit);
}

/**
 * Get provider health status
 */
export function getProviderHealth(providerId) {
  const health = db.prepare(`
    SELECT * FROM provider_health WHERE provider_id = ?
  `).get(providerId);

  if (!health) {
    return {
      providerId,
      status: 'unknown',
      responseTimeMs: null,
      lastCheckAt: null,
      consecutiveFailures: 0
    };
  }

  return health;
}

/**
 * Update provider health
 */
export function updateProviderHealth(providerId, status, responseTimeMs) {
  const existing = db.prepare('SELECT * FROM provider_health WHERE provider_id = ?').get(providerId);

  if (existing) {
    const consecutiveFailures = status === 'down' 
      ? (existing.consecutive_failures || 0) + 1 
      : 0;

    db.prepare(`
      UPDATE provider_health 
      SET status = ?, response_time_ms = ?, last_check_at = ?, consecutive_failures = ?
      WHERE provider_id = ?
    `).run(status, responseTimeMs, Date.now(), consecutiveFailures, providerId);
  } else {
    db.prepare(`
      INSERT INTO provider_health (provider_id, status, response_time_ms, last_check_at, consecutive_failures)
      VALUES (?, ?, ?, ?, ?)
    `).run(providerId, status, responseTimeMs, Date.now(), status === 'down' ? 1 : 0);
  }
}

/**
 * Run health checks on all active providers
 */
export async function runHealthChecks() {
  const providers = getActiveProviders();
  const results = [];

  for (const provider of providers) {
    const startTime = Date.now();
    const testResult = await testProvider(provider);
    const responseTime = Date.now() - startTime;

    const status = testResult.success ? 'up' : 'down';
    updateProviderHealth(provider.id, status, responseTime);

    results.push({
      providerId: provider.id,
      providerName: provider.name,
      status,
      responseTime,
      ...testResult
    });
  }

  return results;
}

/**
 * Get dashboard data for admin
 */
export function getProviderDashboard() {
  const providers = getAllProviders();
  const healthChecks = db.prepare('SELECT * FROM provider_health').all();
  const today = new Date().toISOString().split('T')[0];

  const usage = db.prepare(`
    SELECT provider_id, 
           SUM(request_count) as total_requests,
           SUM(success_count) as total_success,
           SUM(error_count) as total_errors,
           AVG(average_response_time_ms) as avg_response_time
    FROM provider_usage
    WHERE date >= date('now', '-7 days')
    GROUP BY provider_id
  `).all();

  const recentFallbacks = db.prepare(`
    SELECT COUNT(*) as count FROM provider_fallback_log
    WHERE timestamp >= ?
  `).get(Date.now() - 24 * 60 * 60 * 1000).count;

  return {
    providers: providers.map(p => {
      const health = healthChecks.find(h => h.provider_id === p.id);
      const usageStats = usage.find(u => u.provider_id === p.id);

      return {
        ...p,
        health: health || { status: 'unknown', consecutive_failures: 0 },
        usage: usageStats || { total_requests: 0, total_success: 0, total_errors: 0 },
        successRate: usageStats 
          ? Math.round((usageStats.total_success / usageStats.total_requests) * 100) 
          : 0
      };
    }),
    summary: {
      totalProviders: providers.length,
      activeProviders: providers.filter(p => p.isActive).length,
      healthyProviders: healthChecks.filter(h => h.status === 'up').length,
      recentFallbacks24h: recentFallbacks
    }
  };
}
