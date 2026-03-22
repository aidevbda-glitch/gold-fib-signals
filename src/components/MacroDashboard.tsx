import React, { useEffect, useState } from 'react';
import { EnhancedMacroAnalysisService, type MacroRegimeAnalysis, type GoldBias } from '../services/EnhancedMacroAnalysisService';

interface MacroDashboardProps {
  className?: string;
}

const getBiasEmoji = (bias: GoldBias): string => {
  const emojis: Record<GoldBias, string> = {
    strong_bullish: '🟢',
    bullish: '🟢',
    neutral: '🟡',
    bearish: '🔴',
    strong_bearish: '🔴',
  };
  return emojis[bias] || '🟡';
};

const getBiasColor = (bias: GoldBias): string => {
  const colors: Record<GoldBias, string> = {
    strong_bullish: 'text-green-600 dark:text-green-400',
    bullish: 'text-green-500 dark:text-green-400',
    neutral: 'text-yellow-500 dark:text-yellow-400',
    bearish: 'text-red-500 dark:text-red-400',
    strong_bearish: 'text-red-600 dark:text-red-400',
  };
  return colors[bias] || 'text-yellow-500';
};

const formatRegimeName = (regime: string): string => {
  return regime.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const formatBiasName = (bias: string): string => {
  return bias.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

export const MacroDashboard: React.FC<MacroDashboardProps> = ({ className = '' }) => {
  const [analysis, setAnalysis] = useState<MacroRegimeAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMacroData();
    const interval = setInterval(fetchMacroData, 5 * 60 * 1000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  const fetchMacroData = async () => {
    try {
      setLoading(true);
      const data = await EnhancedMacroAnalysisService.getMacroRegime();
      setAnalysis(data);
      setError(null);
    } catch (err) {
      setError('Failed to load macro data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !analysis) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 ${className}`}>
        <h3 className="text-lg font-semibold mb-4">Macro Environment</h3>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error && !analysis) {
    return (
      <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 ${className}`}>
        <h3 className="text-lg font-semibold mb-4">Macro Environment</h3>
        <div className="text-red-500 text-sm">{error}</div>
        <button 
          onClick={fetchMacroData}
          className="mt-2 text-sm text-blue-500 hover:text-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!analysis) return null;

  const { macroContext, goldBias, regime, confidence, factors } = analysis;
  const { rateExpectations, treasuryYields, dollarContext } = macroContext;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Macro Environment</h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Updated: {new Date(analysis.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {/* Regime Badge */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Current Regime:</span>
          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-sm font-medium">
            {formatRegimeName(regime)}
          </span>
          <span className="text-xs text-gray-500">({confidence}% confidence)</span>
        </div>
      </div>

      {/* Gold Bias */}
      <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getBiasEmoji(goldBias)}</span>
          <div>
            <span className="text-sm text-gray-600 dark:text-gray-400">Gold Bias:</span>
            <span className={`ml-2 font-semibold ${getBiasColor(goldBias)}`}>
              {formatBiasName(goldBias)}
            </span>
          </div>
        </div>
      </div>

      {/* Fed Policy Section */}
      <div className="mb-4 border-t pt-3 dark:border-gray-700">
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <span>🏛️</span> Federal Reserve
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Next Meeting:</span>
            <span className="font-medium">{new Date(rateExpectations.nextMeeting).toLocaleDateString()}</span>
          </div>
          
          {/* Probability Bars */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Hike Probability</span>
              <span className="font-medium">{rateExpectations.hikeProbability}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-red-500 transition-all duration-500"
                style={{ width: `${rateExpectations.hikeProbability}%` }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Cut Probability</span>
              <span className="font-medium">{rateExpectations.cutProbability}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${rateExpectations.cutProbability}%` }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Hold Probability</span>
              <span className="font-medium">{rateExpectations.holdProbability}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gray-400 transition-all duration-500"
                style={{ width: `${rateExpectations.holdProbability}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* DXY Section */}
      <div className="mb-4 border-t pt-3 dark:border-gray-700">
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <span>💵</span> US Dollar Index (DXY)
        </h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400">Current:</span>
            <span className="ml-2 font-medium">{dollarContext.dxyCurrent.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">24h:</span>
            <span className={`ml-2 font-medium ${dollarContext.dxyChange24h >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {dollarContext.dxyChange24h >= 0 ? '+' : ''}{dollarContext.dxyChange24h.toFixed(2)}%
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">7d:</span>
            <span className={`ml-2 font-medium ${dollarContext.dxyChange7d >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {dollarContext.dxyChange7d >= 0 ? '+' : ''}{dollarContext.dxyChange7d.toFixed(2)}%
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Trend:</span>
            <span className={`ml-2 font-medium capitalize ${
              dollarContext.dxyTrend === 'strengthening' ? 'text-green-500' :
              dollarContext.dxyTrend === 'weakening' ? 'text-red-500' : 'text-gray-500'
            }`}>
              {dollarContext.dxyTrend}
            </span>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Gold/DXY Correlation (20d): {dollarContext.goldDxyCorrelation20d.toFixed(2)}
        </div>
      </div>

      {/* Treasury Yields Section */}
      <div className="mb-4 border-t pt-3 dark:border-gray-700">
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <span>📈</span> Treasury Yields
        </h4>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="text-center">
            <div className="text-xs text-gray-500">2Y</div>
            <div className="font-medium">{treasuryYields.yield2Y.toFixed(2)}%</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">10Y</div>
            <div className="font-medium">{treasuryYields.yield10Y.toFixed(2)}%</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500">30Y</div>
            <div className="font-medium">{treasuryYields.yield30Y.toFixed(2)}%</div>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-gray-500">Spread (10Y-2Y):</span>
          <span className={`text-sm font-medium ${treasuryYields.isInverted ? 'text-red-500' : 'text-green-500'}`}>
            {treasuryYields.yieldSpread10Y2Y.toFixed(2)}%
            {treasuryYields.isInverted && ' ⚠️ Inverted'}
          </span>
        </div>
      </div>

      {/* Explanation */}
      {analysis.explanation && (
        <div className="border-t pt-3 dark:border-gray-700">
          <h4 className="text-sm font-semibold mb-2">Analysis</h4>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            {analysis.explanation.split('\n\n')[0]}
          </p>
        </div>
      )}

      {/* Refresh Button */}
      <button
        onClick={fetchMacroData}
        className="mt-4 w-full py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
      >
        Refresh Data
      </button>
    </div>
  );
};

export default MacroDashboard;
