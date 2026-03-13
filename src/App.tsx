import { useEffect } from 'react';
import { useState } from 'react';
import { useStore } from './hooks/useStore';
import { PriceDisplay } from './components/PriceDisplay';
import { FibonacciLevels } from './components/FibonacciLevels';
import { SignalsList } from './components/SignalsList';
import { PriceChart } from './components/PriceChart';
import { IntradayChart } from './components/IntradayChart';
import { LastSignalBanner } from './components/LastSignalBanner';
import { GoldProductsPage } from './pages/GoldProductsPage';
import { SettingsPage } from './pages/SettingsPage';
import { BuySignalsPage } from './pages/BuySignalsPage';
import { SellSignalsPage } from './pages/SellSignalsPage';
import { AnalysisPage } from './pages/AnalysisPage';
import { PatternsPage } from './pages/PatternsPage';
import { DonationPage } from './pages/DonationPage';
import { AdminPage } from './pages/AdminPage';
import { TIMEFRAMES } from './types/products';
import { Activity, Github, Layers, Clock, Settings, TrendingUp, TrendingDown, BarChart3, Gauge, CandlestickChart, Heart, ShieldCheck } from 'lucide-react';

type Page = 'signals' | 'products' | 'settings' | 'buy' | 'sell' | 'analysis' | 'patterns' | 'donate' | 'admin';

type ChartView = 'daily' | 'intraday';

function App() {
  const { startRealTimeUpdates, error, selectedRange, setSelectedRange } = useStore();
  const [currentPage, setCurrentPage] = useState<Page>('signals');
  const [chartView, setChartView] = useState<ChartView>('daily');

  useEffect(() => {
    const cleanup = startRealTimeUpdates();
    return cleanup;
  }, [startRealTimeUpdates]);

  if (currentPage === 'products') {
    return <GoldProductsPage onBack={() => setCurrentPage('signals')} />;
  }

  if (currentPage === 'settings') {
    return <SettingsPage onBack={() => setCurrentPage('signals')} />;
  }

  if (currentPage === 'buy') {
    return <BuySignalsPage onBack={() => setCurrentPage('signals')} />;
  }

  if (currentPage === 'sell') {
    return <SellSignalsPage onBack={() => setCurrentPage('signals')} />;
  }

  if (currentPage === 'analysis') {
    return <AnalysisPage onBack={() => setCurrentPage('signals')} />;
  }

  if (currentPage === 'patterns') {
    return <PatternsPage onBack={() => setCurrentPage('signals')} />;
  }

  if (currentPage === 'donate') {
    return <DonationPage onBack={() => setCurrentPage('signals')} />;
  }

  if (currentPage === 'admin') {
    return <AdminPage onBack={() => setCurrentPage('signals')} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-4">
          {/* Mobile: Stack vertically, Desktop: Side by side */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
            {/* Logo & Title */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-yellow-500/20 rounded-lg shrink-0">
                <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl font-bold text-white">Gold Fib Signals</h1>
                <p className="text-xs sm:text-sm text-gray-400 hidden min-[400px]:block">Fibonacci trading signals for XAU/USD</p>
              </div>
            </div>
            
            {/* Navigation Buttons */}
            <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-end">
              <button
                onClick={() => setCurrentPage('buy')}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-green-900/50 hover:bg-green-800/50 text-green-400 rounded-lg transition-colors border border-green-700/50 text-sm shrink-0"
                title="Buy Signals (BID)"
              >
                <TrendingUp className="w-4 h-4" />
                <span className="hidden min-[480px]:inline">Buy</span>
              </button>
              <button
                onClick={() => setCurrentPage('sell')}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-red-900/50 hover:bg-red-800/50 text-red-400 rounded-lg transition-colors border border-red-700/50 text-sm shrink-0"
                title="Sell Signals (ASK)"
              >
                <TrendingDown className="w-4 h-4" />
                <span className="hidden min-[480px]:inline">Sell</span>
              </button>
              <button
                onClick={() => setCurrentPage('patterns')}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-indigo-900/50 hover:bg-indigo-800/50 text-indigo-400 rounded-lg transition-colors border border-indigo-700/50 text-sm shrink-0"
                title="Pattern Recognition"
              >
                <CandlestickChart className="w-4 h-4" />
                <span className="hidden min-[480px]:inline">Patterns</span>
              </button>
              <button
                onClick={() => setCurrentPage('analysis')}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-purple-900/50 hover:bg-purple-800/50 text-purple-400 rounded-lg transition-colors border border-purple-700/50 text-sm shrink-0"
                title="Technical Analysis"
              >
                <Gauge className="w-4 h-4" />
                <span className="hidden lg:inline">Analysis</span>
              </button>
              <button
                onClick={() => setCurrentPage('donate')}
                className="p-1.5 sm:p-2 bg-pink-900/50 hover:bg-pink-800/50 text-pink-400 rounded-lg transition-colors shrink-0 border border-pink-700/50"
                title="Support Us"
              >
                <Heart className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={() => setCurrentPage('admin')}
                className="p-1.5 sm:p-2 bg-yellow-900/50 hover:bg-yellow-800/50 text-yellow-400 rounded-lg transition-colors shrink-0 border border-yellow-700/50"
                title="Admin"
              >
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={() => setCurrentPage('products')}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm shrink-0"
              >
                <Layers className="w-4 h-4" />
                <span className="hidden md:inline">Products</span>
              </button>
              <button
                onClick={() => setCurrentPage('settings')}
                className="p-1.5 sm:p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors shrink-0"
                title="Settings"
              >
                <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <a
                href="https://github.com/aidevbda-glitch/gold-fib-signals"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 sm:p-2 text-gray-400 hover:text-white transition-colors shrink-0"
              >
                <Github className="w-4 h-4 sm:w-5 sm:h-5" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-900/50 border-b border-red-800 px-4 py-3">
          <div className="max-w-7xl mx-auto">
            <p className="text-red-200 text-sm flex items-start gap-1.5"><span className="shrink-0">⚠️</span><span>{error}</span></p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Price & Chart */}
          <div className="lg:col-span-2 space-y-6">
            <PriceDisplay />
            
            {/* Last Signal Banner - shows most recent signal from last 3 days */}
            <LastSignalBanner />
            
            {/* Chart View Toggle */}
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-5 h-5 text-gray-400" />
                  <h3 className="text-sm font-medium text-white">Chart View</h3>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setChartView('daily')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      chartView === 'daily'
                        ? 'bg-yellow-500 text-black font-medium'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Daily
                  </button>
                  <button
                    onClick={() => setChartView('intraday')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      chartView === 'intraday'
                        ? 'bg-blue-500 text-white font-medium'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    Intraday
                  </button>
                </div>
              </div>

              {/* Timeframe Selector (only for daily view) */}
              {chartView === 'daily' && (
                <>
                  <div className="flex items-center gap-3 mb-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-400">Timeframe</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {TIMEFRAMES.map((tf) => (
                      <button
                        key={tf.value}
                        onClick={() => setSelectedRange(tf.value)}
                        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                          selectedRange === tf.value
                            ? 'bg-yellow-500 text-black font-medium'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        {tf.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {chartView === 'intraday' && (
                <div className="text-xs text-gray-500 flex items-start gap-1.5">
                  <span className="shrink-0">📊</span>
                  <div>
                    Real-time bid/ask data from Swissquote
                    <span className="block sm:inline">
                      <span className="hidden sm:inline"> • </span>
                      <span className="sm:hidden">• </span>
                      Updated every minute
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Chart */}
            {chartView === 'daily' ? <PriceChart /> : <IntradayChart />}
            <SignalsList />
          </div>

          {/* Right Column - Fibonacci Levels */}
          <div className="space-y-6">
            <FibonacciLevels />
            
            {/* Info Card */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-1.5"><span>📚</span><span>How It Works</span></h3>
              <div className="space-y-3 text-sm text-gray-300">
                <p>
                  This app analyzes Gold (XAU/USD) prices using <strong className="text-yellow-400">Fibonacci retracement</strong> levels 
                  to identify potential buy and sell opportunities.
                </p>
                <p>
                  <strong className="text-blue-400">Key Levels:</strong>
                </p>
                <div className="space-y-1 text-gray-400">
                  <div className="flex"><span className="w-14 shrink-0 font-bold">38.2%</span><span>Shallow retracement, strong trend</span></div>
                  <div className="flex"><span className="w-14 shrink-0 font-bold">50%</span><span>Psychological midpoint</span></div>
                  <div className="flex"><span className="w-14 shrink-0 font-bold">61.8%</span><span>Golden ratio, KEY reversal level</span></div>
                  <div className="flex"><span className="w-14 shrink-0 font-bold">78.6%</span><span>Deep retracement, higher risk</span></div>
                </div>
                <div className="flex gap-1.5 text-gray-500 text-xs mt-4">
                  <span className="shrink-0">⚠️</span>
                  <span>
                    This is for educational purposes only.
                    <span className="hidden sm:inline"> </span>
                    <br className="sm:hidden" />
                    Not financial advice.
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-1.5"><span>🔗</span><span>Explore More</span></h3>
              <button
                onClick={() => setCurrentPage('products')}
                className="w-full flex items-center gap-3 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-left"
              >
                <span className="text-2xl">🏦</span>
                <div>
                  <p className="font-medium text-white">Gold Products & Brokers</p>
                  <p className="text-xs text-gray-400">Compare Spot, Futures, ETFs, CFDs & more</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>Gold Fib Signals • Built with React + Vite</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
