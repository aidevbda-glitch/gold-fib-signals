// Settings types for API providers and app configuration

export interface ApiProvider {
  id: string;
  name: string;
  endpoint: string;
  apiKey: string;
  requestType: 'GET' | 'POST';
  isActive: boolean;
  headers?: Record<string, string>;
  symbolFormat?: string; // e.g., "XAU" or "XAUUSD"
  currencyFormat?: string; // e.g., "USD"
  createdAt: number;
  updatedAt: number;
}

export interface RefreshSettings {
  interval: 'realtime' | 'hourly' | 'daily' | 'weekly';
  intervalMs: number;
  lastRefresh: number | null;
}

export interface AppSettings {
  apiProviders: ApiProvider[];
  activeProviderId: string | null;
  refresh: RefreshSettings;
  theme: 'dark' | 'light';
  notifications: boolean;
}

export const REFRESH_INTERVALS = {
  realtime: { label: 'Real-time (5 seconds)', ms: 5000 },
  hourly: { label: 'Hourly', ms: 60 * 60 * 1000 },
  daily: { label: 'Daily', ms: 24 * 60 * 60 * 1000 },
  weekly: { label: 'Weekly', ms: 7 * 24 * 60 * 60 * 1000 },
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
  apiProviders: [],
  activeProviderId: null,
  refresh: {
    interval: 'weekly',
    intervalMs: REFRESH_INTERVALS.weekly.ms,
    lastRefresh: null,
  },
  theme: 'dark',
  notifications: true,
};
