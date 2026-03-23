import { useState, useEffect } from 'react';
import { X, Mail, Bell, Shield, AlertTriangle, Check, Clock, Loader2 } from 'lucide-react';

interface NotificationRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type RequestState = 'idle' | 'submitting' | 'success' | 'error' | 'rateLimited';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function NotificationRequestModal({ isOpen, onClose }: NotificationRequestModalProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [state, setState] = useState<RequestState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [rateLimitInfo, setRateLimitInfo] = useState<{ remaining: number; resetAt: string } | null>(null);
  const [maskedEmail, setMaskedEmail] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Check rate limit on open
      checkRateLimit();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const checkRateLimit = async () => {
    try {
      const response = await fetch(`${API_BASE}/notifications/rate-limit`);
      if (response.ok) {
        const data = await response.json();
        if (!data.allowed) {
          setState('rateLimited');
        }
        setRateLimitInfo({
          remaining: data.remaining,
          resetAt: data.resetAt
        });
      }
    } catch (error) {
      console.error('Failed to check rate limit:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !isValidEmail(email)) {
      setState('error');
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setState('submitting');
    setErrorMessage('');

    try {
      const response = await fetch(`${API_BASE}/notifications/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name: name || undefined })
      });

      const data = await response.json();

      if (response.ok) {
        setState('success');
        setMaskedEmail(data.email);
        // Store in localStorage that user has requested
        localStorage.setItem('notificationRequested', Date.now().toString());
      } else {
        setState('error');
        setErrorMessage(data.error || 'Failed to submit request. Please try again.');
        
        if (data.error?.includes('Rate limit')) {
          setState('rateLimited');
        }
      }
    } catch (error) {
      setState('error');
      setErrorMessage('Network error. Please try again.');
    }
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleClose = () => {
    setEmail('');
    setName('');
    setState('idle');
    setErrorMessage('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-600 to-amber-600 p-6">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-1 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Email Alerts</h2>
              <p className="text-yellow-100 text-sm">Get notified of new signals</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {state === 'success' ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Request Submitted!</h3>
              <p className="text-gray-400 text-sm mb-4">
                We've received your request for <strong className="text-yellow-400">{maskedEmail}</strong>.
              </p>
              <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-yellow-400 mb-2">
                  <Clock className="w-4 h-4" />
                  <span className="font-medium">What happens next?</span>
                </div>
                <ul className="text-sm text-gray-400 space-y-1 text-left">
                  <li>• An admin will review your request</li>
                  <li>• You'll receive a welcome email when approved</li>
                  <li>• Start receiving signal alerts immediately</li>
                </ul>
              </div>
              <button
                onClick={handleClose}
                className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition-colors"
              >
                Got it!
              </button>
            </div>
          ) : state === 'rateLimited' ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-orange-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Rate Limit Reached</h3>
              <p className="text-gray-400 text-sm mb-4">
                You've reached the maximum number of requests (3 per day).
              </p>
              {rateLimitInfo?.resetAt && (
                <p className="text-sm text-gray-500 mb-4">
                  You can try again after{' '}
                  <span className="text-yellow-400">
                    {new Date(rateLimitInfo.resetAt).toLocaleString()}
                  </span>
                </p>
              )}
              <button
                onClick={handleClose}
                className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Privacy notice */}
              <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/20 rounded-lg p-3 mb-4">
                <Shield className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                <p className="text-xs text-green-400">
                  Your email is encrypted with AES-256-GCM and only used for signal notifications. 
                  Unsubscribe anytime with one click.
                </p>
              </div>

              {/* Email field */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors"
                    required
                    disabled={state === 'submitting'}
                    autoFocus
                  />
                </div>
              </div>

              {/* Name field (optional) */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Name <span className="text-gray-500">(optional)</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors"
                  disabled={state === 'submitting'}
                />
              </div>

              {/* Error message */}
              {state === 'error' && (
                <div className="flex items-center gap-2 text-red-400 text-sm mb-4">
                  <AlertTriangle className="w-4 h-4" />
                  {errorMessage}
                </div>
              )}

              {/* Rate limit info */}
              {rateLimitInfo && rateLimitInfo.remaining < 3 && (
                <p className="text-xs text-gray-500 mb-4">
                  You have {rateLimitInfo.remaining} request{rateLimitInfo.remaining !== 1 ? 's' : ''} remaining today.
                </p>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={state === 'submitting' || !email}
                className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-black font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {state === 'submitting' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4" />
                    Request Notifications
                  </>
                )}
              </button>

              <p className="text-center text-xs text-gray-500 mt-4">
                By subscribing, you agree to receive email notifications. 
                You can unsubscribe at any time.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationRequestModal;