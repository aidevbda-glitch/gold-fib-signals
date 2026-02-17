import { useState } from 'react';
import { GOLD_PRODUCTS, getBrokersByProduct } from '../data/goldProducts';
import { ProductCard } from '../components/ProductCard';
import { BrokerCard } from '../components/BrokerCard';
import type { GoldProductType } from '../types/products';
import { ArrowLeft, TrendingUp, Building2 } from 'lucide-react';

interface GoldProductsPageProps {
  onBack: () => void;
}

export function GoldProductsPage({ onBack }: GoldProductsPageProps) {
  const [selectedProduct, setSelectedProduct] = useState<GoldProductType>('spot');

  const selectedProductData = GOLD_PRODUCTS.find(p => p.type === selectedProduct);
  const brokers = getBrokersByProduct(selectedProduct);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Gold Trading Products</h1>
              <p className="text-sm text-gray-400">Compare different ways to trade gold</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Intro Section */}
        <div className="bg-gradient-to-r from-yellow-900/30 to-amber-900/20 border border-yellow-600/30 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <TrendingUp className="w-8 h-8 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Choose Your Gold Trading Style</h2>
              <p className="text-gray-300">
                Gold can be traded in many ways, each with different risk levels, holding periods, and broker requirements.
                Select a product type below to learn more and see recommended brokers.
              </p>
            </div>
          </div>
        </div>

        {/* Product Grid */}
        <section className="mb-12">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            🥇 Gold Product Types
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {GOLD_PRODUCTS.map((product) => (
              <ProductCard
                key={product.type}
                product={product}
                isSelected={selectedProduct === product.type}
                onClick={() => setSelectedProduct(product.type)}
              />
            ))}
          </div>
        </section>

        {/* Broker Section */}
        <section id="brokers">
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="w-6 h-6 text-yellow-400" />
            <div>
              <h2 className="text-lg font-bold text-white">
                Recommended Brokers for {selectedProductData?.name}
              </h2>
              <p className="text-sm text-gray-400">
                {brokers.length} broker{brokers.length !== 1 ? 's' : ''} offering this product
              </p>
            </div>
          </div>

          {brokers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {brokers.map((broker) => (
                <BrokerCard key={broker.id} broker={broker} />
              ))}
            </div>
          ) : (
            <div className="bg-gray-800 rounded-xl p-8 text-center">
              <p className="text-gray-400">No brokers listed for this product type yet.</p>
            </div>
          )}
        </section>

        {/* Disclaimer */}
        <div className="mt-12 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <p className="text-xs text-gray-500">
            <strong className="text-gray-400">Disclaimer:</strong> This information is for educational purposes only
            and should not be considered financial advice. Broker listings are not endorsements. Trading gold
            carries significant risk of loss. Always do your own research and consider consulting a licensed
            financial advisor before trading. Fees and features may change — verify current terms with brokers directly.
          </p>
        </div>
      </main>
    </div>
  );
}
