import { useStore } from '../hooks/useStore';
import { FibonacciService } from '../services/FibonacciService';

export function FibonacciLevels() {
  const { fibLevels, currentPrice } = useStore();

  if (!fibLevels) {
    return (
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Fibonacci Levels</h3>
        <p className="text-gray-400">Loading price data...</p>
      </div>
    );
  }

  const levels = [
    { name: '0%', value: fibLevels.levels.level0, desc: fibLevels.direction === 'bullish' ? 'Swing High' : 'Swing Low' },
    { name: '23.6%', value: fibLevels.levels.level236, desc: 'Minor retracement' },
    { name: '38.2%', value: fibLevels.levels.level382, desc: 'Shallow retracement' },
    { name: '50%', value: fibLevels.levels.level500, desc: 'Key psychological level' },
    { name: '61.8%', value: fibLevels.levels.level618, desc: 'Golden ratio (KEY)' },
    { name: '78.6%', value: fibLevels.levels.level786, desc: 'Deep retracement' },
    { name: '100%', value: fibLevels.levels.level1000, desc: fibLevels.direction === 'bullish' ? 'Swing Low' : 'Swing High' },
  ];

  const nearest = currentPrice 
    ? FibonacciService.findNearestLevel(currentPrice.price, fibLevels)
    : null;

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">Fibonacci Levels</h3>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          fibLevels.direction === 'bullish' 
            ? 'bg-green-900/50 text-green-400 border border-green-600/30' 
            : 'bg-red-900/50 text-red-400 border border-red-600/30'
        }`}>
          {fibLevels.direction === 'bullish' ? '📈 Bullish' : '📉 Bearish'}
        </span>
      </div>

      <div className="space-y-2">
        {levels.map((level) => {
          const isNearest = nearest?.level === level.name;
          const isAbove = currentPrice && currentPrice.price > level.value;
          
          return (
            <div
              key={level.name}
              className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                isNearest 
                  ? 'bg-yellow-900/40 border border-yellow-500/50 ring-1 ring-yellow-500/30' 
                  : 'bg-gray-700/50 hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-16 font-mono font-bold ${
                  level.name === '61.8%' ? 'text-yellow-400' :
                  level.name === '38.2%' || level.name === '50%' ? 'text-blue-400' :
                  'text-gray-300'
                }`}>
                  {level.name}
                </span>
                <span className="text-gray-400 text-sm hidden md:block">{level.desc}</span>
              </div>
              
              <div className="flex items-center gap-3">
                <span className={`font-medium ${isAbove ? 'text-green-400' : 'text-red-400'}`}>
                  ${level.value?.toFixed(2) ?? 'N/A'}
                </span>
                {isNearest && (
                  <span className="px-2 py-0.5 bg-yellow-500 text-black text-xs font-bold rounded">
                    NEAREST
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {nearest && currentPrice && (
        <div className="mt-4 p-4 bg-gray-700/50 rounded-lg">
          <p className="text-sm text-gray-300">
            Current price <span className="text-white font-bold">${currentPrice.price?.toFixed(2) ?? 'N/A'}</span> is{' '}
            <span className="text-yellow-400 font-medium">${nearest.distance?.toFixed(2) ?? 'N/A'}</span>{' '}
            ({nearest.percentDistance?.toFixed(2) ?? 'N/A'}%) away from the {nearest.level} level.
          </p>
        </div>
      )}
    </div>
  );
}
