import { useState, useMemo } from 'react';
import { useStore } from '../hooks/useStore';
import { 
  PatternDetectionService, 
  type DetectedPattern, 
  type PatternDefinition,
  type PatternType,
  type PatternSignal
} from '../services/PatternDetectionService';
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Target,
  Clock,
  BarChart3,
  BookOpen,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronRight,
  Layers,
  CandlestickChart,
  LineChart,
  Filter
} from 'lucide-react';

interface PatternsPageProps {
  onBack: () => void;
}

type ViewMode = 'detected' | 'education';
// Note: Pattern detection only works with daily OHLC data
// Intraday tick data (bid/ask) doesn't have the candle structure needed

const SIGNAL_COLORS = {
  bullish: { bg: 'bg-green-900/50', border: 'border-green-700', text: 'text-green-400', icon: TrendingUp },
  bearish: { bg: 'bg-red-900/50', border: 'border-red-700', text: 'text-red-400', icon: TrendingDown },
  neutral: { bg: 'bg-gray-700/50', border: 'border-gray-600', text: 'text-gray-400', icon: Minus }
};

const RELIABILITY_COLORS = {
  high: { bg: 'bg-emerald-500', text: 'text-emerald-400' },
  medium: { bg: 'bg-yellow-500', text: 'text-yellow-400' },
  low: { bg: 'bg-orange-500', text: 'text-orange-400' }
};

export function PatternsPage({ onBack }: PatternsPageProps) {
  const { priceHistory } = useStore();
  const [viewMode, setViewMode] = useState<ViewMode>('detected');
  const [expandedPattern, setExpandedPattern] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<PatternType | 'all'>('all');
  const [filterSignal, setFilterSignal] = useState<PatternSignal | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Detect patterns in current data
  // Note: Pattern detection requires OHLC data, so we only use daily data for now
  // Intraday data (bid/ask) doesn't have the OHLC structure needed for candlestick patterns
  const detectedPatterns = useMemo(() => {
    // Only use daily data for pattern detection (has OHLC)
    const data = priceHistory;
    if (!data || data.length < 5) return [];
    
    return PatternDetectionService.detectPatterns(data, {
      lookback: 10,
      types: filterType === 'all' ? ['candlestick', 'chart'] : [filterType],
      minReliability: 'low'
    }).filter(p => filterSignal === 'all' || p.signal === filterSignal);
  }, [priceHistory, filterType, filterSignal]);

  // Get all pattern definitions for education
  const allPatterns = useMemo(() => {
    const patterns = PatternDetectionService.getAllPatternDefinitions();
    return patterns.filter(p => {
      if (filterType !== 'all' && p.type !== filterType) return false;
      if (filterSignal !== 'all' && p.signal !== filterSignal) return false;
      return true;
    });
  }, [filterType, filterSignal]);

  // Group patterns by type for education view
  const groupedPatterns = useMemo(() => {
    const candlestick = allPatterns.filter(p => p.type === 'candlestick');
    const chart = allPatterns.filter(p => p.type === 'chart');
    return { candlestick, chart };
  }, [allPatterns]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={onBack}
                className="p-1.5 sm:p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="p-1.5 sm:p-2 bg-purple-500/20 rounded-lg">
                <CandlestickChart className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold text-white">Pattern Recognition</h1>
                <p className="text-xs sm:text-sm text-gray-400">Candlestick & Chart Patterns</p>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('detected')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  viewMode === 'detected'
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">Detected</span>
              </button>
              <button
                onClick={() => setViewMode('education')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  viewMode === 'education'
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Learn</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Controls Bar */}
        <div className="bg-gray-800 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                showFilters || filterType !== 'all' || filterSignal !== 'all'
                  ? 'bg-purple-900/50 text-purple-400 border border-purple-700'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {(filterType !== 'all' || filterSignal !== 'all') && (
                <span className="bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {(filterType !== 'all' ? 1 : 0) + (filterSignal !== 'all' ? 1 : 0)}
                </span>
              )}
            </button>

            {/* Stats */}
            <div className="ml-auto flex items-center gap-3 text-sm text-gray-400">
              {viewMode === 'detected' ? (
                <>
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    {detectedPatterns.length} pattern{detectedPatterns.length !== 1 ? 's' : ''} found
                  </span>
                  <span className="hidden sm:flex items-center gap-1">
                    <BarChart3 className="w-4 h-4" />
                    {priceHistory.length} daily candles
                  </span>
                </>
              ) : (
                <span className="flex items-center gap-1">
                  <BookOpen className="w-4 h-4" />
                  {allPatterns.length} patterns
                </span>
              )}
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-700">
              {/* Type Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Type:</span>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as PatternType | 'all')}
                  className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-purple-500"
                >
                  <option value="all">All</option>
                  <option value="candlestick">Candlestick</option>
                  <option value="chart">Chart</option>
                </select>
              </div>

              {/* Signal Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Signal:</span>
                <select
                  value={filterSignal}
                  onChange={(e) => setFilterSignal(e.target.value as PatternSignal | 'all')}
                  className="bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-purple-500"
                >
                  <option value="all">All</option>
                  <option value="bullish">Bullish</option>
                  <option value="bearish">Bearish</option>
                  <option value="neutral">Neutral</option>
                </select>
              </div>

              {/* Clear Filters */}
              {(filterType !== 'all' || filterSignal !== 'all') && (
                <button
                  onClick={() => {
                    setFilterType('all');
                    setFilterSignal('all');
                  }}
                  className="text-xs text-purple-400 hover:text-purple-300"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        {viewMode === 'detected' ? (
          <DetectedPatternsView
            patterns={detectedPatterns}
            expandedPattern={expandedPattern}
            setExpandedPattern={setExpandedPattern}
          />
        ) : (
          <EducationView
            groupedPatterns={groupedPatterns}
            expandedPattern={expandedPattern}
            setExpandedPattern={setExpandedPattern}
          />
        )}
      </main>
    </div>
  );
}

// Detected Patterns View
function DetectedPatternsView({
  patterns,
  expandedPattern,
  setExpandedPattern
}: {
  patterns: DetectedPattern[];
  expandedPattern: string | null;
  setExpandedPattern: (id: string | null) => void;
}) {
  if (patterns.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-8 text-center">
        <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <CandlestickChart className="w-8 h-8 text-gray-500" />
        </div>
        <h3 className="text-lg font-medium text-white mb-2">No Patterns Detected</h3>
        <p className="text-gray-400 text-sm max-w-md mx-auto">
          No recognizable candlestick or chart patterns found in the recent daily data.
          Patterns form when specific price action conditions are met — check back after more price movement.
        </p>
      </div>
    );
  }

  // Sort by most recent first
  const sortedPatterns = [...patterns].sort((a, b) => 
    b.detectedAt.getTime() - a.detectedAt.getTime()
  );

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-green-900/30 border border-green-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <span className="text-green-400 font-medium">Bullish</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {patterns.filter(p => p.signal === 'bullish').length}
          </p>
        </div>
        <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-5 h-5 text-red-400" />
            <span className="text-red-400 font-medium">Bearish</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {patterns.filter(p => p.signal === 'bearish').length}
          </p>
        </div>
        <div className="bg-gray-700/30 border border-gray-600/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Minus className="w-5 h-5 text-gray-400" />
            <span className="text-gray-400 font-medium">Neutral</span>
          </div>
          <p className="text-2xl font-bold text-white">
            {patterns.filter(p => p.signal === 'neutral').length}
          </p>
        </div>
      </div>

      {/* Pattern List */}
      <div className="space-y-3">
        {sortedPatterns.map((pattern) => (
          <DetectedPatternCard
            key={pattern.id}
            pattern={pattern}
            isExpanded={expandedPattern === pattern.id}
            onToggle={() => setExpandedPattern(
              expandedPattern === pattern.id ? null : pattern.id
            )}
          />
        ))}
      </div>
    </div>
  );
}

// Single Detected Pattern Card
function DetectedPatternCard({
  pattern,
  isExpanded,
  onToggle
}: {
  pattern: DetectedPattern;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const colors = SIGNAL_COLORS[pattern.signal];
  const reliabilityColor = RELIABILITY_COLORS[pattern.reliability];
  const SignalIcon = colors.icon;

  return (
    <div className={`${colors.bg} border ${colors.border} rounded-xl overflow-hidden`}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colors.bg}`}>
            <SignalIcon className={`w-5 h-5 ${colors.text}`} />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white">{pattern.name}</h3>
              <span className={`text-xs px-1.5 py-0.5 rounded ${reliabilityColor.bg} text-black font-medium`}>
                {pattern.reliability}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
                {pattern.type}
              </span>
            </div>
            <p className="text-sm text-gray-400">
              Detected at ${pattern.priceAtDetection.toFixed(2)} • {pattern.detectedAt.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className={`text-sm font-medium ${colors.text}`}>{pattern.targetMove}</p>
            <p className="text-xs text-gray-500">{pattern.successRate}% success</p>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 border-t border-gray-700/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Description */}
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-1.5">
                <Info className="w-4 h-4" />
                What is this pattern?
              </h4>
              <p className="text-sm text-gray-300">{pattern.description}</p>
            </div>

            {/* Expected Outcome */}
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-1.5">
                <Target className="w-4 h-4" />
                Expected Outcome
              </h4>
              <p className="text-sm text-gray-300">{pattern.outcome}</p>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Success Rate</p>
              <p className="text-lg font-bold text-white">{pattern.successRate}%</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Target Move</p>
              <p className={`text-lg font-bold ${colors.text}`}>{pattern.targetMove}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Timeframe</p>
              <p className="text-lg font-bold text-white">{pattern.timeframe}</p>
            </div>
            {pattern.confirmationLevel && (
              <div className="bg-gray-800/50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Confirmation Level</p>
                <p className="text-lg font-bold text-yellow-400">${pattern.confirmationLevel.toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Education View
function EducationView({
  groupedPatterns,
  expandedPattern,
  setExpandedPattern
}: {
  groupedPatterns: { candlestick: PatternDefinition[]; chart: PatternDefinition[] };
  expandedPattern: string | null;
  setExpandedPattern: (name: string | null) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 border border-purple-700/50 rounded-xl p-4 sm:p-6">
        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-purple-400" />
          Pattern Recognition Guide
        </h2>
        <p className="text-sm text-gray-300">
          Technical patterns are recurring formations in price charts that traders use to predict future price movements.
          Each pattern has a historical success rate and expected outcome. Use patterns in combination with other
          indicators for best results.
        </p>
      </div>

      {/* Candlestick Patterns */}
      {groupedPatterns.candlestick.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <CandlestickChart className="w-5 h-5 text-yellow-400" />
            Candlestick Patterns
            <span className="text-sm font-normal text-gray-500">
              ({groupedPatterns.candlestick.length})
            </span>
          </h3>
          <div className="space-y-3">
            {groupedPatterns.candlestick.map((pattern) => (
              <PatternEducationCard
                key={pattern.name}
                pattern={pattern}
                isExpanded={expandedPattern === pattern.name}
                onToggle={() => setExpandedPattern(
                  expandedPattern === pattern.name ? null : pattern.name
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* Chart Patterns */}
      {groupedPatterns.chart.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            <LineChart className="w-5 h-5 text-blue-400" />
            Chart Patterns
            <span className="text-sm font-normal text-gray-500">
              ({groupedPatterns.chart.length})
            </span>
          </h3>
          <div className="space-y-3">
            {groupedPatterns.chart.map((pattern) => (
              <PatternEducationCard
                key={pattern.name}
                pattern={pattern}
                isExpanded={expandedPattern === pattern.name}
                onToggle={() => setExpandedPattern(
                  expandedPattern === pattern.name ? null : pattern.name
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-medium text-yellow-400 mb-1">Important Disclaimer</h4>
          <p className="text-sm text-gray-400">
            Pattern success rates are based on historical data and do not guarantee future results.
            Always use proper risk management, set stop losses, and consider multiple factors before trading.
            Patterns work best when combined with support/resistance levels, volume analysis, and broader market context.
          </p>
        </div>
      </div>
    </div>
  );
}

// Single Pattern Education Card
function PatternEducationCard({
  pattern,
  isExpanded,
  onToggle
}: {
  pattern: PatternDefinition;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const colors = SIGNAL_COLORS[pattern.signal];
  const reliabilityColor = RELIABILITY_COLORS[pattern.reliability];
  const SignalIcon = colors.icon;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colors.bg}`}>
            <SignalIcon className={`w-5 h-5 ${colors.text}`} />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-white">{pattern.name}</h3>
              <span className={`text-xs px-1.5 py-0.5 rounded ${reliabilityColor.bg} text-black font-medium`}>
                {pattern.reliability}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                {pattern.signal}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {pattern.barsRequired} bar{pattern.barsRequired !== 1 ? 's' : ''} • {pattern.successRate}% success rate
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className={`text-sm font-medium ${colors.text}`}>{pattern.targetMove}</p>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-700">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {/* Description */}
            <div className="bg-gray-900/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-purple-400 mb-2 flex items-center gap-1.5">
                <Info className="w-4 h-4" />
                Pattern Description
              </h4>
              <p className="text-sm text-gray-300">{pattern.description}</p>
            </div>

            {/* Expected Outcome - THE KEY SECTION */}
            <div className={`${colors.bg} border ${colors.border} rounded-lg p-4`}>
              <h4 className={`text-sm font-medium ${colors.text} mb-2 flex items-center gap-1.5`}>
                <Target className="w-4 h-4" />
                Expected Short-Term Outcome
              </h4>
              <p className="text-sm text-gray-200">{pattern.outcome}</p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="bg-gray-900/50 rounded-lg p-3 text-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">{pattern.successRate}%</p>
              <p className="text-xs text-gray-500">Success Rate</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-3 text-center">
              <Target className={`w-5 h-5 ${colors.text} mx-auto mb-1`} />
              <p className={`text-lg font-bold ${colors.text}`}>{pattern.targetMove}</p>
              <p className="text-xs text-gray-500">Target Move</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-3 text-center">
              <Clock className="w-5 h-5 text-blue-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">{pattern.timeframe}</p>
              <p className="text-xs text-gray-500">Plays Out In</p>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-3 text-center">
              <Layers className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-white">{pattern.barsRequired}</p>
              <p className="text-xs text-gray-500">Bars Required</p>
            </div>
          </div>

          {/* Trading Tips */}
          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
            <h5 className="text-xs font-medium text-blue-400 mb-1">💡 Trading Tip</h5>
            <p className="text-xs text-gray-400">
              {pattern.signal === 'bullish' 
                ? `Look for this pattern near support levels or after extended downtrends for higher probability setups. Wait for confirmation before entering.`
                : pattern.signal === 'bearish'
                ? `Look for this pattern near resistance levels or after extended rallies for higher probability setups. Consider scaling into positions.`
                : `Use this pattern as a warning that the current trend may be weakening. Wait for a directional candle to confirm the next move.`
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
