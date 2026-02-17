import { useStore } from '../hooks/useStore';
import { SignalCard } from './SignalCard';
import { Bell, Trash2 } from 'lucide-react';

export function SignalsList() {
  const { signals, clearSignals } = useStore();

  const recentSignals = [...signals].reverse().slice(0, 10);

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-bold text-white">Trading Signals</h3>
          {signals.length > 0 && (
            <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-sm rounded-full">
              {signals.length}
            </span>
          )}
        </div>
        
        {signals.length > 0 && (
          <button
            onClick={clearSignals}
            className="flex items-center gap-1 px-3 py-1 text-sm text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {recentSignals.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-gray-400 text-lg">No signals yet</p>
          <p className="text-gray-500 text-sm mt-2">
            Signals are generated when price approaches key Fibonacci levels
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {recentSignals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}

      {signals.length > 10 && (
        <p className="text-center text-gray-500 text-sm mt-4">
          Showing latest 10 of {signals.length} signals
        </p>
      )}
    </div>
  );
}
