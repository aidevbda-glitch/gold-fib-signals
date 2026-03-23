import { useState, useEffect } from 'react';
import { Mail, Plus, Trash2, TestTube, Settings, Send, Users, AlertCircle, CheckCircle } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface EmailSettings {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
  fromName: string;
  enabled: boolean;
  hasPassword: boolean;
}

interface EmailSubscriber {
  id: number;
  email: string;
  name: string;
  enabled: number;
  created_at: string;
}

interface EmailStats {
  totalSent: number;
  totalFailed: number;
  recentNotifications: Array<{
    id: number;
    subscriber_email: string;
    signal_type: string;
    sent_at: string;
    status: string;
  }>;
}

export function EmailSettingsPanel() {
  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [subscribers, setSubscribers] = useState<EmailSubscriber[]>([]);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newSubscriberEmail, setNewSubscriberEmail] = useState('');
  const [newSubscriberName, setNewSubscriberName] = useState('');

  // Form state
  const [formData, setFormData] = useState<Partial<EmailSettings>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [settingsRes, subscribersRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/email/settings`),
        fetch(`${API_BASE}/email/subscribers`),
        fetch(`${API_BASE}/email/stats`),
      ]);

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings(settingsData.data);
        setFormData(settingsData.data);
      }
      if (subscribersRes.ok) {
        const subscribersData = await subscribersRes.json();
        setSubscribers(subscribersData.data);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data);
      }
    } catch (err) {
      setError('Failed to load email settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      const response = await fetch(`${API_BASE}/email/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.data);
        setSuccess('Settings saved successfully');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Failed to save settings');
      }
    } catch (err) {
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const testConfiguration = async () => {
    try {
      setTesting(true);
      setError(null);
      const response = await fetch(`${API_BASE}/email/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (result.success) {
        setSuccess(result.message);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Failed to test email configuration');
    } finally {
      setTesting(false);
    }
  };

  const addSubscriber = async () => {
    if (!newSubscriberEmail) return;

    try {
      const response = await fetch(`${API_BASE}/email/subscribers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newSubscriberEmail, name: newSubscriberName }),
      });

      if (response.ok) {
        setNewSubscriberEmail('');
        setNewSubscriberName('');
        fetchData();
        setSuccess('Subscriber added successfully');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Failed to add subscriber');
      }
    } catch (err) {
      setError('Failed to add subscriber');
    }
  };

  const deleteSubscriber = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE}/email/subscribers/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchData();
        setSuccess('Subscriber deleted');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError('Failed to delete subscriber');
      }
    } catch (err) {
      setError('Failed to delete subscriber');
    }
  };

  const sendTestEmail = async () => {
    try {
      setTesting(true);
      setError(null);
      const response = await fetch(`${API_BASE}/email/send-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'BUY', price: 4500, strength: 'STRONG' }),
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(`Test email sent to ${result.result.sent} subscribers`);
      } else {
        setError('Failed to send test email');
      }
    } catch (err) {
      setError('Failed to send test email');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-6">
        <p className="text-gray-400">Loading email settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Mail className="w-6 h-6 text-yellow-400" />
        <h2 className="text-xl font-bold text-white">Email Notifications</h2>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-900/50 border border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <p className="text-red-200">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-900/50 border border-green-800 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-400" />
          <p className="text-green-200">{success}</p>
        </div>
      )}

      {/* SMTP Settings */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-white">SMTP Settings</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">SMTP Host</label>
            <input
              type="text"
              value={formData.smtpHost || ''}
              onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
              placeholder="smtp.gmail.com"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">SMTP Port</label>
            <input
              type="number"
              value={formData.smtpPort || 587}
              onChange={(e) => setFormData({ ...formData, smtpPort: parseInt(e.target.value) })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">SMTP Username</label>
            <input
              type="text"
              value={formData.smtpUser || ''}
              onChange={(e) => setFormData({ ...formData, smtpUser: e.target.value })}
              placeholder="your-email@gmail.com"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">SMTP Password</label>
            <input
              type="password"
              value={formData.smtpPass || ''}
              onChange={(e) => setFormData({ ...formData, smtpPass: e.target.value })}
              placeholder={settings?.hasPassword ? '••••••••' : 'Enter password'}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">From Email</label>
            <input
              type="email"
              value={formData.fromEmail || ''}
              onChange={(e) => setFormData({ ...formData, fromEmail: e.target.value })}
              placeholder="signals@example.com"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">From Name</label>
            <input
              type="text"
              value={formData.fromName || ''}
              onChange={(e) => setFormData({ ...formData, fromName: e.target.value })}
              placeholder="Gold Fib Signals"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.enabled || false}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-600 text-yellow-500 focus:ring-yellow-500"
            />
            <span className="text-white">Enable email notifications</span>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-4 py-2 bg-yellow-500 text-black font-medium rounded-lg hover:bg-yellow-400 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            onClick={testConfiguration}
            disabled={testing}
            className="px-4 py-2 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-600 disabled:opacity-50 flex items-center gap-2"
          >
            <TestTube className="w-4 h-4" />
            {testing ? 'Testing...' : 'Test SMTP'}
          </button>
          <button
            onClick={sendTestEmail}
            disabled={testing}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 disabled:opacity-50 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {testing ? 'Sending...' : 'Send Test Email'}
          </button>
        </div>
      </div>

      {/* Subscribers List */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-white">Subscribers</h3>
          <span className="ml-auto text-sm text-gray-400">{subscribers.length} total</span>
        </div>

        {/* Add Subscriber */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="email"
            value={newSubscriberEmail}
            onChange={(e) => setNewSubscriberEmail(e.target.value)}
            placeholder="Enter email address"
            className="flex-1 min-w-0 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
          />
          <input
            type="text"
            value={newSubscriberName}
            onChange={(e) => setNewSubscriberName(e.target.value)}
            placeholder="Name (optional)"
            className="flex-1 min-w-0 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
          />
          <button
            onClick={addSubscriber}
            disabled={!newSubscriberEmail}
            className="px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-500 disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-400 border-b border-gray-700">
                <th className="pb-2">Email</th>
                <th className="pb-2">Name</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Added</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {subscribers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-gray-500">
                    No subscribers yet
                  </td>
                </tr>
              ) : (
                subscribers.map((sub) => (
                  <tr key={sub.id} className="border-b border-gray-700/50">
                    <td className="py-3 text-white">{sub.email}</td>
                    <td className="py-3 text-gray-300">{sub.name || '-'}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${sub.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {sub.enabled ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 text-gray-400 text-sm">
                      {new Date(sub.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => deleteSubscriber(sub.id)}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                        title="Delete subscriber"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {subscribers.length === 0 ? (
            <div className="py-4 text-center text-gray-500">
              No subscribers yet
            </div>
          ) : (
            subscribers.map((sub) => (
              <div key={sub.id} className="bg-gray-700/30 rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium truncate">{sub.email}</p>
                    {sub.name && (
                      <p className="text-gray-400 text-sm">{sub.name}</p>
                    )}
                  </div>
                  <button
                    onClick={() => deleteSubscriber(sub.id)}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg shrink-0"
                    title="Delete subscriber"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-1 text-xs rounded-full ${sub.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {sub.enabled ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-gray-400 text-sm">
                    {new Date(sub.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Email Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-700/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-white">{stats.totalSent}</p>
              <p className="text-sm text-gray-400">Emails Sent</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-400">{stats.totalFailed}</p>
              <p className="text-sm text-gray-400">Failed</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-400">
                {stats.totalSent > 0 ? Math.round((stats.totalSent / (stats.totalSent + stats.totalFailed)) * 100) : 0}%
              </p>
              <p className="text-sm text-gray-400">Success Rate</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{subscribers.filter(s => s.enabled).length}</p>
              <p className="text-sm text-gray-400">Active Subscribers</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
