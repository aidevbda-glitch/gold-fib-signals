import type { Broker } from '../types/products';
import { Star, ExternalLink, Check, X } from 'lucide-react';

interface BrokerCardProps {
  broker: Broker;
}

export function BrokerCard({ broker }: BrokerCardProps) {
  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`w-4 h-4 ${i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
        />
      );
    }
    return stars;
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-yellow-500/50 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white">{broker.name}</h3>
          <div className="flex items-center gap-1 mt-1">
            {renderStars(broker.rating)}
            <span className="text-sm text-gray-400 ml-1">({broker.rating})</span>
          </div>
        </div>
        <a
          href={broker.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-medium rounded-lg transition-colors"
        >
          Visit <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Description */}
      <p className="text-gray-400 text-sm mb-4">{broker.description}</p>

      {/* Key Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {broker.minDeposit !== undefined && (
          <div className="bg-gray-700/50 rounded-lg p-2">
            <p className="text-xs text-gray-500">Min. Deposit</p>
            <p className="text-white font-medium">
              {broker.minDeposit === 0 ? 'None' : `$${broker.minDeposit}`}
            </p>
          </div>
        )}
        {broker.spread && (
          <div className="bg-gray-700/50 rounded-lg p-2">
            <p className="text-xs text-gray-500">Spread</p>
            <p className="text-white font-medium">{broker.spread}</p>
          </div>
        )}
        {broker.commission && (
          <div className="bg-gray-700/50 rounded-lg p-2">
            <p className="text-xs text-gray-500">Commission</p>
            <p className="text-white font-medium">{broker.commission}</p>
          </div>
        )}
        {broker.leverage && (
          <div className="bg-gray-700/50 rounded-lg p-2">
            <p className="text-xs text-gray-500">Leverage</p>
            <p className="text-white font-medium">{broker.leverage}</p>
          </div>
        )}
      </div>

      {/* Regulation */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-1">Regulation</p>
        <div className="flex flex-wrap gap-1">
          {broker.regulation.map((reg) => (
            <span
              key={reg}
              className="px-2 py-0.5 bg-blue-900/30 text-blue-400 text-xs rounded"
            >
              {reg}
            </span>
          ))}
        </div>
      </div>

      {/* Pros & Cons */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-green-400 mb-1 font-medium">Pros</p>
          <ul className="space-y-1">
            {broker.pros.slice(0, 3).map((pro, i) => (
              <li key={i} className="flex items-start gap-1 text-xs text-gray-300">
                <Check className="w-3 h-3 text-green-400 mt-0.5 shrink-0" />
                {pro}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs text-red-400 mb-1 font-medium">Cons</p>
          <ul className="space-y-1">
            {broker.cons.slice(0, 2).map((con, i) => (
              <li key={i} className="flex items-start gap-1 text-xs text-gray-300">
                <X className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                {con}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
