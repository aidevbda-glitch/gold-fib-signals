import { useEffect, useRef, useState } from 'react';

interface AdBannerProps {
  slot: string;
  format?: 'auto' | 'horizontal' | 'vertical' | 'rectangle';
  className?: string;
  testMode?: boolean;
}

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

export function AdBanner({ slot, format = 'auto', className = '', testMode = false }: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);
  const [_adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);

  useEffect(() => {
    // Don't load in test mode
    if (testMode) return;
    
    // Only load if slot is provided
    if (!slot) return;

    try {
      // Push the ad
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      setAdLoaded(true);
    } catch (error) {
      console.error('AdSense error:', error);
      setAdError(true);
    }
  }, [slot, testMode]);

  // Test mode placeholder
  if (testMode) {
    return (
      <div className={`bg-gray-700/50 border border-dashed border-gray-600 rounded-lg p-4 text-center ${className}`}>
        <p className="text-gray-400 text-sm">📢 Ad Placeholder</p>
        <p className="text-gray-500 text-xs mt-1">Slot: {slot || 'Not configured'}</p>
      </div>
    );
  }

  // Don't render if no slot
  if (!slot) return null;

  // Error state
  if (adError) {
    return null; // Silently fail
  }

  return (
    <div className={`ad-container ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={import.meta.env.VITE_ADSENSE_PUBLISHER_ID || ''}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}

// Pre-configured ad placements
export function HeaderAd({ slot, testMode }: { slot: string; testMode?: boolean }) {
  return <AdBanner slot={slot} format="horizontal" className="mb-4" testMode={testMode} />;
}

export function SidebarAd({ slot, testMode }: { slot: string; testMode?: boolean }) {
  return <AdBanner slot={slot} format="vertical" className="sticky top-20" testMode={testMode} />;
}

export function ContentAd({ slot, testMode }: { slot: string; testMode?: boolean }) {
  return <AdBanner slot={slot} format="rectangle" className="my-6" testMode={testMode} />;
}

export function FooterAd({ slot, testMode }: { slot: string; testMode?: boolean }) {
  return <AdBanner slot={slot} format="horizontal" className="mt-6" testMode={testMode} />;
}
