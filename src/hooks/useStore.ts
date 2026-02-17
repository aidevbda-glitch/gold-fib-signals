import { create } from 'zustand';
import type { AppState } from '../types/trading';
import { GoldPriceService } from '../services/GoldPriceService';
import { FibonacciService } from '../services/FibonacciService';
import { SignalService } from '../services/SignalService';

interface StoreActions {
  fetchCurrentPrice: () => Promise<void>;
  fetchHistoricalData: () => Promise<void>;
  calculateFibLevels: () => void;
  generateSignal: () => void;
  startRealTimeUpdates: () => () => void;
  setError: (error: string | null) => void;
  clearSignals: () => void;
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
      
      // Auto-calculate Fib levels and check for signals
      const state = get();
      if (state.priceHistory.length > 0) {
        get().calculateFibLevels();
        get().generateSignal();
      }
    } catch (error) {
      set({ error: `Failed to fetch price: ${error}` });
    }
  },

  fetchHistoricalData: async () => {
    set({ isLoading: true });
    try {
      const history = await GoldPriceService.getHistoricalData(50);
      set({ 
        priceHistory: history, 
        isLoading: false,
        error: null 
      });
      
      // Calculate initial Fib levels
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
    
    // Check if we should generate a new signal
    if (!SignalService.shouldGenerateSignal(lastSignal, currentPrice.price)) {
      return;
    }

    const signal = SignalService.generateSignal(
      currentPrice,
      fibLevels,
      priceHistory
    );

    if (signal) {
      set({ signals: [...signals, signal].slice(-50) }); // Keep last 50 signals
    }
  },

  startRealTimeUpdates: () => {
    // Fetch initial data
    get().fetchHistoricalData();
    get().fetchCurrentPrice();

    // Update every 5 seconds
    const interval = setInterval(() => {
      get().fetchCurrentPrice();
    }, 5000);

    // Return cleanup function
    return () => clearInterval(interval);
  },

  setError: (error) => set({ error }),

  clearSignals: () => set({ signals: [] }),
}));
