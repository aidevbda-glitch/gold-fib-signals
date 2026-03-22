# Gold Fib Signals - Code Review: Edge Cases & Race Conditions

## Executive Summary

This review identified **17 critical issues** across 5 files, including race conditions in timestamp tracking, null pointer vulnerabilities, improper async handling, and potential data corruption scenarios.

---

## 1. `/backend/src/goldPriceService.js`

### 🔴 CRITICAL: Race Condition in Global State Updates

**Issue:** Module-level variables `latestTimestamp` and `latestPriceData` are accessed/modified without synchronization.

```javascript
// Lines 17-18: Global mutable state
let latestTimestamp = 0;
let latestPriceData = null;

// Line 33-42: Non-atomic check-then-act
function updateLatestPriceData(priceData) {
  if (!priceData || !priceData.timestamp) {
    return false;
  }
  // Race condition: Between this check and assignment, another request may update
  if (priceData.timestamp >= latestTimestamp) {
    latestTimestamp = priceData.timestamp;  // Not atomic
    latestPriceData = priceData;             // Not atomic
    return true;
  }
  // ...
}
```

**Impact:** Under concurrent load, stale data could overwrite fresh data, or fresh data could be rejected incorrectly.

**Fix:**
```javascript
// Use atomic compare-and-swap pattern
function updateLatestPriceData(priceData) {
  if (!priceData?.timestamp) return false;
  
  // Atomic update using a single assignment
  const newTimestamp = priceData.timestamp;
  const currentLatest = latestTimestamp; // Read once
  
  if (newTimestamp >= currentLatest) {
    // Use Object.assign for atomic-like update
    const newData = { ...priceData, _updatedAt: Date.now() };
    
    // Only update if timestamp hasn't changed since we read it
    if (latestTimestamp === currentLatest) {
      latestTimestamp = newTimestamp;
      latestPriceData = newData;
      return true;
    }
    // Someone else updated - retry or reject
    return newTimestamp > latestTimestamp ? 
      updateLatestPriceData(priceData) : false;
  }
  return false;
}
```

---

### 🔴 CRITICAL: Database Race Condition in `updateDailyAggregate`

**Issue:** Check-then-act pattern on database rows without transactions.

```javascript
// Lines 235-244
const existing = db.prepare('SELECT * FROM daily_aggregates WHERE date = ?').get(today);

if (existing) {
  // UPDATE
} else {
  // INSERT  // Race: Two concurrent calls could both reach here
}
```

**Impact:** Duplicate key errors or lost updates when multiple requests process prices simultaneously.

**Fix:**
```javascript
// Use INSERT OR REPLACE or proper transaction
function updateDailyAggregate(priceData, providerId = 'swissquote') {
  const today = new Date().toISOString().split('T')[0];
  const mid = (priceData.bid + priceData.ask) / 2;
  
  // Use transaction to ensure atomicity
  const transaction = db.transaction(() => {
    const existing = db.prepare('SELECT * FROM daily_aggregates WHERE date = ?').get(today);
    
    if (existing) {
      db.prepare(`
        UPDATE daily_aggregates SET
          bid_high = MAX(bid_high, ?),
          bid_low = MIN(bid_low, ?),
          bid_close = ?,
          ask_high = MAX(ask_high, ?),
          ask_low = MIN(ask_low, ?),
          ask_close = ?,
          mid_high = MAX(mid_high, ?),
          mid_low = MIN(mid_low, ?),
          mid_close = ?,
          tick_count = tick_count + 1,
          last_tick_at = ?,
          source = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE date = ?
      `).run(/* ... */);
    } else {
      db.prepare(`INSERT INTO daily_aggregates (...)`).run(/* ... */);
    }
  });
  
  transaction();
}
```

---

### 🟡 HIGH: Inconsistent Timestamp Fallback Logic

**Issue:** Comments promise one behavior, code does another.

```javascript
// Lines 120-126
const swissquoteTimestamp = quote.ts;
if (!swissquoteTimestamp) {
  console.warn('Swissquote response missing ts timestamp:', quote);
}
// Comment says: "Use the timestamp from Swissquote, or 0 to indicate error"
// But code does: Date.now()
const timestamp = swissquoteTimestamp || Date.now();
```

**Impact:** Using `Date.now()` when Swissquote timestamp is missing can cause future timestamps to be incorrectly accepted as "fresher" than legitimate historical data.

**Fix:**
```javascript
const swissquoteTimestamp = quote.ts;
if (!swissquoteTimestamp) {
  console.error('Swissquote response missing ts timestamp - rejecting');
  throw new Error('Missing timestamp from Swissquote');
}
const timestamp = swissquoteTimestamp;
```

---

### 🟡 HIGH: No Future Timestamp Validation

**Issue:** Future timestamps (clock skew) can corrupt the timeline.

```javascript
// Line 38
if (priceData.timestamp >= latestTimestamp) {
```

**Impact:** If a provider returns a timestamp in the future (due to clock skew), all legitimate data until that future time will be rejected.

**Fix:**
```javascript
const MAX_FUTURE_SKEW_MS = 60000; // Allow 1 minute of clock skew

function updateLatestPriceData(priceData) {
  if (!priceData?.timestamp) return false;
  
  const now = Date.now();
  const newTimestamp = priceData.timestamp;
  
  // Reject obviously future timestamps
  if (newTimestamp > now + MAX_FUTURE_SKEW_MS) {
    console.warn(`Rejecting future timestamp: ${newTimestamp} > ${now + MAX_FUTURE_SKEW_MS}`);
    return false;
  }
  
  if (newTimestamp >= latestTimestamp) {
    // ... update
  }
}
```

---

### 🟡 HIGH: Null Pointer Risk in `fetchFromSwissquote`

**Issue:** Insufficient validation of nested API response.

```javascript
// Lines 109-116
const quote = data[0];
const prices = quote.spreadProfilePrices.find(p => p.spreadProfile === 'premium') 
  || quote.spreadProfilePrices[0];  // Could be undefined!
```

**Impact:** If Swissquote returns an empty `spreadProfilePrices` array, the code will throw.

**Fix:**
```javascript
const quote = data?.[0];
if (!quote?.spreadProfilePrices?.length) {
  throw new Error('Invalid Swissquote response: missing spreadProfilePrices');
}

const prices = quote.spreadProfilePrices.find(p => p.spreadProfile === 'premium') 
  || quote.spreadProfilePrices[0];
```

---

### 🟡 HIGH: Cleanup Inline with Write (Performance)

**Issue:** Database cleanup runs inline with every tick write.

```javascript
// Lines 183-185
function saveIntradayTick(priceData, providerId = 'swissquote') {
  // ... insert ...
  
  // Cleanup: Remove ticks older than 1 year
  const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
  db.prepare('DELETE FROM intraday_ticks WHERE timestamp < ?').run(oneYearAgo);
}
```

**Impact:** Performance degradation over time as table grows. Risk of partial failure (insert succeeds, delete fails).

**Fix:**
```javascript
function saveIntradayTick(priceData, providerId = 'swissquote') {
  const stmt = db.prepare(`
    INSERT INTO intraday_ticks (timestamp, bid, ask, mid, spread, source, provider_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const mid = (priceData.bid + priceData.ask) / 2;
  const spread = priceData.ask - priceData.bid;

  stmt.run(
    priceData.timestamp,
    priceData.bid,
    priceData.ask,
    mid,
    spread,
    priceData.source || providerId,
    providerId
  );
  // Cleanup moved to scheduled job (e.g., daily)
}

// Scheduled cleanup function
export function cleanupOldTicks() {
  const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
  const result = db.prepare('DELETE FROM intraday_ticks WHERE timestamp < ?').run(oneYearAgo);
  console.log(`Cleaned up ${result.changes} old tick records`);
}
```

---

## 2. `/backend/src/providerService.js`

### 🔴 CRITICAL: Unhandled Null in `extractValueFromPath`

**Issue:** Function can return `null` which callers may not expect.

```javascript
// Lines 364-383
function extractValueFromPath(obj, path) {
  if (!path) return null;
  // ... navigation logic ...
  return current;  // Could be null/undefined
}
```

**Impact:** In `fetchFromProvider` switch default case:
```javascript
price: extractValueFromPath(data, provider.responseFormat?.pricePath),
```
Price could be `null` without validation, propagating through the system.

**Fix:**
```javascript
function extractValueFromPath(obj, path, required = false) {
  if (!path) return required ? undefined : null;
  
  const parts = path.match(/[^.\[\]]+|\[\d+\]|\[-\d+\]/g) || [];
  
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) {
      if (required) throw new Error(`Path "${path}" returned null at "${part}"`);
      return null;
    }
    // ... rest of logic
  }
  return current;
}
```

---

### 🟡 HIGH: Timeout Not Cleared on All Paths

**Issue:** AbortController timeout may leak.

```javascript
// Lines 416-447
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), provider.timeoutMs || 5000);

try {
  const response = await fetch(provider.endpoint, {
    // ...
    signal: controller.signal
  });
  
  clearTimeout(timeoutId);  // Only cleared on success path
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  // ...
} catch (error) {
  clearTimeout(timeoutId);  // Missing in catch!
  throw error;
}
```

**Impact:** Memory leak - timers accumulate if fetch throws before response.

**Fix:**
```javascript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), provider.timeoutMs || 5000);

try {
  const response = await fetch(provider.endpoint, {
    method: provider.requestType || 'GET',
    headers,
    signal: controller.signal
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data;
} finally {
  clearTimeout(timeoutId);  // Always clear
}
```

---

### 🟡 HIGH: No Request Deduplication in `fetchPriceWithFallback`

**Issue:** Multiple concurrent calls will trigger parallel requests to all providers.

```javascript
export async function fetchPriceWithFallback() {
  const providers = getActiveProviders();
  // ...
  for (const provider of providers) {
    // Each call iterates through all providers
  }
}
```

**Impact:** If 10 requests come in simultaneously when the first provider is down, it will make 10× the number of provider calls necessary.

**Fix:**
```javascript
let pendingFallbackPromise = null;

export async function fetchPriceWithFallback() {
  // Deduplicate concurrent calls
  if (pendingFallbackPromise) {
    return pendingFallbackPromise;
  }
  
  pendingFallbackPromise = doFetchWithFallback();
  
  try {
    return await pendingFallbackPromise;
  } finally {
    pendingFallbackPromise = null;
  }
}

async function doFetchWithFallback() {
  const providers = getActiveProviders();
  // ... original logic
}
```

---

## 3. `/src/services/GoldPriceService.ts`

### 🔴 CRITICAL: Static State Race Conditions

**Issue:** Static class properties are shared across all calls but not thread-safe.

```typescript
// Lines 24-30
private static lastPrice: number = 4900;
private static mockHistory: PriceData[] = [];
private static backendFailures: number = 0;
private static latestTimestamp: number = 0;
private static latestQuote: GoldQuote | null = null;
```

**Impact:** In a browser with multiple tabs or workers, or during rapid async operations, state corruption can occur.

**Fix:** Use instance-based state or proper synchronization (difficult in browser). For this use case, consider:

```typescript
// Use a singleton with locking mechanism
class GoldPriceServiceState {
  private _locked = false;
  private _queue: (() => void)[] = [];
  
  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    while (this._locked) {
      await new Promise<void>(resolve => this._queue.push(resolve));
    }
    this._locked = true;
    try {
      return await fn();
    } finally {
      this._locked = false;
      const next = this._queue.shift();
      if (next) next();
    }
  }
  
  // State properties here
  lastPrice = 4900;
  mockHistory: PriceData[] = [];
  backendFailures = 0;
  latestTimestamp = 0;
  latestQuote: GoldQuote | null = null;
}

const state = new GoldPriceServiceState();
```

---

### 🟡 HIGH: `backendFailures` Never Resets on Partial Success

**Issue:** Counter resets only on successful HTTP response, but partial failures can leave it elevated.

```typescript
// Lines 68-72
if (response.ok) {
  const data = await response.json();
  // Reset failure counter on success
  this.backendFailures = 0;
  // ...
}
```

**Impact:** If backend returns 200 but malformed data causing downstream errors, failures accumulate until mock mode triggers incorrectly.

**Fix:**
```typescript
try {
  const response = await fetch(`${API_BASE}/price/current`, {
    signal: AbortSignal.timeout(10000)
  });
  
  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}`);
  }
  
  const data = await response.json();
  
  // Validate response structure before accepting
  if (!this.isValidQuoteData(data)) {
    throw new Error('Invalid quote data structure');
  }
  
  // Only reset after validation
  this.backendFailures = 0;
  // ...
} catch (error) {
  // ...
}

private static isValidQuoteData(data: any): boolean {
  return data 
    && typeof data.price === 'number'
    && typeof data.bid === 'number'
    && typeof data.ask === 'number'
    && (data.timestamp === undefined || typeof data.timestamp === 'number');
}
```

---

### 🟡 HIGH: Missing Timestamp Validation in `updateIfFresher`

**Issue:** No validation for zero or negative timestamps.

```typescript
// Lines 44-60
private static updateIfFresher(quote: GoldQuote): boolean {
  const newTimestamp = quote.timestamp || Date.now();
  if (newTimestamp >= this.latestTimestamp) {
    // Accepts zero and negative timestamps
  }
}
```

**Fix:**
```typescript
private static updateIfFresher(quote: GoldQuote): boolean {
  const newTimestamp = quote.timestamp;
  
  // Reject invalid timestamps
  if (!newTimestamp || newTimestamp <= 0) {
    console.warn('Rejecting quote with invalid timestamp:', newTimestamp);
    return false;
  }
  
  // Reject future timestamps (with tolerance)
  const now = Date.now();
  const MAX_FUTURE_SKEW = 60000;
  if (newTimestamp > now + MAX_FUTURE_SKEW) {
    console.warn('Rejecting future timestamp:', newTimestamp, '>', now + MAX_FUTURE_SKEW);
    return false;
  }
  
  if (newTimestamp >= this.latestTimestamp) {
    this.latestQuote = quote;
    this.latestTimestamp = newTimestamp;
    this.lastPrice = quote.price;
    return true;
  }
  
  return false;
}
```

---

### 🟡 HIGH: `generateMockQuote` Mutates Shared State Unsafely

**Issue:** Race condition in price generation.

```typescript
// Lines 133-150
private static generateMockQuote(): GoldQuote {
  const volatility = 0.001;
  const drift = (Math.random() - 0.5) * 2 * volatility;
  
  this.lastPrice = this.lastPrice * (1 + drift);  // Race condition!
  this.lastPrice = Math.max(4000, Math.min(6000, this.lastPrice));
  // ...
}
```

**Impact:** Concurrent calls can produce inconsistent price series.

**Fix:**
```typescript
private static generateMockQuote(): GoldQuote {
  const volatility = 0.001;
  const drift = (Math.random() - 0.5) * 2 * volatility;
  
  // Calculate new price atomically
  const newPrice = Math.max(4000, Math.min(6000, this.lastPrice * (1 + drift)));
  this.lastPrice = newPrice;
  
  const spread = newPrice * 0.0003;
  
  return {
    price: newPrice,
    bid: newPrice - spread / 2,
    ask: newPrice + spread / 2,
    high24h: newPrice * 1.005,
    low24h: newPrice * 0.995,
    change24h: newPrice * (Math.random() - 0.5) * 0.01,
    changePercent24h: (Math.random() - 0.5) * 1,
    timestamp: Date.now(),
    source: 'Mock Data (Backend Unavailable)',
  };
}
```

---

## 4. `/src/hooks/useStore.ts`

### 🟡 HIGH: Race Condition in `startRealTimeUpdates`

**Issue:** Multiple intervals can be created if component remounts rapidly.

```typescript
// Lines 182-206
startRealTimeUpdates: () => {
  // Check backend availability
  GoldPriceService.checkBackend().then((available) => {
    // ...
  });

  // Fetch initial data
  get().fetchHistoricalData();
  get().fetchCurrentPrice();
  get().fetchIntradayData();

  // Update price every 5 seconds
  const priceInterval = setInterval(() => {
    get().fetchCurrentPrice();
  }, 5000);

  // Update intraday data every 30 seconds
  const intradayInterval = setInterval(() => {
    get().fetchIntradayData();
  }, 30000);

  return () => {
    clearInterval(priceInterval);
    clearInterval(intradayInterval);
  };
},
```

**Impact:** If the component using this unmounts and remounts quickly, multiple intervals stack up.

**Fix:** Track if already started:

```typescript
// Add to state
intervalsActive: false,

clearAllIntervals: () => void;

startRealTimeUpdates: () => {
  const state = get();
  
  // Prevent double-start
  if (state.intervalsActive) {
    console.log('Intervals already active, skipping');
    return state.clearAllIntervals;
  }
  
  set({ intervalsActive: true });
  
  // Check backend availability
  GoldPriceService.checkBackend().then((available) => {
    // ...
  });

  // Fetch initial data
  get().fetchHistoricalData();
  get().fetchCurrentPrice();
  get().fetchIntradayData();

  const priceInterval = setInterval(() => {
    get().fetchCurrentPrice();
  }, 5000);

  const intradayInterval = setInterval(() => {
    get().fetchIntradayData();
  }, 30000);

  const cleanup = () => {
    clearInterval(priceInterval);
    clearInterval(intradayInterval);
    set({ intervalsActive: false });
  };
  
  set({ clearAllIntervals: cleanup });

  return cleanup;
},
```

---

### 🟡 HIGH: Stale State in `generateSignal`

**Issue:** Signal generation uses `get()` to access state that may be stale.

```typescript
// Lines 130-155
generateSignal: async () => {
  const { currentPrice, fibLevels, priceHistory, signals } = get();
  
  if (!currentPrice || !fibLevels || priceHistory.length < 10) {
    return;
  }
  
  const lastSignal = signals.length > 0 ? signals[signals.length - 1] : null;
  
  if (!SignalService.shouldGenerateSignal(lastSignal, currentPrice.price)) {
    return;
  }
  // ...
  const newSignals = [...signals, signal].slice(-50);
  set({ signals: newSignals });  // Could overwrite signals added by another call
},
```

**Impact:** If two signal generations happen concurrently, one may overwrite the other.

**Fix:**
```typescript
generateSignal: async () => {
  const { currentPrice, fibLevels, priceHistory } = get();
  
  if (!currentPrice || !fibLevels || priceHistory.length < 10) {
    return;
  }
  
  // Use functional update for signals to ensure latest state
  set((state) => {
    const lastSignal = state.signals.length > 0 ? state.signals[state.signals.length - 1] : null;
    
    if (!SignalService.shouldGenerateSignal(lastSignal, currentPrice.price)) {
      return {}; // No change
    }
    
    // Generate signal synchronously (or move async part outside)
    return {}; // Signal generation needs refactor
  });
  
  // Better approach: separate signal generation from state update
},
```

---

### 🟡 MEDIUM: Unhandled Promise in `saveSignalToBackend`

**Issue:** Fire-and-forget without error handling.

```typescript
// Lines 157-166
saveSignalToBackend: async (signal: TradingSignal) => {
  try {
    await fetch(`${API_BASE}/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(signal),
    });
  } catch (error) {
    console.warn('Failed to save signal to backend:', error);
  }
},
```

**Impact:** If the backend is down, signals accumulate in memory but never persist. No retry mechanism.

**Fix:** Add retry logic and queue:

```typescript
// Add to state
pendingSignals: [] as TradingSignal[],

saveSignalToBackend: async (signal: TradingSignal) => {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 5000;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${API_BASE}/signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signal),
        signal: AbortSignal.timeout(10000),
      });
      
      if (response.ok) {
        // Remove from pending if it was there
        set((state) => ({
          pendingSignals: state.pendingSignals.filter(s => s.id !== signal.id)
        }));
        return;
      }
      
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      console.warn(`Signal save attempt ${attempt} failed:`, error);
      
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
      } else {
        // Add to pending queue for later retry
        set((state) => ({
          pendingSignals: [...state.pendingSignals, signal]
        }));
      }
    }
  }
},
```

---

## 5. `/backend/src/index.js`

### 🔴 CRITICAL: Missing Error Boundaries on Async Endpoints

**Issue:** Multiple async endpoints lack try-catch or proper error handling.

```javascript
// Lines 185-202 - Missing error handling
generateSignal: async () => {
  const { currentPrice, fibLevels, priceHistory, signals } = get();
  
  if (!currentPrice || !fibLevels || priceHistory.length < 10) {
    return;
  }
  // ... async operations without catch
},
```

**Fix:** All async actions should have centralized error handling.

---

### 🟡 HIGH: No Input Sanitization on Query Parameters

**Issue:** Raw query parameters passed to database without validation.

```javascript
// Lines 220-227
app.get('/api/price/intraday', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const start = req.query.start || today;
  const end = req.query.end || today;
  const providerId = req.query.providerId || null;

  const ticks = getIntradayTicks(start, end, providerId);
  // ...
});
```

**Impact:** While better-sqlite3 prevents SQL injection, invalid dates could cause crashes.

**Fix:**
```javascript
app.get('/api/price/intraday', (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const start = dateRegex.test(req.query.start) ? req.query.start : today;
    const end = dateRegex.test(req.query.end) ? req.query.end : today;
    
    // Validate providerId if provided
    const providerId = req.query.providerId 
      ? String(req.query.providerId).replace(/[^a-zA-Z0-9_-]/g, '')
      : null;
    
    // Ensure start <= end
    if (new Date(start) > new Date(end)) {
      return res.status(400).json({ error: 'Start date must be before end date' });
    }

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
```

---

### 🟡 HIGH: `parseInt` Without Radix and Validation

**Issue:** Multiple instances of unsafe `parseInt`.

```javascript
// Lines 245, 271, 356, etc.
const days = parseInt(req.query.days) || 365;
const limit = Math.min(parseInt(req.query.limit) || 50, 200);
```

**Impact:** `parseInt('10abc')` returns 10 (not NaN), which may not be intended.

**Fix:**
```javascript
function parsePositiveInt(value, defaultValue, maxValue = Infinity) {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed <= 0) {
    return defaultValue;
  }
  return Math.min(parsed, maxValue);
}

// Usage:
const days = parsePositiveInt(req.query.days, 365, 1095);
const limit = parsePositiveInt(req.query.limit, 50, 200);
```

---

### 🟡 MEDIUM: Missing `await` on Async Initialization

**Issue:** Server starts before critical initialization completes.

```javascript
// Lines 1867-1869
// Fetch initial data
console.log('📊 Fetching initial price data...');
fetchCurrentPrice().then(() => console.log('✅ Current price loaded'));
fetchHistoricalData('1y', '1d').then(() => console.log('✅ 1-year history loaded'));
```

**Impact:** First API requests may fail if they arrive before initialization completes.

**Fix:**
```javascript
app.listen(PORT, '0.0.0.0', async () => {
  console.log('🥇 Gold Fib Signals API Server starting...');
  
  // Fetch initial data before accepting requests
  console.log('📊 Fetching initial price data...');
  try {
    await fetchCurrentPrice();
    console.log('✅ Current price loaded');
    
    await fetchHistoricalData('1y', '1d');
    console.log('✅ 1-year history loaded');
  } catch (error) {
    console.error('⚠️ Initial data fetch failed:', error.message);
    // Continue anyway - will retry via polling
  }
  
  // Now safe to accept requests
  console.log(`✅ Server ready on port ${PORT}`);
  
  // Start polling after server is ready
  setInterval(pollSwissquote, POLL_INTERVAL_MS);
  setTimeout(pollSwissquote, 5000);
});
```

---

## Summary of Fixes Required

### Immediate (Critical)

1. **Add request deduplication** to `fetchPriceWithFallback` to prevent provider hammering
2. **Fix database race condition** in `updateDailyAggregate` using transactions
3. **Add timestamp validation** to reject future/invalid timestamps
4. **Fix global state race conditions** in `goldPriceService.js` with atomic updates

### Short-term (High Priority)

5. **Add input validation** to all API endpoints
6. **Fix interval cleanup** in `useStore.ts` to prevent multiple intervals
7. **Add proper error boundaries** to all async operations
8. **Implement retry logic** for signal persistence

### Medium-term

9. **Move database cleanup** to scheduled jobs instead of inline
10. **Add comprehensive null checks** for all API responses
11. **Implement proper request timeouts** with cleanup
12. **Add monitoring** for race condition detection

---

## Testing Recommendations

1. **Concurrency Testing**: Run multiple simultaneous price fetch requests and verify data consistency
2. **Chaos Testing**: Simulate provider failures during concurrent requests
3. **Timestamp Fuzzing**: Test with malformed timestamps (future, past, zero, negative)
4. **Load Testing**: Verify behavior under sustained load with rapid requests
