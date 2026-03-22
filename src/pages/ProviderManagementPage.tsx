import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  RefreshCw, 
  TestTube, 
  Save, 
  Settings2, 
  Activity,
  Server,
  HeartPulse,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Clock,
  Shield,
  Eye,
  EyeOff,
  History,
  Zap
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface Provider {
  id: string;
  name: string;
  type: 'rest' | 'websocket';
  endpoint: string;
  requestType: 'GET' | 'POST';
  headers: Record<string, string>;
  authType: 'none' | 'header' | 'query';
  apiKeyHeader?: string;
  apiKey?: string;
  isActive: boolean;
  priority: number;
  rateLimitPerMinute: number;
  timeoutMs: number;
  supportsHistorical: boolean;
  supportsIntraday: boolean;
  responseFormat: {
    pricePath: string;
    bidPath?: string;
    askPath?: string;
    timestampPath?: string;
    symbolPath?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ProviderHealth {
  providerId: string;
  status: 'up' | 'down' | 'unknown';
  responseTimeMs: number | null;
  lastCheckAt: number | null;
  consecutiveFailures: number;
}

interface ProviderUsage {
  providerId: string;
  totalRequests: number;
  totalSuccess: number;
  totalErrors: number;
  avgResponseTime: number;
  successRate: number;
}

interface ProviderWithStats extends Provider {
  health: ProviderHealth;
  usage: ProviderUsage;
}

interface DashboardData {
  providers: ProviderWithStats[];
  summary: {
    totalProviders: number;
    activeProviders: number;
    healthyProviders: number;
    recentFallbacks24h: number;
  };
}

interface FallbackEvent {
  id: number;
  timestamp: number;
  failedProviderId: string;
  failedProviderName: string;
  fallbackProviderId: string;
  fallbackProviderName: string;
  reason: string;
}

interface HealthCheckResult {
  providerId: string;
  providerName: string;
  status: 'up' | 'down';
  responseTime: number;
  success: boolean;
  error?: string;
}

interface ProviderFormData {
  name: string;
  endpoint: string;
  requestType: 'GET' | 'POST';
  authType: 'none' | 'header' | 'query';
  apiKeyHeader: string;
  apiKey: string;
  headers: string;
  pricePath: string;
  bidPath: string;
  askPath: string;
  timestampPath: string;
  priority: number;
  rateLimitPerMinute: number;
  timeoutMs: number;
  supportsHistorical: boolean;
  supportsIntraday: boolean;
}

interface ProviderManagementPageProps {
  onBack: () => void;
}

const defaultFormData: ProviderFormData = {
  name: '',
  endpoint: '',
  requestType: 'GET',
  authType: 'none',
  apiKeyHeader: 'Authorization',
  apiKey: '',
  headers: '{}',
  pricePath: 'price',
  bidPath: '',
  askPath: '',
  timestampPath: '',
  priority: 99,
  rateLimitPerMinute: 60,
  timeoutMs: 5000,
  supportsHistorical: false,
  supportsIntraday: false,
};

export function ProviderManagementPage({ onBack }: ProviderManagementPageProps) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [fallbacks, setFallbacks] = useState<FallbackEvent[]>([]);
  const [healthResults, setHealthResults] = useState<HealthCheckResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [showHealthCheck, setShowHealthCheck] = useState(false);
  const [showFallbackHistory, setShowFallbackHistory] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState<ProviderFormData>(defaultFormData);
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Testing state
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/providers/dashboard`);
      if (response.ok) {
        const data = await response.json();
        setDashboard(data.data);
      } else {
        setError('Failed to load provider dashboard');
      }
    } catch (err) {
      setError('Connection error');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFallbacks = async () => {
    try {
      const response = await fetch(`${API_BASE}/providers/fallbacks`);
      if (response.ok) {
        const data = await response.json();
        setFallbacks(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch fallbacks:', err);
    }
  };

  const runHealthChecks = async () => {
    setShowHealthCheck(true);
    setHealthResults(null);
    try {
      const response = await fetch(`${API_BASE}/providers/health/check`);
      if (response.ok) {
        const data = await response.json();
        setHealthResults(data.data);
      }
    } catch (err) {
      console.error('Health check failed:', err);
    }
  };

  const handleToggleProvider = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch(`${API_BASE}/providers/${id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (response.ok) {
        await fetchDashboard();
      }
    } catch (err) {
      setError('Failed to toggle provider');
    }
  };

  const handleUpdatePriority = async (id: string, newPriority: number) => {
    try {
      const response = await fetch(`${API_BASE}/providers/${id}/priority`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority }),
      });
      if (response.ok) {
        await fetchDashboard();
      }
    } catch (err) {
      setError('Failed to update priority');
    }
  };

  const handleTestProvider = async (id: string) => {
    setTestingId(id);
    setTestResults(prev => ({ ...prev, [id]: { success: true, message: 'Testing...' } }));
    
    try {
      const response = await fetch(`${API_BASE}/providers/${id}/test`, {
        method: 'POST',
      });
      const data = await response.json();
      setTestResults(prev => ({ 
        ...prev, 
        [id]: { 
          success: data.data?.success || false, 
          message: data.data?.success 
            ? `Connected (${data.data?.responseTime}ms)` 
            : data.data?.error || 'Connection failed'
        } 
      }));
    } catch (err) {
      setTestResults(prev => ({ 
        ...prev, 
        [id]: { success: false, message: 'Connection error' }
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm('Are you sure you want to delete this provider?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/providers/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        await fetchDashboard();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete provider');
      }
    } catch (err) {
      setError('Failed to delete provider');
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      let headers: Record<string, string> = {};
      try {
        headers = JSON.parse(formData.headers);
      } catch (e) {
        setError('Invalid JSON in headers field');
        setIsSubmitting(false);
        return;
      }

      const providerData = {
        ...formData,
        headers,
        type: 'rest' as const,
        responseFormat: {
          pricePath: formData.pricePath,
          bidPath: formData.bidPath || undefined,
          askPath: formData.askPath || undefined,
          timestampPath: formData.timestampPath || undefined,
        },
      };

      if (editingProvider) {
        const response = await fetch(`${API_BASE}/providers/${editingProvider.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(providerData),
        });
        if (response.ok) {
          await fetchDashboard();
          closeForm();
        } else {
          const data = await response.json();
          setError(data.error || 'Failed to update provider');
        }
      } else {
        // Generate ID from name for new providers
        const id = formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const response = await fetch(`${API_BASE}/providers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...providerData, id }),
        });
        if (response.ok) {
          await fetchDashboard();
          closeForm();
        } else {
          const data = await response.json();
          setError(data.error || 'Failed to add provider');
        }
      }
    } catch (err) {
      setError('Failed to save provider');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditForm = (provider: Provider) => {
    setEditingProvider(provider);
    setFormData({
      name: provider.name,
      endpoint: provider.endpoint,
      requestType: provider.requestType,
      authType: provider.authType,
      apiKeyHeader: provider.apiKeyHeader || 'Authorization',
      apiKey: provider.apiKey || '',
      headers: JSON.stringify(provider.headers || {}, null, 2),
      pricePath: provider.responseFormat?.pricePath || 'price',
      bidPath: provider.responseFormat?.bidPath || '',
      askPath: provider.responseFormat?.askPath || '',
      timestampPath: provider.responseFormat?.timestampPath || '',
      priority: provider.priority,
      rateLimitPerMinute: provider.rateLimitPerMinute,
      timeoutMs: provider.timeoutMs,
      supportsHistorical: provider.supportsHistorical,
      supportsIntraday: provider.supportsIntraday,
    });
    setShowAddForm(true);
  };

  const closeForm = () => {
    setShowAddForm(false);
    setEditingProvider(null);
    setFormData(defaultFormData);
    setShowApiKey(false);
    setError(null);
  };

  const openFallbackHistory = async () => {
    await fetchFallbacks();
    setShowFallbackHistory(true);
  };

  const maskApiKey = (key?: string) => {
    if (!key || key.length <= 8) return '••••••••';
    return key.slice(0, 4) + '••••••••' + key.slice(-4);
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'up': return 'text-green-400 bg-green-500/20';
      case 'down': return 'text-red-400 bg-red-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'up': return <HeartPulse className="w-4 h-4" />;
      case 'down': return <AlertTriangle className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  // Render
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gradient-to-r from-yellow-900/50 to-gray-900 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 hover:bg-gray-800 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <Server className="w-6 h-6 text-yellow-400" />
                <div>
                  <h1 className="text-lg font-bold">Provider Management</h1>
                  <p className="text-sm text-gray-400">Manage data sources and health monitoring</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={runHealthChecks}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg"
              >
                <HeartPulse className="w-4 h-4" />
                Health Check
              </button>
              <button
                onClick={openFallbackHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg"
              >
                <History className="w-4 h-4" />
                Fallbacks
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 flex items-center justify-between">
            <p className="text-red-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Dashboard Stats */}
        {dashboard?.summary && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Providers</p>
                  <p className="text-2xl font-bold text-white">{dashboard.summary.totalProviders}</p>
                </div>
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Server className="w-5 h-5 text-blue-400" />
                </div>
              </div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Active</p>
                  <p className="text-2xl font-bold text-green-400">{dashboard.summary.activeProviders}</p>
                </div>
                <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-green-400" />
                </div>
              </div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Healthy</p>
                  <p className="text-2xl font-bold text-blue-400">{dashboard.summary.healthyProviders}</p>
                </div>
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <HeartPulse className="w-5 h-5 text-blue-400" />
                </div>
              </div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Fallbacks (24h)</p>
                  <p className="text-2xl font-bold text-orange-400">{dashboard.summary.recentFallbacks24h}</p>
                </div>
                <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <History className="w-5 h-5 text-orange-400" />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Provider List */}
        <section className="bg-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-yellow-400" />
                Data Providers
              </h2>
              <p className="text-sm text-gray-400">Configure and manage price data sources</p>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-yellow-500 hover:bg-yellow-400 text-black font-medium rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Add Provider
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-500" />
            </div>
          ) : dashboard?.providers.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Server className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium text-white mb-2">No providers configured</p>
              <p className="text-sm text-gray-500 mb-6">Add a provider to get started</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-medium rounded-lg"
                >
                  <Plus className="w-4 h-4" />
                  Add Your First Provider
                </button>
                <button
                  onClick={onBack}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Admin
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {dashboard?.providers.map((provider, index) => (
                <div
                  key={provider.id}
                  className={`bg-gray-700/50 rounded-lg p-4 border ${
                    provider.isActive ? 'border-green-500/30' : 'border-gray-600'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Priority Controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleUpdatePriority(provider.id, Math.max(1, provider.priority - 1))}
                        className="p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-white"
                        disabled={index === 0}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <span className="w-6 text-center text-sm font-mono text-gray-400">
                        {provider.priority}
                      </span>
                      <button
                        onClick={() => handleUpdatePriority(provider.id, provider.priority + 1)}
                        className="p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-white"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Provider Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-medium text-white">{provider.name}</h3>
                        <span className="px-2 py-0.5 bg-gray-600 text-gray-300 text-xs rounded">
                          {provider.type}
                        </span>
                        {provider.isActive && (
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                            Active
                          </span>
                        )}
                        <span className={`px-2 py-0.5 text-xs rounded-full flex items-center gap-1 ${getHealthColor(provider.health?.status || 'unknown')}`}>
                          {getHealthIcon(provider.health?.status || 'unknown')}
                          {provider.health?.status || 'unknown'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 font-mono truncate mt-1">
                        {provider.endpoint}
                      </p>
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                        <span>{provider.requestType}</span>
                        <span>•</span>
                        <span>Auth: {provider.authType}</span>
                        <span>•</span>
                        <span>API Key: {maskApiKey(provider.apiKey)}</span>
                        {provider.supportsHistorical && (
                          <>
                            <span>•</span>
                            <span className="text-blue-400">Historical</span>
                          </>
                        )}
                        {provider.supportsIntraday && (
                          <>
                            <span>•</span>
                            <span className="text-purple-400">Intraday</span>
                          </>
                        )}
                      </div>
                      
                      {/* Stats Row */}
                      <div className="flex flex-wrap gap-4 mt-2 text-xs">
                        <span className="text-gray-400">
                          Response: {provider.health?.responseTimeMs ? `${provider.health.responseTimeMs}ms` : 'N/A'}
                        </span>
                        {provider.usage?.successRate !== undefined && (
                          <span className={provider.usage.successRate > 90 ? 'text-green-400' : provider.usage.successRate > 70 ? 'text-yellow-400' : 'text-red-400'}>
                            Success: {provider.usage.successRate}%
                          </span>
                        )}
                        {provider.health?.consecutiveFailures > 0 && (
                          <span className="text-red-400">
                            Failures: {provider.health.consecutiveFailures}
                          </span>
                        )}
                      </div>

                      {/* Test Result */}
                      {testResults[provider.id] && (
                        <div className={`mt-2 text-sm ${testResults[provider.id].success ? 'text-green-400' : 'text-red-400'}`}>
                          {testResults[provider.id].success ? '✅' : '❌'} {testResults[provider.id].message}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Toggle */}
                      <button
                        onClick={() => handleToggleProvider(provider.id, !provider.isActive)}
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          provider.isActive ? 'bg-green-500' : 'bg-gray-600'
                        }`}
                      >
                        <span className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-transform ${
                          provider.isActive ? 'translate-x-6' : 'translate-x-0.5'
                        }`} />
                      </button>

                      <button
                        onClick={() => handleTestProvider(provider.id)}
                        disabled={testingId === provider.id}
                        className="p-2 text-blue-400 hover:bg-blue-900/30 rounded-lg"
                        title="Test connection"
                      >
                        {testingId === provider.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <TestTube className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        onClick={() => openEditForm(provider)}
                        className="p-2 text-yellow-400 hover:bg-yellow-900/30 rounded-lg"
                        title="Edit"
                      >
                        <Settings2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteProvider(provider.id)}
                        className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg"
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
        </section>
      </main>

      {/* Add/Edit Provider Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">
                {editingProvider ? 'Edit Provider' : 'Add New Provider'}
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., GoldAPI.io"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Request Type</label>
                  <select
                    value={formData.requestType}
                    onChange={(e) => setFormData({ ...formData, requestType: e.target.value as 'GET' | 'POST' })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-yellow-500 focus:outline-none"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Endpoint *</label>
                <input
                  type="text"
                  value={formData.endpoint}
                  onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                  placeholder="https://api.example.com/gold/price"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-yellow-500 focus:outline-none"
                />
              </div>

              {/* Auth Settings */}
              <div className="border border-gray-700 rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Authentication
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Auth Type</label>
                    <select
                      value={formData.authType}
                      onChange={(e) => setFormData({ ...formData, authType: e.target.value as 'none' | 'header' | 'query' })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-yellow-500 focus:outline-none"
                    >
                      <option value="none">None</option>
                      <option value="header">Header</option>
                      <option value="query">Query Param</option>
                    </select>
                  </div>
                  {formData.authType === 'header' && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Header Name</label>
                      <input
                        type="text"
                        value={formData.apiKeyHeader}
                        onChange={(e) => setFormData({ ...formData, apiKeyHeader: e.target.value })}
                        placeholder="Authorization"
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-yellow-500 focus:outline-none"
                      />
                    </div>
                  )}
                  {formData.authType !== 'none' && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">API Key</label>
                      <div className="relative">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={formData.apiKey}
                          onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                          placeholder="Your API key"
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 pr-10 text-white focus:border-yellow-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Headers JSON */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Headers (JSON)</label>
                <textarea
                  value={formData.headers}
                  onChange={(e) => setFormData({ ...formData, headers: e.target.value })}
                  placeholder='{"Content-Type": "application/json"}'
                  rows={3}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white font-mono text-sm focus:border-yellow-500 focus:outline-none"
                />
              </div>

              {/* Response Format */}
              <div className="border border-gray-700 rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-medium text-gray-300">Response Format Paths</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Price Path *</label>
                    <input
                      type="text"
                      value={formData.pricePath}
                      onChange={(e) => setFormData({ ...formData, pricePath: e.target.value })}
                      placeholder="data.price"
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-yellow-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Bid Path</label>
                    <input
                      type="text"
                      value={formData.bidPath}
                      onChange={(e) => setFormData({ ...formData, bidPath: e.target.value })}
                      placeholder="data.bid"
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-yellow-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Ask Path</label>
                    <input
                      type="text"
                      value={formData.askPath}
                      onChange={(e) => setFormData({ ...formData, askPath: e.target.value })}
                      placeholder="data.ask"
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-yellow-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Timestamp Path</label>
                    <input
                      type="text"
                      value={formData.timestampPath}
                      onChange={(e) => setFormData({ ...formData, timestampPath: e.target.value })}
                      placeholder="data.timestamp"
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-yellow-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Settings */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Priority</label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 99 })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Rate Limit/min</label>
                  <input
                    type="number"
                    value={formData.rateLimitPerMinute}
                    onChange={(e) => setFormData({ ...formData, rateLimitPerMinute: parseInt(e.target.value) || 60 })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-yellow-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Timeout (ms)</label>
                  <input
                    type="number"
                    value={formData.timeoutMs}
                    onChange={(e) => setFormData({ ...formData, timeoutMs: parseInt(e.target.value) || 5000 })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:border-yellow-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.supportsHistorical}
                    onChange={(e) => setFormData({ ...formData, supportsHistorical: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-yellow-500 focus:ring-yellow-500"
                  />
                  <span className="text-sm text-gray-300">Supports Historical Data</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.supportsIntraday}
                    onChange={(e) => setFormData({ ...formData, supportsIntraday: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-yellow-500 focus:ring-yellow-500"
                  />
                  <span className="text-sm text-gray-300">Supports Intraday</span>
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={closeForm}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !formData.name || !formData.endpoint}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-medium rounded-lg"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {editingProvider ? 'Update' : 'Add'} Provider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Health Check Modal */}
      {showHealthCheck && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <HeartPulse className="w-5 h-5 text-blue-400" />
                Health Check Results
              </h2>
              <button onClick={() => setShowHealthCheck(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              {!healthResults ? (
                <div className="text-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                  <p className="mt-3 text-gray-400">Running health checks...</p>
                </div>
              ) : healthResults.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-yellow-400" />
                  <p className="text-lg font-medium text-white mb-2">No Active Providers Found</p>
                  <p className="text-sm mb-6">There are no active providers to check. Please configure providers in the Admin section.</p>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => {
                        setShowHealthCheck(false);
                        onBack();
                      }}
                      className="w-full py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg"
                    >
                      Back to Admin Data Providers
                    </button>
                    <button
                      onClick={() => setShowHealthCheck(false)}
                      className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                    >
                      Stay Here
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {healthResults.map((result) => (
                    <div
                      key={result.providerId}
                      className={`p-4 rounded-lg border ${
                        result.status === 'up' ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {result.status === 'up' ? (
                            <Check className="w-5 h-5 text-green-400" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                          )}
                          <div>
                            <p className="font-medium text-white">{result.providerName}</p>
                            <p className="text-sm text-gray-400">
                              {result.success ? `${result.responseTime}ms` : result.error}
                            </p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          result.status === 'up' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {result.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {healthResults && healthResults.length > 0 && (
              <div className="p-6 border-t border-gray-700">
                <button
                  onClick={() => setShowHealthCheck(false)}
                  className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fallback History Modal */}
      {showFallbackHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-orange-400" />
                Fallback History
              </h2>
              <button onClick={() => setShowFallbackHistory(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              {fallbacks.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No fallback events recorded</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {fallbacks.map((fallback) => (
                    <div
                      key={fallback.id}
                      className="p-4 bg-gray-700/50 rounded-lg border border-gray-600"
                    >
                      <div className="flex items-start gap-3">
                        <ArrowUpDown className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-red-400 line-through">{fallback.failedProviderName}</span>
                            <span className="text-gray-500">→</span>
                            <span className="text-green-400">{fallback.fallbackProviderName}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            {new Date(fallback.timestamp).toLocaleString()}
                          </div>
                          {fallback.reason && (
                            <p className="text-xs text-gray-400 mt-1">Reason: {fallback.reason}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-700">
              <button
                onClick={() => setShowFallbackHistory(false)}
                className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
