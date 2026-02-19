import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Check, X, RefreshCw, TestTube, Save, Settings2, TrendingUp, Megaphone } from 'lucide-react';
import type { ApiProvider, RefreshSettings } from '../types/settings';
import { REFRESH_INTERVALS } from '../types/settings';

interface FibonacciSettings {
  repricingMode: 'weekly' | 'daily' | 'on_breakout' | 'manual';
  lookbackPeriod: number;
  primaryTimeframe: 'daily' | 'weekly' | '4h';
  autoRecalcOnBreakout: boolean;
  lastRecalculated: number | null;
  swingHigh: number | null;
  swingLow: number | null;
}

interface AdSettings {
  adsEnabled: boolean;
  adsensePublisherId: string;
  placements: {
    header: { enabled: boolean; slot: string };
    sidebar: { enabled: boolean; slot: string };
    content: { enabled: boolean; slot: string };
    footer: { enabled: boolean; slot: string };
  };
}

const REPRICING_MODES = {
  weekly: { label: 'Weekly', description: 'Recalculate at start of each week (recommended)' },
  daily: { label: 'Daily', description: 'Recalculate at start of each day' },
  on_breakout: { label: 'On Breakout', description: 'Recalculate when price breaks swing high/low' },
  manual: { label: 'Manual', description: 'Only recalculate on user request' },
};

const LOOKBACK_PERIODS = [
  { value: 20, label: '20 days', description: 'Short-term swings' },
  { value: 50, label: '50 days', description: 'Medium-term swings (recommended)' },
  { value: 100, label: '100 days', description: 'Long-term swings' },
  { value: 200, label: '200 days', description: 'Major swings' },
];

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [providers, setProviders] = useState<ApiProvider[]>([]);
  const [refreshSettings, setRefreshSettings] = useState<RefreshSettings | null>(null);
  const [fibSettings, setFibSettings] = useState<FibonacciSettings | null>(null);
  const [adSettings, setAdSettings] = useState<AdSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [_editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);

  // Form state for adding/editing
  const [formData, setFormData] = useState({
    name: '',
    endpoint: '',
    apiKey: '',
    requestType: 'GET' as 'GET' | 'POST',
    symbolFormat: 'XAU',
    currencyFormat: 'USD',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const [providersRes, refreshRes, fibRes, adRes] = await Promise.all([
        fetch(`${API_BASE}/settings/providers`),
        fetch(`${API_BASE}/settings/refresh`),
        fetch(`${API_BASE}/settings/fibonacci`),
        fetch(`${API_BASE}/ads/settings`),
      ]);

      if (providersRes.ok) {
        const data = await providersRes.json();
        setProviders(data.data || []);
      }

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setRefreshSettings(data.data);
      }

      if (fibRes.ok) {
        const data = await fibRes.json();
        setFibSettings(data.data);
      }

      if (adRes.ok) {
        const data = await adRes.json();
        setAdSettings(data.data);
      }
    } catch (err) {
      setError('Failed to load settings');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProvider = async () => {
    try {
      const response = await fetch(`${API_BASE}/settings/providers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setProviders([data.data, ...providers]);
        setShowAddForm(false);
        resetForm();
      } else {
        const err = await response.json();
        setError(err.error || 'Failed to add provider');
      }
    } catch (err) {
      setError('Failed to add provider');
    }
  };

  const handleUpdateProvider = async (id: string, updates: Partial<ApiProvider>) => {
    try {
      const response = await fetch(`${API_BASE}/settings/providers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        setProviders(providers.map(p => p.id === id ? data.data : p));
        setEditingId(null);
      }
    } catch (err) {
      setError('Failed to update provider');
    }
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API provider?')) return;

    try {
      const response = await fetch(`${API_BASE}/settings/providers/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setProviders(providers.filter(p => p.id !== id));
      }
    } catch (err) {
      setError('Failed to delete provider');
    }
  };

  const handleTestProvider = async (id: string) => {
    setTestingId(id);
    setTestResult(null);

    try {
      const response = await fetch(`${API_BASE}/settings/providers/${id}/test`, {
        method: 'POST',
      });

      const data = await response.json();
      setTestResult({
        id,
        success: data.success,
        message: data.message,
      });
    } catch (err) {
      setTestResult({
        id,
        success: false,
        message: 'Connection test failed',
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleUpdateRefresh = async (interval: string) => {
    const intervalData = REFRESH_INTERVALS[interval as keyof typeof REFRESH_INTERVALS];
    
    try {
      const response = await fetch(`${API_BASE}/settings/refresh`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interval,
          intervalMs: intervalData.ms,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setRefreshSettings(data.data);
      }
    } catch (err) {
      setError('Failed to update refresh settings');
    }
  };

  const handleUpdateFibSettings = async (updates: Partial<FibonacciSettings>) => {
    try {
      const response = await fetch(`${API_BASE}/settings/fibonacci`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        setFibSettings(data.data);
      }
    } catch (err) {
      setError('Failed to update Fibonacci settings');
    }
  };

  const handleRecalculateFib = async () => {
    setIsRecalculating(true);
    try {
      const response = await fetch(`${API_BASE}/settings/fibonacci/recalculate`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setFibSettings(data.data);
      }
    } catch (err) {
      setError('Failed to trigger recalculation');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleUpdateAdSettings = async (updates: Partial<AdSettings>) => {
    try {
      const response = await fetch(`${API_BASE}/ads/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        setAdSettings(data.data);
      }
    } catch (err) {
      setError('Failed to update ad settings');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      endpoint: '',
      apiKey: '',
      requestType: 'GET',
      symbolFormat: 'XAU',
      currencyFormat: 'USD',
    });
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 4) + '••••••••' + key.slice(-4);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <Settings2 className="w-6 h-6 text-yellow-400" />
              <div>
                <h1 className="text-xl font-bold text-white">Settings</h1>
                <p className="text-sm text-gray-400">Manage API providers and app configuration</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 flex items-center justify-between">
            <p className="text-red-200">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* API Providers Section */}
        <section className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white">API Data Providers</h2>
              <p className="text-sm text-gray-400">Configure gold price data sources</p>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-yellow-500 hover:bg-yellow-400 text-black font-medium rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Provider
            </button>
          </div>

          {/* Add Provider Form */}
          {showAddForm && (
            <div className="bg-gray-700/50 rounded-lg p-4 mb-4 border border-gray-600">
              <h3 className="font-medium text-white mb-4">Add New API Provider</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Provider Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., GoldAPI.io"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Request Type</label>
                  <select
                    value={formData.requestType}
                    onChange={(e) => setFormData({ ...formData, requestType: e.target.value as 'GET' | 'POST' })}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-yellow-500 focus:outline-none"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">API Endpoint</label>
                  <input
                    type="text"
                    value={formData.endpoint}
                    onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                    placeholder="https://www.goldapi.io/api/:symbol/:currency"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-yellow-500 focus:outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">Use :symbol and :currency as placeholders</p>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm text-gray-400 mb-1">API Key</label>
                  <input
                    type="password"
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    placeholder="Your API key"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Symbol Format</label>
                  <input
                    type="text"
                    value={formData.symbolFormat}
                    onChange={(e) => setFormData({ ...formData, symbolFormat: e.target.value })}
                    placeholder="XAU"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Currency Format</label>
                  <input
                    type="text"
                    value={formData.currencyFormat}
                    onChange={(e) => setFormData({ ...formData, currencyFormat: e.target.value })}
                    placeholder="USD"
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-yellow-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => { setShowAddForm(false); resetForm(); }}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddProvider}
                  disabled={!formData.name || !formData.endpoint || !formData.apiKey}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Save Provider
                </button>
              </div>
            </div>
          )}

          {/* Providers List */}
          {isLoading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : providers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 mb-2">No API providers configured</p>
              <p className="text-sm text-gray-500">Using Yahoo Finance (free) as default</p>
            </div>
          ) : (
            <div className="space-y-3">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  className={`bg-gray-700/50 rounded-lg p-4 border ${
                    provider.isActive ? 'border-green-500/50' : 'border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white">{provider.name}</h3>
                        {provider.isActive && (
                          <span className="px-2 py-0.5 bg-green-900/50 text-green-400 text-xs rounded-full shrink-0">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mt-1 font-mono truncate" title={provider.endpoint}>
                        {provider.endpoint}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        API Key: {maskApiKey(provider.apiKey)} • {provider.requestType}
                      </p>
                      
                      {/* Test Result */}
                      {testResult && testResult.id === provider.id && (
                        <div className={`mt-2 text-sm ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                          {testResult.success ? '✅' : '❌'} {testResult.message}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      <button
                        onClick={() => handleTestProvider(provider.id)}
                        disabled={testingId === provider.id}
                        className="p-1.5 sm:p-2 text-blue-400 hover:bg-blue-900/30 rounded-lg transition-colors"
                        title="Test connection"
                      >
                        {testingId === provider.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <TestTube className="w-4 h-4" />
                        )}
                      </button>
                      
                      {!provider.isActive && (
                        <button
                          onClick={() => handleUpdateProvider(provider.id, { isActive: true })}
                          className="p-1.5 sm:p-2 text-green-400 hover:bg-green-900/30 rounded-lg transition-colors"
                          title="Set as active"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleDeleteProvider(provider.id)}
                        className="p-1.5 sm:p-2 text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 p-3 bg-gray-700/30 rounded-lg">
            <p className="text-xs text-gray-500 flex items-start gap-1.5">
              <span className="shrink-0">💡</span>
              <span><strong>Tip:</strong> If no provider is active, the app uses Yahoo Finance (free) as the default data source.</span>
            </p>
          </div>
        </section>

        {/* Refresh Settings Section */}
        <section className="bg-gray-800 rounded-xl p-6">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-white">Data Refresh Interval</h2>
            <p className="text-sm text-gray-400">How often to fetch new price data</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(REFRESH_INTERVALS).map(([key, { label }]) => (
              <button
                key={key}
                onClick={() => handleUpdateRefresh(key)}
                className={`p-3 rounded-lg border transition-all ${
                  refreshSettings?.interval === key
                    ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                    : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:border-gray-500'
                }`}
              >
                <p className="font-medium">{label}</p>
              </button>
            ))}
          </div>

          {refreshSettings?.lastRefresh && (
            <p className="text-xs text-gray-500 mt-4">
              Last refresh: {new Date(refreshSettings.lastRefresh).toLocaleString()}
            </p>
          )}
        </section>

        {/* Fibonacci Settings Section */}
        <section className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-yellow-400" />
              <div>
                <h2 className="text-lg font-bold text-white">Fibonacci Repricing</h2>
                <p className="text-sm text-gray-400">Configure when Fibonacci levels are recalculated</p>
              </div>
            </div>
            <button
              onClick={handleRecalculateFib}
              disabled={isRecalculating}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-600 text-black font-medium rounded-lg transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRecalculating ? 'animate-spin' : ''}`} />
              Recalculate Now
            </button>
          </div>

          {/* Repricing Mode */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-white mb-3">Repricing Mode</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(REPRICING_MODES).map(([key, { label, description }]) => (
                <button
                  key={key}
                  onClick={() => handleUpdateFibSettings({ repricingMode: key as FibonacciSettings['repricingMode'] })}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    fibSettings?.repricingMode === key
                      ? 'bg-yellow-500/20 border-yellow-500'
                      : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <p className={`font-medium ${fibSettings?.repricingMode === key ? 'text-yellow-400' : 'text-white'}`}>
                    {label}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Lookback Period */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-white mb-3">Lookback Period</h3>
            <p className="text-xs text-gray-400 mb-3">Number of days to analyze for finding swing high/low points</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {LOOKBACK_PERIODS.map(({ value, label, description }) => (
                <button
                  key={value}
                  onClick={() => handleUpdateFibSettings({ lookbackPeriod: value })}
                  className={`p-3 rounded-lg border transition-all ${
                    fibSettings?.lookbackPeriod === value
                      ? 'bg-blue-500/20 border-blue-500'
                      : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <p className={`font-medium ${fibSettings?.lookbackPeriod === value ? 'text-blue-400' : 'text-white'}`}>
                    {label}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Auto Recalc on Breakout */}
          <div className="flex items-center justify-between gap-3 p-4 bg-gray-700/30 rounded-lg">
            <div className="min-w-0">
              <p className="font-medium text-white text-sm sm:text-base">Auto-recalculate on Breakout</p>
              <p className="text-xs text-gray-400 mt-1">
                Automatically recalculate when price breaks above swing high or below swing low
              </p>
            </div>
            {/* Mobile: Icon toggle, Desktop: Slider toggle */}
            <button
              onClick={() => handleUpdateFibSettings({ autoRecalcOnBreakout: !fibSettings?.autoRecalcOnBreakout })}
              className={`shrink-0 flex items-center justify-center w-8 h-8 sm:w-10 sm:h-6 rounded-lg sm:rounded-full transition-colors relative ${
                fibSettings?.autoRecalcOnBreakout 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-600 text-gray-400'
              }`}
              title={fibSettings?.autoRecalcOnBreakout ? 'Enabled' : 'Disabled'}
            >
              {/* Mobile: Show icon */}
              <span className="sm:hidden">
                {fibSettings?.autoRecalcOnBreakout ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <X className="w-4 h-4" />
                )}
              </span>
              {/* Desktop: Slider dot */}
              <span className={`hidden sm:block absolute w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
                fibSettings?.autoRecalcOnBreakout ? 'translate-x-2' : '-translate-x-2'
              }`} />
            </button>
          </div>

          {/* Last Recalculated Info */}
          {fibSettings?.lastRecalculated && (
            <p className="text-xs text-gray-500 mt-4">
              Last recalculated: {new Date(fibSettings.lastRecalculated).toLocaleString()}
            </p>
          )}

          {/* Best Practices Info */}
          <div className="mt-4 p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
            <h4 className="text-sm font-medium text-blue-400 mb-2 flex items-center gap-1.5"><span>📚</span><span>Best Practices</span></h4>
            <div className="text-xs text-gray-300 space-y-1.5">
              <div className="flex gap-2"><span className="shrink-0">•</span><span><strong>Weekly repricing</strong> is recommended for position/swing trading gold</span></div>
              <div className="flex gap-2"><span className="shrink-0">•</span><span><strong>50-day lookback</strong> captures medium-term swings effectively</span></div>
              <div className="flex gap-2"><span className="shrink-0">•</span><span>Fibonacci levels gain strength when multiple timeframes align</span></div>
              <div className="flex gap-2"><span className="shrink-0">•</span><span>Recalculate manually after significant market events</span></div>
            </div>
          </div>
        </section>

        {/* Ad Settings */}
        <section className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-orange-400" />
            Advertisement Settings
          </h2>
          <p className="text-gray-400 text-sm mb-4">
            Configure Google AdSense integration and ad placements throughout the app.
          </p>

          {/* Master Toggle */}
          <div className="flex items-center justify-between gap-3 p-4 bg-gray-700/30 rounded-lg mb-4">
            <div className="min-w-0">
              <p className="font-medium text-white">Enable Advertisements</p>
              <p className="text-xs text-gray-400 mt-1">
                Show ads throughout the app to generate revenue
              </p>
            </div>
            <button
              onClick={() => handleUpdateAdSettings({ adsEnabled: !adSettings?.adsEnabled })}
              className={`shrink-0 flex items-center justify-center w-10 h-6 rounded-full transition-colors relative ${
                adSettings?.adsEnabled ? 'bg-green-500' : 'bg-gray-600'
              }`}
            >
              <span className={`absolute w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${
                adSettings?.adsEnabled ? 'translate-x-2' : '-translate-x-2'
              }`} />
            </button>
          </div>

          {/* AdSense Publisher ID */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Google AdSense Publisher ID
            </label>
            <input
              type="text"
              value={adSettings?.adsensePublisherId || ''}
              onChange={(e) => handleUpdateAdSettings({ adsensePublisherId: e.target.value })}
              placeholder="ca-pub-XXXXXXXXXXXXXXXX"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Ad Placements */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-white">Ad Placements</h3>
            
            {/* Header Ad */}
            <div className="p-3 bg-gray-700/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">Header Banner</span>
                <button
                  onClick={() => handleUpdateAdSettings({ 
                    placements: { 
                      ...adSettings?.placements, 
                      header: { ...adSettings?.placements?.header, enabled: !adSettings?.placements?.header?.enabled } 
                    } 
                  } as Partial<AdSettings>)}
                  className={`w-8 h-5 rounded-full transition-colors relative ${
                    adSettings?.placements?.header?.enabled ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                >
                  <span className={`absolute w-3 h-3 bg-white rounded-full top-1 transition-transform ${
                    adSettings?.placements?.header?.enabled ? 'translate-x-4' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <input
                type="text"
                value={adSettings?.placements?.header?.slot || ''}
                onChange={(e) => handleUpdateAdSettings({ 
                  placements: { 
                    ...adSettings?.placements, 
                    header: { ...adSettings?.placements?.header, slot: e.target.value } 
                  } 
                } as Partial<AdSettings>)}
                placeholder="Ad slot ID"
                className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
              />
            </div>

            {/* Sidebar Ad */}
            <div className="p-3 bg-gray-700/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">Sidebar Ad</span>
                <button
                  onClick={() => handleUpdateAdSettings({ 
                    placements: { 
                      ...adSettings?.placements, 
                      sidebar: { ...adSettings?.placements?.sidebar, enabled: !adSettings?.placements?.sidebar?.enabled } 
                    } 
                  } as Partial<AdSettings>)}
                  className={`w-8 h-5 rounded-full transition-colors relative ${
                    adSettings?.placements?.sidebar?.enabled ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                >
                  <span className={`absolute w-3 h-3 bg-white rounded-full top-1 transition-transform ${
                    adSettings?.placements?.sidebar?.enabled ? 'translate-x-4' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <input
                type="text"
                value={adSettings?.placements?.sidebar?.slot || ''}
                onChange={(e) => handleUpdateAdSettings({ 
                  placements: { 
                    ...adSettings?.placements, 
                    sidebar: { ...adSettings?.placements?.sidebar, slot: e.target.value } 
                  } 
                } as Partial<AdSettings>)}
                placeholder="Ad slot ID"
                className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
              />
            </div>

            {/* Content Ad */}
            <div className="p-3 bg-gray-700/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">Between Content</span>
                <button
                  onClick={() => handleUpdateAdSettings({ 
                    placements: { 
                      ...adSettings?.placements, 
                      content: { ...adSettings?.placements?.content, enabled: !adSettings?.placements?.content?.enabled } 
                    } 
                  } as Partial<AdSettings>)}
                  className={`w-8 h-5 rounded-full transition-colors relative ${
                    adSettings?.placements?.content?.enabled ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                >
                  <span className={`absolute w-3 h-3 bg-white rounded-full top-1 transition-transform ${
                    adSettings?.placements?.content?.enabled ? 'translate-x-4' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <input
                type="text"
                value={adSettings?.placements?.content?.slot || ''}
                onChange={(e) => handleUpdateAdSettings({ 
                  placements: { 
                    ...adSettings?.placements, 
                    content: { ...adSettings?.placements?.content, slot: e.target.value } 
                  } 
                } as Partial<AdSettings>)}
                placeholder="Ad slot ID"
                className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
              />
            </div>

            {/* Footer Ad */}
            <div className="p-3 bg-gray-700/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">Footer Banner</span>
                <button
                  onClick={() => handleUpdateAdSettings({ 
                    placements: { 
                      ...adSettings?.placements, 
                      footer: { ...adSettings?.placements?.footer, enabled: !adSettings?.placements?.footer?.enabled } 
                    } 
                  } as Partial<AdSettings>)}
                  className={`w-8 h-5 rounded-full transition-colors relative ${
                    adSettings?.placements?.footer?.enabled ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                >
                  <span className={`absolute w-3 h-3 bg-white rounded-full top-1 transition-transform ${
                    adSettings?.placements?.footer?.enabled ? 'translate-x-4' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <input
                type="text"
                value={adSettings?.placements?.footer?.slot || ''}
                onChange={(e) => handleUpdateAdSettings({ 
                  placements: { 
                    ...adSettings?.placements, 
                    footer: { ...adSettings?.placements?.footer, slot: e.target.value } 
                  } 
                } as Partial<AdSettings>)}
                placeholder="Ad slot ID"
                className="w-full bg-gray-600 border border-gray-500 rounded px-2 py-1 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div className="mt-4 p-3 bg-orange-900/20 border border-orange-700/30 rounded-lg">
            <p className="text-xs text-orange-300 flex items-start gap-1.5">
              <span className="shrink-0">💡</span>
              <span>
                To use Google AdSense, create an account at <a href="https://www.google.com/adsense" target="_blank" rel="noopener noreferrer" className="underline">google.com/adsense</a>, 
                add your site, and copy the Publisher ID and Ad Slot IDs here.
              </span>
            </p>
          </div>
        </section>

        {/* Default GoldAPI.io Configuration */}
        <section className="bg-gradient-to-r from-yellow-900/30 to-amber-900/20 border border-yellow-600/30 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-3">🔑 Quick Setup: GoldAPI.io</h2>
          <p className="text-gray-300 text-sm mb-4">
            To use GoldAPI.io, click "Add Provider" above and use these settings:
          </p>
          <div className="bg-gray-800/50 rounded-lg p-4 font-mono text-sm space-y-1 overflow-hidden">
            <p><span className="text-gray-500">Name:</span> <span className="text-yellow-400">GoldAPI.io</span></p>
            <p className="truncate" title="https://www.goldapi.io/api/:symbol/:currency"><span className="text-gray-500">Endpoint:</span> <span className="text-blue-400">https://www.goldapi.io/api/:symbol/:currency</span></p>
            <p><span className="text-gray-500">Request Type:</span> <span className="text-green-400">GET</span></p>
            <p><span className="text-gray-500">Symbol:</span> <span className="text-white">XAU</span></p>
            <p><span className="text-gray-500">Currency:</span> <span className="text-white">USD</span></p>
          </div>
        </section>
      </main>
    </div>
  );
}
