import type { TradingSignal } from '../types/trading';
import { format } from 'date-fns';
import { TrendingUp, TrendingDown, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { useState } from 'react';
import { SignalCard } from './SignalCard';

interface GroupedSignal {
  type: 'BUY' | 'SELL';
  signals: TradingSignal[];
  count: number;
  latestSignal: TradingSignal;
  priceRange: { min: number; max: number };
  timeRange: { start: number; end: number };
}

interface GroupedSignalCardProps {
  group: GroupedSignal;
}

export function GroupedSignalCard({ group }: GroupedSignalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAllSignals, setShowAllSignals] = useState(false);

  const isBuy = group.type === 'BUY';
  
  const bgGradient = isBuy 
    ? 'from-green-900/50 to-green-800/30 border-green-500/50'
    : 'from-red-900/50 to-red-800/30 border-red-500/50';
  
  const iconColor = isBuy ? 'text-green-400' : 'text-red-400';
  const countBg = isBuy ? 'bg-green-500' : 'bg-red-500';
  const Icon = isBuy ? TrendingUp : TrendingDown;

  // Get the strongest signal in the group
  const strengthOrder = { STRONG: 3, MODERATE: 2, WEAK: 1 };
  const strongestSignal = group.signals.reduce((best, signal) => {
    return strengthOrder[signal.strength] > strengthOrder[best.strength] ? signal : best;
  }, group.signals[0]);

  const strengthBadge = {
    STRONG: 'bg-yellow-500 text-black',
    MODERATE: 'bg-blue-500 text-white',
    WEAK: 'bg-gray-500 text-white',
  }[strongestSignal.strength];

  const priceSpread = group.priceRange.max - group.priceRange.min;
  const avgPrice = (group.priceRange.max + group.priceRange.min) / 2;

  return (
    <div className={`bg-gradient-to-r ${bgGradient} border-2 rounded-xl overflow-hidden transition-all duration-300`}>
      {/* Header */}
      <div 
        className="p-4 cursor-pointer flex items-center justify-between"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          {/* Icon with counter badge */}
          <div className="relative">
            <div className={`p-3 rounded-full ${isBuy ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              <Icon className={`w-6 h-6 ${iconColor}`} />
            </div>
            {/* Counter badge */}
            <div className={`absolute -top-1 -right-1 ${countBg} text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-lg`}>
              {group.count}
            </div>
          </div>
          
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-bold ${iconColor}`}>
                {group.type}
              </span>
              <span className={`px-2 py-0.5 text-xs font-bold rounded ${strengthBadge}`}>
                {strongestSignal.strength}
              </span>
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-600 text-gray-200 flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {group.count}x
              </span>
            </div>
            <p className="text-gray-400 text-sm">
              ${group.priceRange?.min?.toFixed(2) ?? 'N/A'} - ${group.priceRange?.max?.toFixed(2) ?? 'N/A'} • {format(group.timeRange?.start ?? Date.now(), 'HH:mm')} - {format(group.timeRange?.end ?? Date.now(), 'HH:mm')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm text-gray-400">Price Spread</p>
            <p className="text-white font-medium">${priceSpread?.toFixed(2) ?? 'N/A'}</p>
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
          {/* Summary Stats */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-gray-800/50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">Signals</p>
              <p className="text-white font-bold text-lg">{group.count}</p>
            </div>
            <div className="bg-gray-800/50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">Avg Price</p>
              <p className="text-white font-medium">${avgPrice?.toFixed(2) ?? 'N/A'}</p>
            </div>
            <div className="bg-gray-800/50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">Price Range</p>
              <p className="text-white font-medium">${priceSpread?.toFixed(2) ?? 'N/A'}</p>
            </div>
            <div className="bg-gray-800/50 p-3 rounded-lg">
              <p className="text-xs text-gray-500 uppercase">Latest Fib</p>
              <p className="text-white font-medium">{group.latestSignal.fibLevel}</p>
            </div>
          </div>

          {/* Strength Distribution */}
          <div className="mt-4 p-3 bg-gray-800/30 rounded-lg">
            <p className="text-xs text-gray-500 uppercase mb-2">Signal Strength Distribution</p>
            <div className="flex gap-2">
              {['STRONG', 'MODERATE', 'WEAK'].map((strength) => {
                const count = group.signals.filter(s => s.strength === strength).length;
                if (count === 0) return null;
                const badge = {
                  STRONG: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
                  MODERATE: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
                  WEAK: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
                }[strength];
                return (
                  <span key={strength} className={`px-2 py-1 text-xs font-medium rounded border ${badge}`}>
                    {strength}: {count}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Toggle to show individual signals */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAllSignals(!showAllSignals);
            }}
            className="mt-4 w-full py-2 text-sm text-gray-400 hover:text-white bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
          >
            {showAllSignals ? 'Hide Individual Signals' : `Show All ${group.count} Signals`}
          </button>

          {/* Individual signals */}
          {showAllSignals && (
            <div className="mt-3 space-y-2 max-h-96 overflow-y-auto">
              {group.signals.map((signal) => (
                <SignalCard key={signal.id} signal={signal} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
