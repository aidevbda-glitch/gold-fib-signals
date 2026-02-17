import { useEffect, useState } from 'react';
import { ArrowLeft, TrendingUp, RefreshCw } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import { SignalCard } from '../components/SignalCard';
import { FibonacciService } from '../services/FibonacciService';

interface BuySignalsPageProps {
  onBack: () => void;
}

export function BuySignalsPage({ onBack }: BuySignalsPageProps) {
  const { currentPrice, fibLevels, signals } = useStore();
  const [bidAnalysis, setBidAnalysis] = useState<{
    nearestLevel: string;
    distance: number;
    recommendation: string;
  } | null>(null);

  // Filter only BUY signals
  const buySignals = signals.filter(s => s.type === 'BUY');

  useEffect(() => {
    if (currentPrice && fibLevels) {
      const bidPrice = currentPrice.bid;
      const nearest = FibonacciService.findNearestLevel(bidPrice, fibLevels);
      const position = FibonacciService.analyzePosition(bidPrice, fibLevels);
      
      let recommendation = '';
      if (fibLevels.direction === 'bullish') {
        if (nearest.percentDistance < 1 && ['38.2%', '50%', '61.8%'].includes(nearest.level)) {
          recommendation = `BID price is near the ${nearest.level} support level. This could be a good entry point for buyers.`;
        } else if (position.zone === 'middle' || position.zone === 'lower') {
          recommendation = `BID price is in a retracement zone. Watch for support at nearby Fibonacci levels.`;
        } else {
          recommendation = `BID price is extended. Consider waiting for a pullback to key Fibonacci levels.`;
        }
      } else {
        if (position.zone === 'below_low') {
          recommendation = `BID price is below the swing low. Potential reversal or trend continuation.`;
        } else {
          recommendation = `In a bearish trend. BUY signals are counter-trend - use caution.`;
        }
      }

      setBidAnalysis({
        nearestLevel: nearest.level,
        distance: nearest.distance,
        recommendation,
      });
    }
  }, [currentPrice, fibLevels]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gradient-to-r from-green-900/30 to-gray-900 sticky top-0 z-50">
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
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Buy Signals</h1>
                  <p className="text-sm text-gray-400">Based on BID price analysis</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Current Bid Price Card */}
        <div className="bg-gradient-to-br from-green-900/40 to-green-800/20 border border-green-500/30 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-green-400">Current BID Price (Buy at)</h2>
            {currentPrice && (
              <span className="text-xs text-gray-400">
                Source: {currentPrice.source}
              </span>
            )}
          </div>
          
          {currentPrice ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-4xl font-bold text-white">${currentPrice.bid.toFixed(2)}</p>
                <p className="text-sm text-gray-400 mt-1">
                  Spread: ${(currentPrice.ask - currentPrice.bid).toFixed(2)}
                </p>
              </div>
              
              <div className="md:col-span-2">
                {bidAnalysis && (
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <p className="text-sm text-gray-300">
                      <span className="text-green-400 font-medium">Nearest Fib Level:</span> {bidAnalysis.nearestLevel}
                      <span className="text-gray-500 ml-2">(${bidAnalysis.distance.toFixed(2)} away)</span>
                    </p>
                    <p className="text-sm text-gray-400 mt-2">{bidAnalysis.recommendation}</p>
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

        {/* Fibonacci Levels for BID */}
        {fibLevels && currentPrice && (
          <div className="bg-gray-800 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-bold text-white mb-4">BID Price vs Fibonacci Levels</h3>
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
                const isBidNear = Math.abs(currentPrice.bid - level.value) / level.value < 0.005;
                const isBidAbove = currentPrice.bid > level.value;
                
                return (
                  <div
                    key={level.name}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      isBidNear
                        ? 'bg-green-900/40 border border-green-500/50'
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
                      {isBidNear && (
                        <span className="px-2 py-0.5 bg-green-500 text-black text-xs font-bold rounded">
                          BID HERE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-medium ${isBidAbove ? 'text-green-400' : 'text-red-400'}`}>
                        ${level.value.toFixed(2)}
                      </span>
                      <span className={`text-xs ${isBidAbove ? 'text-green-400' : 'text-red-400'}`}>
                        {isBidAbove ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Buy Signals List */}
        <div className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Buy Signal History
            </h3>
            <span className="px-3 py-1 bg-green-900/50 text-green-400 text-sm rounded-full">
              {buySignals.length} signals
            </span>
          </div>

          {buySignals.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📈</div>
              <p className="text-gray-400 text-lg">No buy signals yet</p>
              <p className="text-gray-500 text-sm mt-2">
                Buy signals are generated when BID price approaches key Fibonacci support levels
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {buySignals.slice().reverse().slice(0, 20).map((signal) => (
                <SignalCard key={signal.id} signal={signal} />
              ))}
            </div>
          )}
        </div>

        {/* Educational Note */}
        <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <h4 className="font-medium text-white mb-2">📚 Understanding BID Price</h4>
          <p className="text-sm text-gray-400">
            The <strong className="text-green-400">BID price</strong> is what buyers are willing to pay for gold.
            When you want to BUY gold, you'll pay the ASK price, but the BID shows current buyer demand.
            Buy signals are generated when the BID approaches key Fibonacci support levels, suggesting
            buyers may step in to defend these prices.
          </p>
        </div>
      </main>
    </div>
  );
}
