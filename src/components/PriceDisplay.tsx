import { useStore } from '../hooks/useStore';
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';

export function PriceDisplay() {
  const { currentPrice, lastUpdate, isLoading } = useStore();

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

  return (
    <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-700/20 border border-yellow-600/30 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🥇</span>
          <h2 className="text-xl font-bold text-yellow-400">Gold Spot (XAU/USD)</h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          {isLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
          <span>{currentPrice.source}</span>
        </div>
      </div>

      <div className="flex items-end gap-4 mb-4">
        <span className="text-5xl font-bold text-white">
          ${currentPrice.price.toFixed(2)}
        </span>
        <div className={`flex items-center gap-1 ${trendColor} text-lg`}>
          <TrendIcon className="w-5 h-5" />
          <span>{isPositive ? '+' : ''}{currentPrice.changePercent24h.toFixed(2)}%</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-400">Bid</span>
          <p className="text-white font-medium">${currentPrice.bid.toFixed(2)}</p>
        </div>
        <div>
          <span className="text-gray-400">Ask</span>
          <p className="text-white font-medium">${currentPrice.ask.toFixed(2)}</p>
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
        <p className="text-xs text-gray-500 mt-4">
          Last updated: {new Date(lastUpdate).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
