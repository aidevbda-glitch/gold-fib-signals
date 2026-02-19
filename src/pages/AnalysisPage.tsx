import { useEffect, useState } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Activity, BarChart3, Gauge, Target, Info, RefreshCw } from 'lucide-react';
import { useStore } from '../hooks/useStore';
import { TechnicalIndicators, type TechnicalAnalysis } from '../services/TechnicalIndicators';
import { FibonacciService } from '../services/FibonacciService';

interface AnalysisPageProps {
  onBack: () => void;
}

export function AnalysisPage({ onBack }: AnalysisPageProps) {
  const { priceHistory, currentPrice, fibLevels } = useStore();
  const [analysis, setAnalysis] = useState<TechnicalAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (priceHistory.length > 0) {
      // Calculate Fibonacci score
      let fibScore = 0;
      if (currentPrice && fibLevels) {
        const { percentDistance } = FibonacciService.findNearestLevel(currentPrice.price, fibLevels);
        if (percentDistance < 2) fibScore = 25;
        else if (percentDistance < 5) fibScore = 15;
        else if (percentDistance < 10) fibScore = 5;
      }

      const result = TechnicalIndicators.analyze(priceHistory, fibScore);
      setAnalysis(result);
      setIsLoading(false);
    }
  }, [priceHistory, currentPrice, fibLevels]);

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    if (score >= 30) return 'text-orange-400';
    return 'text-red-400';
  };

  const getRecommendationStyle = (rec: string) => {
    switch (rec) {
      case 'STRONG_BUY': return 'bg-green-500 text-white';
      case 'BUY': return 'bg-green-700 text-white';
      case 'NEUTRAL': return 'bg-gray-600 text-white';
      case 'SELL': return 'bg-red-700 text-white';
      case 'STRONG_SELL': return 'bg-red-500 text-white';
      default: return 'bg-gray-600 text-white';
    }
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'up' || trend === 'bullish') return <TrendingUp className="w-5 h-5 text-green-400" />;
    if (trend === 'down' || trend === 'bearish') return <TrendingDown className="w-5 h-5 text-red-400" />;
    return <Minus className="w-5 h-5 text-gray-400" />;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gradient-to-r from-purple-900/[0.65] to-gray-900 sticky top-0 z-50">
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
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Technical Analysis</h1>
                  <p className="text-sm text-gray-400">Multi-indicator confluence scoring</p>
                </div>
              </div>
            </div>
            {analysis && (
              <div className={`px-4 py-2 rounded-lg font-bold ${getRecommendationStyle(analysis.confluence.recommendation)}`}>
                {analysis.confluence.recommendation.replace('_', ' ')}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
          </div>
        ) : analysis ? (
          <div className="space-y-6">
            {/* Confluence Score Card */}
            <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/20 border border-purple-500/30 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Gauge className="w-6 h-6 text-purple-400" />
                <h2 className="text-lg font-bold text-white">Confluence Score</h2>
                <span className={`text-3xl font-bold ${getScoreColor(analysis.confluence.total)}`}>
                  {analysis.confluence.total.toFixed(0)}/100
                </span>
              </div>

              {/* Score Breakdown Bar */}
              <div className="mb-4">
                <div className="h-4 bg-gray-700 rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-blue-500" 
                    style={{ width: `${analysis.confluence.emaScore}%` }}
                    title="EMA"
                  />
                  <div 
                    className="h-full bg-green-500" 
                    style={{ width: `${analysis.confluence.macdScore}%` }}
                    title="MACD"
                  />
                  <div 
                    className="h-full bg-yellow-500" 
                    style={{ width: `${analysis.confluence.rsiScore}%` }}
                    title="RSI"
                  />
                  <div 
                    className="h-full bg-purple-500" 
                    style={{ width: `${analysis.confluence.fibScore}%` }}
                    title="Fibonacci"
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>🔵 EMA: {analysis.confluence.emaScore}</span>
                  <span>🟢 MACD: {analysis.confluence.macdScore}</span>
                  <span>🟡 RSI: {analysis.confluence.rsiScore}</span>
                  <span>🟣 Fib: {analysis.confluence.fibScore}</span>
                </div>
              </div>

              {/* Confidence Badge */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Confidence:</span>
                <span className={`px-2 py-1 rounded text-sm font-medium ${
                  analysis.confluence.confidence === 'high' ? 'bg-green-900/50 text-green-400' :
                  analysis.confluence.confidence === 'medium' ? 'bg-yellow-900/50 text-yellow-400' :
                  'bg-red-900/50 text-red-400'
                }`}>
                  {analysis.confluence.confidence.toUpperCase()}
                </span>
                <span className="text-xs text-gray-500">
                  ({analysis.confluence.confidence === 'high' ? 'All indicators aligned' :
                    analysis.confluence.confidence === 'medium' ? 'Most indicators aligned' :
                    'Mixed signals'})
                </span>
              </div>

              {/* Factors List */}
              <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
                <h4 className="text-sm font-medium text-white mb-2">Contributing Factors:</h4>
                <ul className="space-y-1">
                  {analysis.confluence.factors.map((factor, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-purple-400 rounded-full"></span>
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Signal Conflict Explanation */}
            <div className="bg-gradient-to-br from-amber-900/30 to-amber-800/10 border border-amber-500/30 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Info className="w-6 h-6 text-amber-400" />
                <h2 className="text-lg font-bold text-white">Understanding Signal Conflicts</h2>
              </div>
              
              <p className="text-gray-300 text-sm mb-4">
                It's common for <strong className="text-yellow-400">Fibonacci signals</strong> and <strong className="text-purple-400">Technical Analysis</strong> to suggest different actions. 
                This isn't a bug — they measure different things:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="text-yellow-400 font-medium mb-2">🎯 Fibonacci Signals</h4>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li className="flex gap-2"><span className="shrink-0">•</span><span>Counter-trend: looks for <strong className="text-white">reversals</strong> at key levels</span></li>
                    <li className="flex gap-2"><span className="shrink-0">•</span><span>Short-term focus (hours to days)</span></li>
                    <li className="flex gap-2"><span className="shrink-0">•</span><span>SELL at resistance, BUY at support</span></li>
                  </ul>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <h4 className="text-purple-400 font-medium mb-2">📊 Technical Analysis</h4>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li className="flex gap-2"><span className="shrink-0">•</span><span>Trend-following: shows current <strong className="text-white">momentum</strong></span></li>
                    <li className="flex gap-2"><span className="shrink-0">•</span><span>Medium-term focus (days to weeks)</span></li>
                    <li className="flex gap-2"><span className="shrink-0">•</span><span>BUY when momentum up, SELL when down</span></li>
                  </ul>
                </div>
              </div>

              <div className="bg-gray-800/70 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">Common Conflict Scenarios:</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex gap-3">
                    <span className="shrink-0 px-2 py-1 bg-red-900/50 text-red-400 rounded text-xs font-bold">FIB SELL</span>
                    <span className="shrink-0 px-2 py-1 bg-green-900/50 text-green-400 rounded text-xs font-bold">TA BUY</span>
                    <span className="text-gray-300">= Price trending UP but hit resistance. <strong className="text-yellow-400">Short-term pullback likely</strong>, underlying trend still bullish.</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="shrink-0 px-2 py-1 bg-green-900/50 text-green-400 rounded text-xs font-bold">FIB BUY</span>
                    <span className="shrink-0 px-2 py-1 bg-red-900/50 text-red-400 rounded text-xs font-bold">TA SELL</span>
                    <span className="text-gray-300">= Price trending DOWN but hit support. <strong className="text-yellow-400">Short-term bounce likely</strong>, underlying trend still bearish.</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="shrink-0 px-2 py-1 bg-green-900/50 text-green-400 rounded text-xs font-bold">BOTH BUY</span>
                    <span className="text-gray-300">= Strong alignment. Price at support AND momentum bullish. <strong className="text-green-400">Higher confidence long entry.</strong></span>
                  </div>
                  <div className="flex gap-3">
                    <span className="shrink-0 px-2 py-1 bg-red-900/50 text-red-400 rounded text-xs font-bold">BOTH SELL</span>
                    <span className="text-gray-300">= Strong alignment. Price at resistance AND momentum bearish. <strong className="text-red-400">Higher confidence short/exit.</strong></span>
                  </div>
                </div>
              </div>

              <p className="text-gray-500 text-xs mt-4">
                💡 <strong>Pro tip:</strong> Conflicting signals often indicate a market at an inflection point. Consider waiting for confirmation or reducing position size.
              </p>
            </div>

            {/* Indicators Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* EMA Card */}
              <div className="bg-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-400" />
                    <h3 className="text-lg font-bold text-white">EMA Crossover</h3>
                  </div>
                  {getTrendIcon(analysis.ema.trend)}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <span className="text-xs text-gray-400">EMA(8)</span>
                    <p className="text-lg font-bold text-blue-400">${analysis.ema.ema8.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <span className="text-xs text-gray-400">EMA(34)</span>
                    <p className="text-lg font-bold text-blue-300">${analysis.ema.ema34.toFixed(2)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Trend:</span>
                    <span className={analysis.ema.trend === 'up' ? 'text-green-400' : analysis.ema.trend === 'down' ? 'text-red-400' : 'text-gray-400'}>
                      {analysis.ema.trend.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Crossover:</span>
                    <span className={analysis.ema.crossover === 'bullish' ? 'text-green-400' : analysis.ema.crossover === 'bearish' ? 'text-red-400' : 'text-gray-400'}>
                      {analysis.ema.crossover === 'none' ? 'None' : analysis.ema.crossover.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Strength:</span>
                    <span className="text-white">{analysis.ema.strength.toFixed(0)}%</span>
                  </div>
                </div>

                {/* Educational Note */}
                <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                    <p className="text-xs text-gray-300">
                      <strong>EMA Crossover:</strong> When the fast EMA(8) crosses above the slow EMA(34), 
                      it signals bullish momentum. The opposite indicates bearish momentum.
                    </p>
                  </div>
                </div>
              </div>

              {/* MACD Card */}
              <div className="bg-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-green-400" />
                    <h3 className="text-lg font-bold text-white">MACD</h3>
                  </div>
                  {getTrendIcon(analysis.macd.trend)}
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <span className="text-xs text-gray-400">MACD Line</span>
                    <p className="text-lg font-bold text-green-400">{analysis.macd.macdLine.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <span className="text-xs text-gray-400">Signal</span>
                    <p className="text-lg font-bold text-orange-400">{analysis.macd.signalLine.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <span className="text-xs text-gray-400">Histogram</span>
                    <p className={`text-lg font-bold ${analysis.macd.histogram >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {analysis.macd.histogram.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Trend:</span>
                    <span className={analysis.macd.trend === 'bullish' ? 'text-green-400' : analysis.macd.trend === 'bearish' ? 'text-red-400' : 'text-gray-400'}>
                      {analysis.macd.trend.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Divergence:</span>
                    <span className={analysis.macd.divergence === 'bullish' ? 'text-green-400' : analysis.macd.divergence === 'bearish' ? 'text-red-400' : 'text-gray-400'}>
                      {analysis.macd.divergence === 'none' ? 'None' : analysis.macd.divergence.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-green-900/20 border border-green-700/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-green-400 mt-0.5" />
                    <p className="text-xs text-gray-300">
                      <strong>MACD (12,26,9):</strong> Measures momentum. When MACD line crosses above signal line, 
                      it's bullish. Positive histogram = strengthening trend.
                    </p>
                  </div>
                </div>
              </div>

              {/* RSI Card */}
              <div className="bg-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-5 h-5 text-yellow-400" />
                    <h3 className="text-lg font-bold text-white">RSI (14)</h3>
                  </div>
                  <span className={`text-2xl font-bold ${
                    analysis.rsi.zone === 'oversold' ? 'text-green-400' :
                    analysis.rsi.zone === 'overbought' ? 'text-red-400' : 'text-yellow-400'
                  }`}>
                    {analysis.rsi.value.toFixed(1)}
                  </span>
                </div>

                {/* RSI Gauge */}
                <div className="mb-4">
                  <div className="h-3 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full relative">
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-5 bg-white rounded shadow-lg border-2 border-gray-800"
                      style={{ left: `${analysis.rsi.value}%`, transform: 'translateX(-50%) translateY(-50%)' }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>0 (Oversold)</span>
                    <span>50</span>
                    <span>100 (Overbought)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Zone:</span>
                    <span className={
                      analysis.rsi.zone === 'oversold' ? 'text-green-400' :
                      analysis.rsi.zone === 'overbought' ? 'text-red-400' : 'text-yellow-400'
                    }>
                      {analysis.rsi.zone.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Buy Zone (45-70):</span>
                    <span className={analysis.rsi.buyZone ? 'text-green-400' : 'text-gray-500'}>
                      {analysis.rsi.buyZone ? 'YES ✓' : 'NO'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Sell Zone (30-55):</span>
                    <span className={analysis.rsi.sellZone ? 'text-red-400' : 'text-gray-500'}>
                      {analysis.rsi.sellZone ? 'YES ✓' : 'NO'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-yellow-400 mt-0.5" />
                    <p className="text-xs text-gray-300">
                      <strong>RSI:</strong> Measures overbought/oversold conditions. Below 30 = oversold (potential buy), 
                      above 70 = overbought (potential sell). Optimal buy zone: 45-70.
                    </p>
                  </div>
                </div>
              </div>

              {/* ATR Card */}
              <div className="bg-gray-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-orange-400" />
                    <h3 className="text-lg font-bold text-white">ATR (14)</h3>
                  </div>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    analysis.atr.volatility === 'high' ? 'bg-red-900/50 text-red-400' :
                    analysis.atr.volatility === 'medium' ? 'bg-yellow-900/50 text-yellow-400' :
                    'bg-green-900/50 text-green-400'
                  }`}>
                    {analysis.atr.volatility.toUpperCase()} VOLATILITY
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <span className="text-xs text-gray-400">ATR Value</span>
                    <p className="text-lg font-bold text-orange-400">${analysis.atr.value.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <span className="text-xs text-gray-400">Stop Loss (1.5x)</span>
                    <p className="text-lg font-bold text-red-400">${analysis.atr.stopLoss.toFixed(2)}</p>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-3">
                    <span className="text-xs text-gray-400">Take Profit (2x)</span>
                    <p className="text-lg font-bold text-green-400">${analysis.atr.takeProfit.toFixed(2)}</p>
                  </div>
                </div>

                {currentPrice && (
                  <div className="space-y-2 p-3 bg-gray-700/30 rounded-lg">
                    <p className="text-sm text-gray-400">Based on current price ${currentPrice.price.toFixed(2)}:</p>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Suggested Stop:</span>
                      <span className="text-red-400">${(currentPrice.price - analysis.atr.stopLoss).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Suggested Target:</span>
                      <span className="text-green-400">${(currentPrice.price + analysis.atr.takeProfit).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Risk:Reward:</span>
                      <span className="text-white">1:1.33</span>
                    </div>
                  </div>
                )}

                <div className="mt-4 p-3 bg-orange-900/20 border border-orange-700/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-orange-400 mt-0.5" />
                    <p className="text-xs text-gray-300">
                      <strong>ATR:</strong> Average True Range measures volatility. Use 1.5x ATR for stop-loss 
                      and 2x ATR for take-profit to account for normal price fluctuations.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* How It Works Section */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-purple-400" />
                How Confluence Scoring Works
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-white mb-3">Score Components (Max 100)</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-blue-500 rounded"></div>
                      <span className="text-gray-300">EMA Trend Alignment: up to 20 pts</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span className="text-gray-300">MACD Momentum: up to 20 pts</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                      <span className="text-gray-300">RSI Zone: up to 20 pts</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-purple-500 rounded"></div>
                      <span className="text-gray-300">Fibonacci Proximity: up to 25 pts</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 bg-pink-500 rounded"></div>
                      <span className="text-gray-300">Volume (coming soon): up to 15 pts</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-white mb-3">Signal Interpretation</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-1 bg-green-500 text-white text-sm rounded">STRONG BUY</span>
                      <span className="text-gray-400">Score ≥ 75</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-1 bg-green-700 text-white text-sm rounded">BUY</span>
                      <span className="text-gray-400">Score 60-74</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-1 bg-gray-600 text-white text-sm rounded">NEUTRAL</span>
                      <span className="text-gray-400">Score 40-59</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-1 bg-red-700 text-white text-sm rounded">SELL</span>
                      <span className="text-gray-400">Score 25-39</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-1 bg-red-500 text-white text-sm rounded">STRONG SELL</span>
                      <span className="text-gray-400">Score &lt; 25</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-purple-900/20 border border-purple-700/30 rounded-lg">
                <p className="text-sm text-gray-300">
                  <strong className="text-purple-400">💡 Pro Tip:</strong> High confidence signals occur when 
                  multiple indicators align in the same direction. A "STRONG BUY" with "HIGH" confidence 
                  means EMA, MACD, RSI, and Fibonacci all support the bullish case.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            <p>No analysis available. Please wait for price data to load.</p>
          </div>
        )}
      </main>
    </div>
  );
}
