import type { GoldProduct } from '../types/products';
import { AlertTriangle, Clock, Check, Info } from 'lucide-react';

interface ProductCardProps {
  product: GoldProduct;
  isSelected: boolean;
  onClick: () => void;
}

export function ProductCard({ product, isSelected, onClick }: ProductCardProps) {
  const riskColors = {
    'Low': 'bg-green-900/30 text-green-400 border-green-600/30',
    'Medium': 'bg-yellow-900/30 text-yellow-400 border-yellow-600/30',
    'High': 'bg-orange-900/30 text-orange-400 border-orange-600/30',
    'Very High': 'bg-red-900/30 text-red-400 border-red-600/30',
  };

  return (
    <div
      onClick={onClick}
      className={`bg-gray-800 rounded-xl p-5 cursor-pointer transition-all border-2 ${
        isSelected
          ? 'border-yellow-500 ring-2 ring-yellow-500/20'
          : 'border-transparent hover:border-gray-600'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{product.icon}</span>
          <div>
            <h3 className="text-lg font-bold text-white">{product.name}</h3>
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${riskColors[product.riskLevel]}`}>
              {product.riskLevel} Risk
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-gray-400 text-sm mb-4">{product.description}</p>

      {/* Holding Period */}
      <div className="flex items-center gap-2 text-sm text-gray-300 mb-4">
        <Clock className="w-4 h-4 text-gray-500" />
        <span>Typical hold: {product.typicalHoldingPeriod}</span>
      </div>

      {/* Suitable For */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Best For</p>
        <div className="flex flex-wrap gap-1">
          {product.suitableFor.map((s, i) => (
            <span key={i} className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Key Features */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Key Features</p>
        <ul className="space-y-1">
          {product.keyFeatures.slice(0, 3).map((feature, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
              <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {/* Considerations */}
      <div>
        <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Consider</p>
        <ul className="space-y-1">
          {product.considerations.slice(0, 2).map((consideration, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
              <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
              {consideration}
            </li>
          ))}
        </ul>
      </div>

      {isSelected && (
        <div className="mt-4 pt-4 border-t border-gray-700 flex items-center gap-2 text-yellow-400 text-sm">
          <Info className="w-4 h-4" />
          <span>Scroll down to see recommended brokers</span>
        </div>
      )}
    </div>
  );
}
