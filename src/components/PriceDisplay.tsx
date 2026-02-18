import { useState } from 'react';
import { useStore } from '../hooks/useStore';
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function PriceDisplay() {
  const { currentPrice, lastUpdate, isLoading, fetchCurrentPrice } = useStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Call manual refresh endpoint
      const response = await fetch(`${API_BASE}/price/refresh`, {
        method: 'POST',
      });
      
      if (response.ok) {
        // Also update the store
        await fetchCurrentPrice();
      }
    } catch (error) {
      console.error('Manual refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!currentPrice) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-32 mb-2"></div>
        <div className="h-12 bg-gray-700 rounded w-48"></div>
      </div>
    );
  }

  const isPositive = currentPrice.changePercent24h > 0;
  const isNegative = currentPrice.changePercent24h < 0;

  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  const trendColor = isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-gray-400';
  const spread = currentPrice.ask - currentPrice.bid;

  return (
    <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-700/20 border border-yellow-600/30 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🥇</span>
          <h2 className="text-xl font-bold text-yellow-400">Gold Spot (XAU/USD)</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
            title="Manual refresh from Swissquote"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <span className="text-sm text-gray-400">{currentPrice.source}</span>
        </div>
      </div>

      <div className="flex items-end gap-4 mb-4">
        <span className="text-5xl font-bold text-white">
          ${currentPrice.price.toFixed(2)}
        </span>
        <div className="flex flex-col">
          <div className={`flex items-center gap-1 ${trendColor} text-lg`}>
            <TrendIcon className="w-5 h-5" />
            <span>{isPositive ? '+' : ''}{currentPrice.changePercent24h.toFixed(2)}%</span>
          </div>
          <span className="text-xs text-gray-500">24h Change</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
        <div>
          <span className="text-gray-400">Bid (Buy at)</span>
          <p className="text-green-400 font-medium">${currentPrice.bid.toFixed(2)}</p>
        </div>
        <div>
          <span className="text-gray-400">Ask (Sell at)</span>
          <p className="text-red-400 font-medium">${currentPrice.ask.toFixed(2)}</p>
        </div>
        <div>
          <span className="text-gray-400">Spread</span>
          <p className="text-white font-medium">${spread.toFixed(2)}</p>
        </div>
        <div>
          <span className="text-gray-400">24h High</span>
          <p className="text-green-400 font-medium">${currentPrice.high24h.toFixed(2)}</p>
        </div>
        <div>
          <span className="text-gray-400">24h Low</span>
          <p className="text-red-400 font-medium">${currentPrice.low24h.toFixed(2)}</p>
        </div>
      </div>

      {lastUpdate && (
        <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
          <span>Last updated: {new Date(lastUpdate).toLocaleTimeString()}</span>
          <span>Live data from Swissquote forex feed</span>
        </div>
      )}
    </div>
  );
}
