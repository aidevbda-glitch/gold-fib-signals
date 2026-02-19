import { useEffect, useState } from 'react';
import { ArrowLeft, TrendingDown, RefreshCw } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import { SignalCard } from '../components/SignalCard';
import { FibonacciService } from '../services/FibonacciService';

interface SellSignalsPageProps {
  onBack: () => void;
}

export function SellSignalsPage({ onBack }: SellSignalsPageProps) {
  const { currentPrice, fibLevels, signals } = useStore();
  const [askAnalysis, setAskAnalysis] = useState<{
    nearestLevel: string;
    distance: number;
    recommendation: string;
  } | null>(null);

  // Filter only SELL signals
  const sellSignals = signals.filter(s => s.type === 'SELL');

  useEffect(() => {
    if (currentPrice && fibLevels) {
      const askPrice = currentPrice.ask;
      const nearest = FibonacciService.findNearestLevel(askPrice, fibLevels);
      const position = FibonacciService.analyzePosition(askPrice, fibLevels);
      
      let recommendation = '';
      if (fibLevels.direction === 'bearish') {
        if (nearest.percentDistance < 1 && ['38.2%', '50%', '61.8%'].includes(nearest.level)) {
          recommendation = `ASK price is near the ${nearest.level} resistance level. This could be a good exit point for sellers.`;
        } else if (position.zone === 'middle' || position.zone === 'upper') {
          recommendation = `ASK price is in a retracement zone. Watch for resistance at nearby Fibonacci levels.`;
        } else {
          recommendation = `ASK price is extended. Consider waiting for a rally to key Fibonacci levels.`;
        }
      } else {
        if (position.zone === 'above_high') {
          recommendation = `ASK price is above the swing high. Potential reversal or profit-taking zone.`;
        } else {
          recommendation = `In a bullish trend. SELL signals are counter-trend - use caution or take partial profits.`;
        }
      }

      setAskAnalysis({
        nearestLevel: nearest.level,
        distance: nearest.distance,
        recommendation,
      });
    }
  }, [currentPrice, fibLevels]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gradient-to-r from-red-900/[0.65] to-gray-900 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <TrendingDown className="w-6 h-6 text-red-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Sell Signals</h1>
                  <p className="text-sm text-gray-400">Based on ASK price analysis</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Current Ask Price Card */}
        <div className="bg-gradient-to-br from-red-900/40 to-red-800/20 border border-red-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-red-400">Current ASK Price (Sell at)</h2>
            {currentPrice && (
              <span className="text-xs text-gray-400">
                Source: {currentPrice.source}
              </span>
            )}
          </div>
          
          {currentPrice ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-4xl font-bold text-white">${currentPrice.ask.toFixed(2)}</p>
                <p className="text-sm text-gray-400 mt-1">
                  Spread: ${(currentPrice.ask - currentPrice.bid).toFixed(2)}
                </p>
              </div>
              
              <div className="md:col-span-2">
                {askAnalysis && (
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <p className="text-sm text-gray-300">
                      <span className="text-red-400 font-medium">Nearest Fib Level:</span> {askAnalysis.nearestLevel}
                      <span className="block sm:inline text-gray-500 sm:ml-2">(${askAnalysis.distance.toFixed(2)} away)</span>
                    </p>
                    <p className="text-sm text-gray-400 mt-2">{askAnalysis.recommendation}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Loading price data...
            </div>
          )}
        </div>

        {/* Fibonacci Levels for ASK */}
        {fibLevels && currentPrice && (
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-bold text-white mb-4">ASK Price vs Fibonacci Levels</h3>
            <div className="space-y-2">
              {[
                { name: '0%', value: fibLevels.levels.level0 },
                { name: '23.6%', value: fibLevels.levels.level236 },
                { name: '38.2%', value: fibLevels.levels.level382 },
                { name: '50%', value: fibLevels.levels.level500 },
                { name: '61.8%', value: fibLevels.levels.level618 },
                { name: '78.6%', value: fibLevels.levels.level786 },
                { name: '100%', value: fibLevels.levels.level1000 },
              ].map((level) => {
                const isAskNear = Math.abs(currentPrice.ask - level.value) / level.value < 0.005;
                const isAskAbove = currentPrice.ask > level.value;
                
                return (
                  <div
                    key={level.name}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      isAskNear
                        ? 'bg-red-900/40 border border-red-500/50'
                        : 'bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-mono font-bold ${
                        level.name === '61.8%' ? 'text-yellow-400' :
                        ['38.2%', '50%'].includes(level.name) ? 'text-blue-400' :
                        'text-gray-300'
                      }`}>
                        {level.name}
                      </span>
                      {isAskNear && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded">
                          ASK HERE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-medium ${isAskAbove ? 'text-green-400' : 'text-red-400'}`}>
                        ${level.value.toFixed(2)}
                      </span>
                      <span className={`text-xs ${isAskAbove ? 'text-green-400' : 'text-red-400'}`}>
                        {isAskAbove ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sell Signals List */}
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-400" />
              Sell Signal History
            </h3>
            <span className="px-3 py-1 bg-red-900/50 text-red-400 text-sm rounded-full">
              {sellSignals.length} signals
            </span>
          </div>

          {sellSignals.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📉</div>
              <p className="text-gray-400 text-lg">No sell signals yet</p>
              <p className="text-gray-500 text-sm mt-2">
                Sell signals are generated when ASK price approaches key Fibonacci resistance levels
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sellSignals.slice().reverse().slice(0, 20).map((signal) => (
                <SignalCard key={signal.id} signal={signal} />
              ))}
            </div>
          )}
        </div>

        {/* Educational Note */}
        <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <h4 className="font-medium text-white mb-2">📚 Understanding ASK Price</h4>
          <p className="text-sm text-gray-400">
            The <strong className="text-red-400">ASK price</strong> is what sellers are asking for gold.
            When you want to SELL gold, you'll receive the BID price, but the ASK shows current seller supply.
            Sell signals are generated when the ASK approaches key Fibonacci resistance levels, suggesting
            sellers may emerge to defend these prices or where profit-taking commonly occurs.
          </p>
        </div>
      </main>
    </div>
  );
}
