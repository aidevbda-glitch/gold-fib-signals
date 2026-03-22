import { create } from 'zustand';
import type { AppState, TradingSignal } from '../types/trading';
import { GoldPriceService } from '../services/GoldPriceService';
import { FibonacciService } from '../services/FibonacciService';
import { SignalService } from '../services/SignalService';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface StoreActions {
  fetchCurrentPrice: () => Promise<void>;
  fetchHistoricalData: (range?: string) => Promise<void>;
  fetchIntradayData: () => Promise<void>;
  calculateFibLevels: () => void;
  generateSignal: () => Promise<void>;
  startRealTimeUpdates: () => () => void;
  setError: (error: string | null) => void;
  clearSignals: () => void;
  loadSignalsFromBackend: () => Promise<void>;
  saveSignalToBackend: (signal: TradingSignal) => Promise<void>;
  setSelectedRange: (range: string) => void;
  setActiveProviderId: (providerId: string | null) => void;
}

type Store = AppState & StoreActions;

// Module-level interval tracking to prevent double-start
let activeIntervals: { price?: ReturnType<typeof setInterval>; intraday?: ReturnType<typeof setInterval> } = {};

export const useStore = create<Store>((set, get) => ({
  // Initial state
  currentPrice: null,
  priceHistory: [],
  intradayData: [],
  fibLevels: null,
  signals: [],
  isLoading: false,
  error: null,
  lastUpdate: null,
  selectedRange: '1mo',
  activeProviderId: null as string | null,
  intervalsActive: false,

  // Actions
  fetchCurrentPrice: async () => {
    try {
      const quote = await GoldPriceService.simulateTick();
      
      // CRITICAL: Use the actual timestamp from the price source (Swissquote)
      // NOT Date.now() - this was causing timestamp gaps and confusion
      const priceTimestamp = quote.timestamp || Date.now();
      
      set({ 
        currentPrice: quote, 
        lastUpdate: priceTimestamp,
        error: null 
      });
      
      const state = get();
      if (state.priceHistory.length > 0) {
        get().calculateFibLevels();
        get().generateSignal();
      }
    } catch (error) {
      set({ error: `Failed to fetch price: ${error}` });
    }
  },

  fetchHistoricalData: async (range?: string) => {
    const selectedRange = range || get().selectedRange;
    set({ isLoading: true, selectedRange });
    try {
      const history = await GoldPriceService.getHistoricalData(200, selectedRange);
      set({ 
        priceHistory: history, 
        isLoading: false,
        error: null 
      });
      
      get().calculateFibLevels();
    } catch (error) {
      set({ 
        error: `Failed to fetch historical data: ${error}`,
        isLoading: false 
      });
    }
  },

  fetchIntradayData: async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { activeProviderId } = get();
      
      // Build query params, including providerId if set
      let url = `${API_BASE}/price/intraday?start=${today}&end=${today}`;
      if (activeProviderId) {
        url += `&providerId=${encodeURIComponent(activeProviderId)}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        set({ intradayData: result.data || [] });
      }
    } catch (error) {
      console.warn('Failed to fetch intraday data:', error);
    }
  },

  setActiveProviderId: (providerId: string | null) => {
    set({ activeProviderId: providerId });
    // Refetch intraday data with new provider filter
    get().fetchIntradayData();
  },

  setSelectedRange: (range: string) => {
    set({ selectedRange: range });
    get().fetchHistoricalData(range);
  },

  calculateFibLevels: () => {
    const { priceHistory } = get();
    
    if (priceHistory.length < 20) {
      return;
    }

    try {
      const swingPoints = FibonacciService.findSwingPoints(priceHistory, 20);
      const direction = FibonacciService.determineTrendDirection(
        swingPoints.highIndex,
        swingPoints.lowIndex
      );
      
      const fibLevels = FibonacciService.calculateLevels(
        swingPoints.high,
        swingPoints.low,
        direction
      );

      set({ fibLevels });
    } catch (error) {
      console.error('Error calculating Fib levels:', error);
    }
  },

  generateSignal: async () => {
    const { currentPrice, fibLevels, priceHistory, signals } = get();
    
    if (!currentPrice || !fibLevels || priceHistory.length < 10) {
      return;
    }

    const lastSignal = signals.length > 0 ? signals[signals.length - 1] : null;
    
    if (!SignalService.shouldGenerateSignal(lastSignal, currentPrice.price)) {
      return;
    }

    const signal = await SignalService.generateSignal(
      currentPrice,
      fibLevels,
      priceHistory,
      true // include macro context
    );

    if (signal) {
      const newSignals = [...signals, signal].slice(-50);
      set({ signals: newSignals });
      
      // Persist to backend
      get().saveSignalToBackend(signal);
    }
  },

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

  loadSignalsFromBackend: async () => {
    try {
      // Fetch signals from the last 3 days
      const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
      const response = await fetch(`${API_BASE}/signals/range?start=${threeDaysAgo}&end=${Date.now()}`);
      if (response.ok) {
        const result = await response.json();
        const signals = result.data.reverse(); // Reverse to get chronological order
        set({ signals });
        
        // Log the most recent signal for user awareness
        if (signals.length > 0) {
          const latest = signals[signals.length - 1];
          console.log(`📊 Last signal (${latest.type}): $${latest.price.toFixed(2)} at ${new Date(latest.timestamp).toLocaleString()}`);
        }
      }
    } catch (error) {
      console.warn('Failed to load signals from backend:', error);
      // Fallback to simple query
      try {
        const fallback = await fetch(`${API_BASE}/signals?limit=50`);
        if (fallback.ok) {
          const result = await fallback.json();
          set({ signals: result.data.reverse() });
        }
      } catch {
        // Ignore fallback errors
      }
    }
  },

  startRealTimeUpdates: () => {
    const state = get();

    // Prevent double-start if intervals are already active
    if (state.intervalsActive || activeIntervals.price || activeIntervals.intraday) {
      console.log('⚠️ Real-time updates already running, skipping start');
      return () => {}; // Return no-op cleanup
    }

    // Mark intervals as active
    set({ intervalsActive: true });

    // Check backend availability
    GoldPriceService.checkBackend().then((available) => {
      if (available) {
        console.log('✅ Backend API connected');
        get().loadSignalsFromBackend();
      } else {
        console.log('⚠️ Backend unavailable, using mock data');
      }
    });

    // Fetch initial data
    get().fetchHistoricalData();
    get().fetchCurrentPrice();
    get().fetchIntradayData();

    // Update price every 5 seconds
    activeIntervals.price = setInterval(() => {
      get().fetchCurrentPrice();
    }, 5000);

    // Update intraday data every 30 seconds
    activeIntervals.intraday = setInterval(() => {
      get().fetchIntradayData();
    }, 30000);

    // Return cleanup function
    return () => {
      if (activeIntervals.price) {
        clearInterval(activeIntervals.price);
        activeIntervals.price = undefined;
      }
      if (activeIntervals.intraday) {
        clearInterval(activeIntervals.intraday);
        activeIntervals.intraday = undefined;
      }
      set({ intervalsActive: false });
      console.log('✅ Real-time updates stopped');
    };
  },

  setError: (error) => set({ error }),

  clearSignals: () => set({ signals: [] }),
}));
