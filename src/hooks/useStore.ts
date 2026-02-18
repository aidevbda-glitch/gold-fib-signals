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
  generateSignal: () => void;
  startRealTimeUpdates: () => () => void;
  setError: (error: string | null) => void;
  clearSignals: () => void;
  loadSignalsFromBackend: () => Promise<void>;
  saveSignalToBackend: (signal: TradingSignal) => Promise<void>;
  setSelectedRange: (range: string) => void;
}

type Store = AppState & StoreActions;

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

  // Actions
  fetchCurrentPrice: async () => {
    try {
      const quote = await GoldPriceService.simulateTick();
      set({ 
        currentPrice: quote, 
        lastUpdate: Date.now(),
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
      const response = await fetch(`${API_BASE}/price/intraday?start=${today}&end=${today}`);
      if (response.ok) {
        const result = await response.json();
        set({ intradayData: result.data || [] });
      }
    } catch (error) {
      console.warn('Failed to fetch intraday data:', error);
    }
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

  generateSignal: () => {
    const { currentPrice, fibLevels, priceHistory, signals } = get();
    
    if (!currentPrice || !fibLevels || priceHistory.length < 10) {
      return;
    }

    const lastSignal = signals.length > 0 ? signals[signals.length - 1] : null;
    
    if (!SignalService.shouldGenerateSignal(lastSignal, currentPrice.price)) {
      return;
    }

    const signal = SignalService.generateSignal(
      currentPrice,
      fibLevels,
      priceHistory
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

  setError: (error) => set({ error }),

  clearSignals: () => set({ signals: [] }),
}));
