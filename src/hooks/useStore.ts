import { create } from 'zustand';
import type { AppState, TradingSignal } from '../types/trading';
import { GoldPriceService } from '../services/GoldPriceService';
import { FibonacciService } from '../services/FibonacciService';
import { SignalService } from '../services/SignalService';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface StoreActions {
  fetchCurrentPrice: () => Promise<void>;
  fetchHistoricalData: (range?: string) => Promise<void>;
  calculateFibLevels: () => void;
  generateSignal: () => void;
  startRealTimeUpdates: () => () => void;
  setError: (error: string | null) => void;
  clearSignals: () => void;
  loadSignalsFromBackend: () => Promise<void>;
  saveSignalToBackend: (signal: TradingSignal) => Promise<void>;
}

type Store = AppState & StoreActions;

export const useStore = create<Store>((set, get) => ({
  // Initial state
  currentPrice: null,
  priceHistory: [],
  fibLevels: null,
  signals: [],
  isLoading: false,
  error: null,
  lastUpdate: null,

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

  fetchHistoricalData: async (range: string = '1y') => {
    set({ isLoading: true });
    try {
      const history = await GoldPriceService.getHistoricalData(50, range);
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
      const response = await fetch(`${API_BASE}/signals?limit=50`);
      if (response.ok) {
        const result = await response.json();
        set({ signals: result.data.reverse() }); // Reverse to get chronological order
      }
    } catch (error) {
      console.warn('Failed to load signals from backend:', error);
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

    // Update every 5 seconds
    const interval = setInterval(() => {
      get().fetchCurrentPrice();
    }, 5000);

    return () => clearInterval(interval);
  },

  setError: (error) => set({ error }),

  clearSignals: () => set({ signals: [] }),
}));
