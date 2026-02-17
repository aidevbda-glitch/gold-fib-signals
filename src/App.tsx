import { useEffect } from 'react';
import { useStore } from './hooks/useStore';
import { PriceDisplay } from './components/PriceDisplay';
import { FibonacciLevels } from './components/FibonacciLevels';
import { SignalsList } from './components/SignalsList';
import { PriceChart } from './components/PriceChart';
import { Activity, Github } from 'lucide-react';

function App() {
  const { startRealTimeUpdates, error } = useStore();

  useEffect(() => {
    const cleanup = startRealTimeUpdates();
    return cleanup;
  }, [startRealTimeUpdates]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Activity className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Gold Fib Signals</h1>
                <p className="text-sm text-gray-400">Fibonacci-based trading signals for XAU/USD</p>
              </div>
            </div>
            
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <Github className="w-5 h-5" />
            </a>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-900/50 border-b border-red-800 px-4 py-3">
          <div className="max-w-7xl mx-auto">
            <p className="text-red-200 text-sm">⚠️ {error}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Price & Chart */}
          <div className="lg:col-span-2 space-y-6">
            <PriceDisplay />
            <PriceChart />
            <SignalsList />
          </div>

          {/* Right Column - Fibonacci Levels */}
          <div className="space-y-6">
            <FibonacciLevels />
            
            {/* Info Card */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-white mb-3">📚 How It Works</h3>
              <div className="space-y-3 text-sm text-gray-300">
                <p>
                  This app analyzes Gold (XAU/USD) prices using <strong className="text-yellow-400">Fibonacci retracement</strong> levels 
                  to identify potential buy and sell opportunities.
                </p>
                <p>
                  <strong className="text-blue-400">Key Levels:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li><strong>38.2%</strong> - Shallow retracement, strong trend</li>
                  <li><strong>50%</strong> - Psychological midpoint</li>
                  <li><strong>61.8%</strong> - Golden ratio, KEY reversal level</li>
                  <li><strong>78.6%</strong> - Deep retracement, higher risk</li>
                </ul>
                <p className="text-gray-500 text-xs mt-4">
                  ⚠️ This is for educational purposes only. Not financial advice.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>Gold Fib Signals • Built with React + Vite</p>
          <p className="mt-1">Data refreshes every 5 seconds • Using mock data for demo</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
