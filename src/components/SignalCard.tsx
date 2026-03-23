import type { TradingSignal } from '../types/trading';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface SignalCardProps {
  signal: TradingSignal;
}

export function SignalCard({ signal }: SignalCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isBuy = signal.type === 'BUY';
  
  const bgGradient = isBuy 
    ? 'from-green-900/40 to-green-800/20 border-green-500/40'
    : 'from-red-900/40 to-red-800/20 border-red-500/40';
  
  const iconColor = isBuy ? 'text-green-400' : 'text-red-400';
  const Icon = isBuy ? TrendingUp : TrendingDown;

  const strengthBadge = {
    STRONG: 'bg-yellow-500 text-black',
    MODERATE: 'bg-blue-500 text-white',
    WEAK: 'bg-gray-500 text-white',
  }[signal.strength];

  return (
    <div className={`bg-gradient-to-r ${bgGradient} border rounded-xl overflow-hidden transition-all duration-300`}>
      {/* Header */}
      <div 
        className="p-4 cursor-pointer flex items-center justify-between"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-full ${isBuy ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
            <Icon className={`w-6 h-6 ${iconColor}`} />
          </div>
          
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${iconColor}`}>
                {signal.type}
              </span>
              <span className={`px-2 py-0.5 text-xs font-bold rounded ${strengthBadge}`}>
                {signal.strength}
              </span>
            </div>
            <p className="text-gray-400 text-sm">
              at ${signal.price?.toFixed(2) ?? 'N/A'} • {format(signal.timestamp, 'HH:mm:ss')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm text-gray-400">Fib Level</p>
            <p className="text-white font-medium">{signal.fibLevel}</p>
          </div>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-700/50">
          {/* Explanation */}
          <div className="mt-4 p-4 bg-gray-800/50 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Signal Explanation
            </h4>
            <div className="text-sm text-gray-300 whitespace-pre-line leading-relaxed">
              {signal.explanation}
            </div>
          </div>

          {/* Technical Details */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-800/30 p-3 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">Price</p>
              <p className="text-white font-medium">${signal.technicalDetails?.currentPrice?.toFixed(2) ?? 'N/A'}</p>
            </div>
            <div className="bg-gray-800/30 p-3 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">Nearest Fib</p>
              <p className="text-white font-medium">{signal.technicalDetails.nearestFibLevel}</p>
            </div>
            <div className="bg-gray-800/30 p-3 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">Distance</p>
              <p className="text-white font-medium">${signal.technicalDetails?.distanceToLevel?.toFixed(2) ?? 'N/A'}</p>
            </div>
            <div className="bg-gray-800/30 p-3 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">Trend</p>
              <p className={`font-medium ${
                signal.technicalDetails.trendDirection === 'UP' ? 'text-green-400' :
                signal.technicalDetails.trendDirection === 'DOWN' ? 'text-red-400' :
                'text-gray-400'
              }`}>
                {signal.technicalDetails.trendDirection}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
