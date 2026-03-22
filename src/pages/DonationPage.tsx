import { useState, useEffect } from 'react';
import { ArrowLeft, Heart, Trophy, Users, Target, Coffee, DollarSign, Sparkles } from 'lucide-react';

interface DonationPageProps {
  onBack: () => void;
}

interface DonationStats {
  totalCount: number;
  totalAmount: number;
  averageAmount: number;
  largestDonation: number | null;
}

interface DonationGoal {
  target: number;
  current: number;
  description: string;
  percentage: string;
}

interface RecentDonation {
  id: string;
  amount: number;
  currency: string;
  donor_name: string;
  message: string | null;
  created_at: string;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const DONATION_TIERS = [
  { amount: 5, label: 'Coffee', emoji: '☕', description: 'Buy us a coffee' },
  { amount: 10, label: 'Supporter', emoji: '⭐', description: 'Show your support' },
  { amount: 25, label: 'Champion', emoji: '🏆', description: 'Champion supporter' },
  { amount: 50, label: 'Hero', emoji: '🦸', description: 'Trading hero' },
  { amount: 100, label: 'Legend', emoji: '👑', description: 'Legendary supporter' },
];

export function DonationPage({ onBack }: DonationPageProps) {
  const [stats, setStats] = useState<DonationStats | null>(null);
  const [goal, setGoal] = useState<DonationGoal | null>(null);
  const [recentDonations, setRecentDonations] = useState<RecentDonation[]>([]);
  const [selectedAmount, setSelectedAmount] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [_isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDonationData();
  }, []);

  const fetchDonationData = async () => {
    try {
      const [statsRes, goalRes, recentRes] = await Promise.all([
        fetch(`${API_BASE}/donations/stats`),
        fetch(`${API_BASE}/donations/goal`),
        fetch(`${API_BASE}/donations/recent?limit=5`)
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.data);
      }
      if (goalRes.ok) {
        const data = await goalRes.json();
        setGoal(data.data);
      }
      if (recentRes.ok) {
        const data = await recentRes.json();
        setRecentDonations(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch donation data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDonate = (amount: number) => {
    // This would typically redirect to Stripe/PayPal checkout
    // For now, we'll show an alert
    const donationAmount = customAmount ? parseFloat(customAmount) : amount;
    alert(`Thank you! Redirecting to payment for $${donationAmount}...\n\n(Payment integration coming soon)`);
    
    // TODO: Integrate with Stripe or PayPal
    // window.location.href = `https://stripe.com/checkout?amount=${donationAmount * 100}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gradient-to-r from-pink-900/50 to-gray-900 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-pink-500/20 rounded-lg">
                <Heart className="w-6 h-6 text-pink-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Support Gold Fib Signals</h1>
                <p className="text-sm text-gray-400">Help keep this project running</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Goal Progress */}
        {goal && (
          <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/20 border border-yellow-700/30 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-5 h-5 text-yellow-400" />
              <h2 className="text-lg font-bold text-yellow-400">Donation Goal</h2>
            </div>
            <p className="text-gray-300 mb-4">{goal.description}</p>
            
            <div className="relative h-4 bg-gray-700 rounded-full overflow-hidden mb-2">
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, parseFloat(goal.percentage))}%` }}
              />
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">${goal.current.toLocaleString()} raised</span>
              <span className="text-yellow-400">{goal.percentage}%</span>
              <span className="text-gray-400">${goal.target.toLocaleString()} goal</span>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-gray-800 rounded-xl p-4 text-center">
              <Users className="w-5 h-5 text-blue-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-white">{stats.totalCount}</p>
              <p className="text-xs text-gray-500">Total Donations</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 text-center">
              <DollarSign className="w-5 h-5 text-green-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-white">${stats.totalAmount.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Total Raised</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 text-center">
              <Coffee className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-white">${stats.averageAmount.toFixed(0)}</p>
              <p className="text-xs text-gray-500">Average</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 text-center">
              <Trophy className="w-5 h-5 text-purple-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-white">${stats.largestDonation || 0}</p>
              <p className="text-xs text-gray-500">Largest</p>
            </div>
          </div>
        )}

        {/* Donation Tiers */}
        <div className="bg-gray-800 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            Choose an Amount
          </h3>
          
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
            {DONATION_TIERS.map((tier) => (
              <button
                key={tier.amount}
                onClick={() => {
                  setSelectedAmount(tier.amount);
                  setCustomAmount('');
                }}
                className={`p-4 rounded-xl text-center transition-all ${
                  selectedAmount === tier.amount && !customAmount
                    ? 'bg-pink-600 text-white ring-2 ring-pink-400'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                }`}
              >
                <span className="text-2xl block mb-1">{tier.emoji}</span>
                <span className="text-lg font-bold">${tier.amount}</span>
                <span className="text-xs text-gray-400 block">{tier.label}</span>
              </button>
            ))}
          </div>

          {/* Custom Amount */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-gray-400">Or enter custom:</span>
            <div className="relative flex-1 max-w-[150px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setSelectedAmount(0);
                }}
                placeholder="0.00"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-7 pr-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          {/* Donate Button */}
          <button
            onClick={() => handleDonate(customAmount ? parseFloat(customAmount) : selectedAmount)}
            className="w-full py-4 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-lg"
          >
            <Heart className="w-5 h-5" />
            Donate ${customAmount || selectedAmount}
          </button>

          <p className="text-center text-gray-500 text-sm mt-3">
            Secure payment via Stripe • No account required
          </p>
        </div>

        {/* Recent Donors */}
        {recentDonations.length > 0 && (
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-pink-400" />
              Recent Supporters
            </h3>
            
            <div className="space-y-3">
              {recentDonations.map((donation) => (
                <div key={donation.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-pink-500/20 rounded-full flex items-center justify-center">
                      <Heart className="w-5 h-5 text-pink-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{donation.donor_name || 'Anonymous'}</p>
                      {donation.message && (
                        <p className="text-sm text-gray-400 italic">"{donation.message}"</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-400">${donation.amount}</p>
                    <p className="text-xs text-gray-500">{formatDate(donation.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Why Donate */}
        <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
          <h4 className="font-medium text-white mb-2 flex items-center gap-1.5">
            <span>❤️</span>
            <span>Why Support Us?</span>
          </h4>
          <ul className="text-sm text-gray-400 space-y-2">
            <li className="flex items-start gap-2">
              <span className="shrink-0">💰</span>
              <span>Keep the app free for everyone</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="shrink-0">🚀</span>
              <span>Fund new features and improvements</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="shrink-0">🖥️</span>
              <span>Cover server and API costs</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="shrink-0">☕</span>
              <span>Buy the dev team coffee to keep coding!</span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
