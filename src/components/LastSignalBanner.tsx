import { useStore } from '../hooks/useStore';
import { TrendingUp, TrendingDown, Clock, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function LastSignalBanner() {
  const { signals } = useStore();

  // Get the most recent signal
  const lastSignal = signals.length > 0 ? signals[signals.length - 1] : null;

  if (!lastSignal) {
    return null;
  }

  // Check if signal is recent (within 24 hours)
  const isRecent = Date.now() - lastSignal.timestamp < 24 * 60 * 60 * 1000;
  const isBuy = lastSignal.type === 'BUY';

  const bgColor = isBuy
    ? 'from-green-900/60 to-green-800/40 border-green-500/60'
    : 'from-red-900/60 to-red-800/40 border-red-500/60';

  const iconColor = isBuy ? 'text-green-400' : 'text-red-400';
  const Icon = isBuy ? TrendingUp : TrendingDown;

  const strengthBadge = {
    STRONG: 'bg-yellow-500 text-black',
    MODERATE: 'bg-blue-500 text-white',
    WEAK: 'bg-gray-500 text-white',
  }[lastSignal.strength];

  return (
    <div className={`bg-gradient-to-r ${bgColor} border rounded-xl p-4 mb-6`}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Left: Signal info */}
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${isBuy ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
          
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Last Signal:</span>
              <span className={`text-xl font-bold ${iconColor}`}>
                {lastSignal.type}
              </span>
              <span className={`px-2 py-0.5 text-xs font-bold rounded ${strengthBadge}`}>
                {lastSignal.strength}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>${lastSignal.price?.toFixed(2) ?? 'N/A'}</span>
              <span>•</span>
              <span>Fib {lastSignal.fibLevel ?? 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Right: Time info */}
        <div className="flex items-center gap-2 text-sm">
          {isRecent ? (
            <Clock className="w-4 h-4 text-blue-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
          )}
          <span className={isRecent ? 'text-blue-400' : 'text-yellow-400'}>
            {formatDistanceToNow(lastSignal.timestamp, { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Trend direction indicator */}
      {lastSignal.technicalDetails && (
        <div className="mt-2 pt-2 border-t border-gray-700/50 flex items-center gap-4 text-xs text-gray-400">
          <span>
            Trend: <span className={
              lastSignal.technicalDetails.trendDirection === 'UP' ? 'text-green-400' :
              lastSignal.technicalDetails.trendDirection === 'DOWN' ? 'text-red-400' :
              'text-gray-400'
            }>{lastSignal.technicalDetails.trendDirection}</span>
          </span>
          <span>•</span>
          <span>
            Distance to Fib: ${lastSignal.technicalDetails?.distanceToLevel?.toFixed(2) ?? 'N/A'}
          </span>
        </div>
      )}
    </div>
  );
}
