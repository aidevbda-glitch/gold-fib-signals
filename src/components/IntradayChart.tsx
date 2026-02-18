import { useState } from 'react';
import { useStore } from '../hooks/useStore';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import { Clock, TrendingUp, TrendingDown } from 'lucide-react';

type ViewMode = '1h' | '4h' | '12h' | 'today';

export function IntradayChart() {
  const { intradayData, currentPrice } = useStore();
  const [viewMode, setViewMode] = useState<ViewMode>('today');

  if (intradayData.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 h-80 flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-8 h-8 text-gray-500 mx-auto mb-2" />
          <p className="text-gray-400">Loading intraday data...</p>
          <p className="text-gray-500 text-sm mt-1">Collecting ticks every minute from Swissquote</p>
        </div>
      </div>
    );
  }

  // Filter data based on view mode
  const now = Date.now();
  const filterMs = {
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    'today': 24 * 60 * 60 * 1000,
  };

  const filteredData = intradayData
    .filter(tick => tick.timestamp > now - filterMs[viewMode])
    .map(tick => ({
      time: tick.timestamp,
      bid: tick.bid,
      ask: tick.ask,
      mid: tick.mid,
      spread: tick.spread,
    }));

  if (filteredData.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 h-80 flex items-center justify-center">
        <p className="text-gray-400">No data available for selected timeframe</p>
      </div>
    );
  }

  // Calculate stats
  const bidHigh = Math.max(...filteredData.map(d => d.bid));
  const bidLow = Math.min(...filteredData.map(d => d.bid));
  const askHigh = Math.max(...filteredData.map(d => d.ask));
  const askLow = Math.min(...filteredData.map(d => d.ask));
  const latestTick = filteredData[filteredData.length - 1];
  const firstTick = filteredData[0];
  const priceChange = latestTick.mid - firstTick.mid;
  const priceChangePercent = (priceChange / firstTick.mid) * 100;

  const minPrice = Math.min(bidLow, askLow) * 0.9995;
  const maxPrice = Math.max(bidHigh, askHigh) * 1.0005;

  // Format time based on view mode
  const formatTime = (timestamp: number) => {
    if (viewMode === '1h') {
      return format(timestamp, 'HH:mm');
    }
    return format(timestamp, 'HH:mm');
  };

  return (
    <div className="bg-gray-800 rounded-xl px-3 py-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3 sm:mb-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
          <h3 className="text-base sm:text-lg font-bold text-white">Intraday Chart</h3>
          <span className={`flex items-center gap-1 text-xs sm:text-sm ${priceChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {priceChange >= 0 ? <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" /> : <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />}
            {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePercent >= 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%)
          </span>
        </div>
        
        {/* View Mode Selector */}
        <div className="flex gap-1 overflow-x-auto scrollbar-none -mx-1 px-1 sm:mx-0 sm:px-0">
          {(['1h', '4h', '12h', 'today'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-xs rounded-lg transition-colors shrink-0 ${
                viewMode === mode
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {mode === 'today' ? 'Today' : mode.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-3 sm:mb-4 text-xs sm:text-sm">
        <div className="bg-gray-700/50 rounded-lg p-2">
          <span className="text-gray-400 text-xs">Bid High</span>
          <p className="text-green-400 font-medium">${bidHigh.toFixed(2)}</p>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-2">
          <span className="text-gray-400 text-xs">Bid Low</span>
          <p className="text-red-400 font-medium">${bidLow.toFixed(2)}</p>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-2">
          <span className="text-gray-400 text-xs">Ask High</span>
          <p className="text-green-400 font-medium">${askHigh.toFixed(2)}</p>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-2">
          <span className="text-gray-400 text-xs">Ask Low</span>
          <p className="text-red-400 font-medium">${askLow.toFixed(2)}</p>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={filteredData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
            <defs>
              <linearGradient id="bidGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="askGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              stroke="#4b5563"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              interval="preserveStartEnd"
            />
            
            <YAxis
              domain={[minPrice, maxPrice]}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
              stroke="#4b5563"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              width={55}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
              labelFormatter={(time) => format(time as number, 'HH:mm:ss')}
              formatter={(value, name) => [
                `$${Number(value).toFixed(2)}`,
                String(name).charAt(0).toUpperCase() + String(name).slice(1)
              ]}
            />

            <Legend 
              verticalAlign="top" 
              height={36}
              formatter={(value) => <span className="text-gray-300 text-xs">{value}</span>}
            />

            {/* Current price line */}
            {currentPrice && (
              <ReferenceLine
                y={currentPrice.price}
                stroke="#eab308"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
            )}

            <Area
              type="monotone"
              dataKey="bid"
              stroke="transparent"
              fill="url(#bidGradient)"
            />

            <Area
              type="monotone"
              dataKey="ask"
              stroke="transparent"
              fill="url(#askGradient)"
            />

            <Line
              type="monotone"
              dataKey="bid"
              stroke="#22c55e"
              strokeWidth={1.5}
              dot={false}
              name="Bid"
            />

            <Line
              type="monotone"
              dataKey="ask"
              stroke="#ef4444"
              strokeWidth={1.5}
              dot={false}
              name="Ask"
            />

            <Line
              type="monotone"
              dataKey="mid"
              stroke="#eab308"
              strokeWidth={2}
              dot={false}
              name="Mid"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
        <span>{filteredData.length} data points</span>
        <span>Source: Swissquote • Updated every minute</span>
      </div>
    </div>
  );
}
