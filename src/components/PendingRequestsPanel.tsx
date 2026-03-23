import { useState, useEffect } from 'react';
import { 
  Users, 
  Check, 
  X, 
  RefreshCw, 
  Loader2, 
  AlertCircle, 
  Clock,
  CreditCard,
  User,
  Mail,
  ShieldCheck
} from 'lucide-react';

interface PendingRequest {
  id: number;
  emailHash: string;
  emailMasked: string;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  token: string;
  stripeVerified?: boolean;
  name?: string;
}

interface PendingRequestsPanelProps {
  sessionId: string;
  onCountChange?: (count: number) => void;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function PendingRequestsPanel({ sessionId, onCountChange }: PendingRequestsPanelProps) {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    fetchPendingRequests();
  }, []);

  useEffect(() => {
    onCountChange?.(requests.length);
  }, [requests, onCountChange]);

  const fetchPendingRequests = async () => {
    try {
      setRefreshing(true);
      setError(null);
      
      const response = await fetch(`${API_BASE}/notifications/pending`, {
        headers: { 'X-Admin-Session': sessionId }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pending requests');
      }

      const data = await response.json();
      setRequests(data.data || []);
    } catch (err) {
      setError('Failed to load pending requests');
      console.error('Error fetching pending requests:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleApprove = async (token: string) => {
    try {
      setProcessingId(requests.find(r => r.token === token)?.id || null);
      setError(null);
      
      const response = await fetch(`${API_BASE}/notifications/approve/${token}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Session': sessionId 
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to approve request');
      }

      const data = await response.json();
      setSuccess(`Approved subscription for ${data.email}`);
      setTimeout(() => setSuccess(null), 3000);
      
      // Refresh the list
      await fetchPendingRequests();
    } catch (err: any) {
      setError(err.message || 'Failed to approve request');
      setTimeout(() => setError(null), 5000);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (token: string) => {
    if (!rejectionReason.trim()) {
      setError('Please provide a rejection reason');
      return;
    }

    try {
      setProcessingId(requests.find(r => r.token === token)?.id || null);
      setError(null);
      
      const response = await fetch(`${API_BASE}/notifications/reject/${token}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Session': sessionId 
        },
        body: JSON.stringify({ reason: rejectionReason })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reject request');
      }

      const data = await response.json();
      setSuccess(`Rejected subscription for ${data.email}`);
      setTimeout(() => setSuccess(null), 3000);
      
      // Clear rejection state
      setRejectingId(null);
      setRejectionReason('');
      
      // Refresh the list
      await fetchPendingRequests();
    } catch (err: any) {
      setError(err.message || 'Failed to reject request');
      setTimeout(() => setError(null), 5000);
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHrs < 1) {
      return 'Just now';
    } else if (diffHrs < 24) {
      return `${diffHrs}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatExpiry = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) {
      return 'Expired';
    } else if (diffHrs < 24) {
      return `${diffHrs}h left`;
    } else {
      return `${diffDays}d left`;
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-yellow-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-semibold text-white">Pending Requests</h3>
          <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-sm rounded-full">
            {requests.length}
          </span>
        </div>
        <button
          onClick={fetchPendingRequests}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-900/50 border border-red-800 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-red-200 text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-900/50 border border-green-800 rounded-lg p-3 flex items-center gap-2">
          <Check className="w-4 h-4 text-green-400 shrink-0" />
          <p className="text-green-200 text-sm">{success}</p>
        </div>
      )}

      {/* Empty State */}
      {requests.length === 0 && (
        <div className="bg-gray-800/50 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-green-400" />
          </div>
          <p className="text-gray-300 font-medium">No pending requests</p>
          <p className="text-gray-500 text-sm mt-1">
            All subscription requests have been processed
          </p>
        </div>
      )}

      {/* Requests - Desktop Table / Mobile Cards */}
      {requests.length > 0 && (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-gray-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-700 bg-gray-800/50">
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Requested</th>
                    <th className="px-4 py-3 font-medium">Donation Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {requests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-700/20">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                            <Mail className="w-4 h-4 text-gray-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium">{request.emailMasked}</p>
                            {request.name && (
                              <p className="text-gray-500 text-sm flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {request.name}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 text-gray-300">
                          <Clock className="w-4 h-4 text-gray-500" />
                          {formatDate(request.createdAt)}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatExpiry(request.expiresAt)}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        {request.stripeVerified ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-400 text-sm rounded-full">
                            <CreditCard className="w-3.5 h-3.5" />
                            Verified via Stripe
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-700 text-gray-400 text-sm rounded-full">
                            <CreditCard className="w-3.5 h-3.5" />
                            No donation
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {rejectingId === request.id ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={rejectionReason}
                              onChange={(e) => setRejectionReason(e.target.value)}
                              placeholder="Reason for rejection..."
                              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleReject(request.token)}
                                disabled={processingId === request.id || !rejectionReason.trim()}
                                className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1"
                              >
                                {processingId === request.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <X className="w-3.5 h-3.5" />
                                )}
                                Confirm Reject
                              </button>
                              <button
                                onClick={() => {
                                  setRejectingId(null);
                                  setRejectionReason('');
                                }}
                                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleApprove(request.token)}
                              disabled={processingId === request.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              {processingId === request.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                              Approve
                            </button>
                            <button
                              onClick={() => setRejectingId(request.id)}
                              disabled={processingId === request.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/80 hover:bg-red-500 disabled:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              <X className="w-4 h-4" />
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {requests.map((request) => (
              <div key={request.id} className="bg-gray-800 rounded-xl p-4 space-y-3">
                {/* Email & Name */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center shrink-0">
                    <Mail className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium truncate">{request.emailMasked}</p>
                    {request.name && (
                      <p className="text-gray-500 text-sm flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {request.name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Request Time & Expiry */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 text-gray-300">
                    <Clock className="w-4 h-4 text-gray-500" />
                    {formatDate(request.createdAt)}
                  </div>
                  <p className="text-xs text-gray-500">
                    {formatExpiry(request.expiresAt)}
                  </p>
                </div>

                {/* Donation Status */}
                <div>
                  {request.stripeVerified ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-500/10 text-green-400 text-sm rounded-full">
                      <CreditCard className="w-3.5 h-3.5" />
                      Verified via Stripe
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-700 text-gray-400 text-sm rounded-full">
                      <CreditCard className="w-3.5 h-3.5" />
                      No donation
                    </span>
                  )}
                </div>

                {/* Actions */}
                {rejectingId === request.id ? (
                  <div className="space-y-2 pt-2 border-t border-gray-700">
                    <input
                      type="text"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Reason for rejection..."
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReject(request.token)}
                        disabled={processingId === request.id || !rejectionReason.trim()}
                        className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1"
                      >
                        {processingId === request.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                        Reject
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setRejectionReason('');
                        }}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-2 border-t border-gray-700">
                    <button
                      onClick={() => handleApprove(request.token)}
                      disabled={processingId === request.id}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {processingId === request.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectingId(request.id)}
                      disabled={processingId === request.id}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600/80 hover:bg-red-500 disabled:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default PendingRequestsPanel;
