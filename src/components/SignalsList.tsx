import { useMemo } from 'react';
import { useStore } from '../hooks/useStore';
import { SignalCard } from './SignalCard';
import { GroupedSignalCard } from './GroupedSignalCard';
import { Bell, Trash2 } from 'lucide-react';
import type { TradingSignal } from '../types/trading';

interface GroupedSignal {
  type: 'BUY' | 'SELL';
  signals: TradingSignal[];
  count: number;
  latestSignal: TradingSignal;
  priceRange: { min: number; max: number };
  timeRange: { start: number; end: number };
}

type SignalGroupType = 'BUY' | 'SELL';

function groupConsecutiveSignals(signals: TradingSignal[]): (TradingSignal | GroupedSignal)[] {
  if (signals.length === 0) return [];

  // Filter out HOLD signals (they shouldn't exist, but just in case)
  const tradableSignals = signals.filter(s => s.type === 'BUY' || s.type === 'SELL');
  if (tradableSignals.length === 0) return [];

  const result: (TradingSignal | GroupedSignal)[] = [];
  let currentGroup: TradingSignal[] = [];
  let currentType: SignalGroupType | null = null;

  // Process signals in reverse order (newest first for display)
  const reversedSignals = [...tradableSignals].reverse();

  for (const signal of reversedSignals) {
    const signalType = signal.type as SignalGroupType;
    
    if (currentType === null) {
      // First signal
      currentType = signalType;
      currentGroup = [signal];
    } else if (signalType === currentType) {
      // Same type, add to group
      currentGroup.push(signal);
    } else {
      // Different type, finalize current group and start new one
      if (currentGroup.length === 1) {
        result.push(currentGroup[0]);
      } else {
        const prices = currentGroup.map(s => s.price);
        const times = currentGroup.map(s => s.timestamp);
        result.push({
          type: currentType,
          signals: currentGroup,
          count: currentGroup.length,
          latestSignal: currentGroup[0], // First in reversed order = most recent
          priceRange: { min: Math.min(...prices), max: Math.max(...prices) },
          timeRange: { start: Math.min(...times), end: Math.max(...times) },
        });
      }
      currentType = signalType;
      currentGroup = [signal];
    }
  }

  // Finalize last group
  if (currentGroup.length === 1) {
    result.push(currentGroup[0]);
  } else if (currentGroup.length > 1 && currentType) {
    const prices = currentGroup.map(s => s.price);
    const times = currentGroup.map(s => s.timestamp);
    result.push({
      type: currentType,
      signals: currentGroup,
      count: currentGroup.length,
      latestSignal: currentGroup[0],
      priceRange: { min: Math.min(...prices), max: Math.max(...prices) },
      timeRange: { start: Math.min(...times), end: Math.max(...times) },
    });
  }

  return result;
}

function isGroupedSignal(item: TradingSignal | GroupedSignal): item is GroupedSignal {
  return 'count' in item && 'signals' in item;
}

export function SignalsList() {
  const { signals, clearSignals } = useStore();

  // Group consecutive signals of the same type
  const groupedItems = useMemo(() => {
    return groupConsecutiveSignals(signals).slice(0, 10);
  }, [signals]);

  // Count total signals represented
  const totalSignalsShown = useMemo(() => {
    return groupedItems.reduce((acc, item) => {
      return acc + (isGroupedSignal(item) ? item.count : 1);
    }, 0);
  }, [groupedItems]);

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

      {groupedItems.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-gray-400 text-lg">No signals yet</p>
          <p className="text-gray-500 text-sm mt-2">
            Signals are generated when price approaches key Fibonacci levels
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedItems.map((item) => (
            isGroupedSignal(item) ? (
              <GroupedSignalCard key={`group-${item.latestSignal.id}`} group={item} />
            ) : (
              <SignalCard key={item.id} signal={item} />
            )
          ))}
        </div>
      )}

      {signals.length > totalSignalsShown && (
        <p className="text-center text-gray-500 text-sm mt-4">
          Showing latest {totalSignalsShown} of {signals.length} signals
        </p>
      )}
    </div>
  );
}
