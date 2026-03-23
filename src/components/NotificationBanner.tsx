import { useState, useEffect } from 'react';
import { Bell, X, Mail, Shield, ChevronRight } from 'lucide-react';

interface NotificationBannerProps {
  onRequestNotifications: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function NotificationBanner({ onRequestNotifications }: NotificationBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);

  useEffect(() => {
    // Check if user has already dismissed the banner
    const dismissed = localStorage.getItem('notificationBannerDismissed');
    if (dismissed) {
      const dismissedAt = parseInt(dismissed);
      // Show again after 7 days
      if (Date.now() - dismissedAt > 7 * 24 * 60 * 60 * 1000) {
        localStorage.removeItem('notificationBannerDismissed');
        setIsVisible(true);
      } else {
        setIsDismissed(true);
      }
    } else {
      // Delay showing for better UX
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    // Fetch subscriber count
    fetch(`${API_BASE}/admin/notification-stats`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.data?.subscribers?.active) {
          setSubscriberCount(data.data.subscribers.active);
        }
      })
      .catch(() => {/* ignore */});
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem('notificationBannerDismissed', Date.now().toString());
  };

  const handleRequest = () => {
    onRequestNotifications();
    handleDismiss();
  };

  if (!isVisible || isDismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-gradient-to-br from-yellow-600 to-amber-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 text-yellow-200 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-5">
          {/* Icon and title */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">Get Signal Alerts</h3>
              <div className="flex items-center gap-1 text-yellow-200 text-xs">
                <Shield className="w-3 h-3" />
                <span>Secure & Private</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <p className="text-yellow-100 text-sm mb-4 leading-relaxed">
            Receive instant email notifications when new BUY or SELL signals are generated. 
            Never miss a trading opportunity again.
          </p>

          {/* Features */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="px-2 py-1 bg-white/10 rounded-full text-xs text-yellow-100 flex items-center gap-1">
              <Mail className="w-3 h-3" />
              Real-time alerts
            </span>
            <span className="px-2 py-1 bg-white/10 rounded-full text-xs text-yellow-100">
              One-click unsubscribe
            </span>
          </div>

          {/* Subscriber count */}
          {subscriberCount !== null && (
            <p className="text-xs text-yellow-200 mb-3">
              Join {subscriberCount}+ traders receiving alerts
            </p>
          )}

          {/* CTA Button */}
          <button
            onClick={handleRequest}
            className="w-full py-3 bg-white hover:bg-yellow-50 text-amber-700 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 group"
          >
            <Bell className="w-4 h-4" />
            Get Email Notifications
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <p className="text-center text-xs text-yellow-200/70 mt-3">
            No spam. Unsubscribe anytime.
          </p>
        </div>

        {/* Progress bar for auto-dismiss visual */}
        <div className="h-1 bg-black/20">
          <div 
            className="h-full bg-white/50 animate-[shrink_10s_linear_forwards]"
            style={{
              animation: 'shrink 10s linear forwards'
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

export default NotificationBanner;