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
} from 'recharts';
import { format } from 'date-fns';

export function PriceChart() {
  const { priceHistory, fibLevels, currentPrice } = useStore();

  if (priceHistory.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 h-80 flex items-center justify-center">
        <p className="text-gray-400">Loading chart data...</p>
      </div>
    );
  }

  // Convert to chart data - using daily prices
  const chartData = priceHistory.map((candle) => ({
    time: candle.timestamp,
    price: candle.close,
    high: candle.high,
    low: candle.low,
    date: format(candle.timestamp, 'MMM d'), // Daily format
  }));

  // Add current price as today's point if we have it
  if (currentPrice) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();
    
    // Check if we already have today's data
    const hasTodayData = chartData.some(d => {
      const dDate = new Date(d.time);
      dDate.setHours(0, 0, 0, 0);
      return dDate.getTime() === todayTimestamp;
    });

    if (!hasTodayData) {
      chartData.push({
        time: Date.now(),
        price: currentPrice.price,
        high: currentPrice.price,
        low: currentPrice.price,
        date: format(Date.now(), 'MMM d'),
      });
    }
  }

  const minPrice = Math.min(...chartData.map(d => d.low)) * 0.995;
  const maxPrice = Math.max(...chartData.map(d => d.high)) * 1.005;

  const fibLines = fibLevels ? [
    { value: fibLevels.levels.level0, label: '0%', color: '#6366f1' },
    { value: fibLevels.levels.level236, label: '23.6%', color: '#8b5cf6' },
    { value: fibLevels.levels.level382, label: '38.2%', color: '#3b82f6' },
    { value: fibLevels.levels.level500, label: '50%', color: '#06b6d4' },
    { value: fibLevels.levels.level618, label: '61.8%', color: '#eab308' },
    { value: fibLevels.levels.level786, label: '78.6%', color: '#f97316' },
    { value: fibLevels.levels.level1000, label: '100%', color: '#ef4444' },
  ] : [];

  // Calculate tick interval based on data range
  const dataRangeDays = chartData.length;
  const tickInterval = dataRangeDays > 180 ? Math.floor(dataRangeDays / 12) : 
                       dataRangeDays > 60 ? Math.floor(dataRangeDays / 8) :
                       dataRangeDays > 30 ? 7 : 1;

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Daily Price Chart with Fibonacci Levels</h3>
        <span className="text-xs text-gray-500">
          {chartData.length} days • Smallest unit: 1 day
        </span>
      </div>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 60, left: 10, bottom: 10 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
              </linearGradient>
            </defs>

            <XAxis
              dataKey="time"
              tickFormatter={(time) => format(time, 'MMM d')}
              stroke="#4b5563"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              interval={tickInterval}
              angle={-45}
              textAnchor="end"
              height={50}
            />
            
            <YAxis
              domain={[minPrice, maxPrice]}
              tickFormatter={(value) => `$${value.toFixed(0)}`}
              stroke="#4b5563"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              width={60}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
              }}
              labelFormatter={(time) => format(time, 'EEEE, MMMM d, yyyy')}
              formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Daily Close']}
            />

            {/* Fibonacci reference lines */}
            {fibLines.map((fib) => (
              <ReferenceLine
                key={fib.label}
                y={fib.value}
                stroke={fib.color}
                strokeDasharray="5 5"
                strokeOpacity={0.6}
                label={{
                  value: `${fib.label} ($${fib.value.toFixed(0)})`,
                  fill: fib.color,
                  fontSize: 10,
                  position: 'right',
                }}
              />
            ))}

            {/* Current price reference line */}
            {currentPrice && (
              <ReferenceLine
                y={currentPrice.price}
                stroke="#22c55e"
                strokeWidth={2}
                label={{
                  value: `Live: $${currentPrice.price.toFixed(2)}`,
                  fill: '#22c55e',
                  fontSize: 11,
                  position: 'left',
                }}
              />
            )}

            <Area
              type="monotone"
              dataKey="price"
              stroke="transparent"
              fill="url(#priceGradient)"
            />

            <Line
              type="monotone"
              dataKey="price"
              stroke="#eab308"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#eab308' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 justify-center">
        {fibLines.map((fib) => (
          <div key={fib.label} className="flex items-center gap-1">
            <div className="w-3 h-0.5" style={{ backgroundColor: fib.color }}></div>
            <span className="text-xs text-gray-400">{fib.label}</span>
          </div>
        ))}
      </div>

      {/* Data source note */}
      <p className="text-xs text-gray-500 text-center mt-3">
        Historical: FreeGoldAPI (daily) • Live: Swissquote
      </p>
    </div>
  );
}
