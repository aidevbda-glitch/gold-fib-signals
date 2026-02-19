// Gold product types and broker information

export type GoldProductType = 
  | 'spot' 
  | 'futures' 
  | 'miners_etf' 
  | 'gold_etf'
  | 'cfd' 
  | 'options';

export interface Broker {
  id: string;
  name: string;
  logo?: string;
  url: string;
  description: string;
  products: GoldProductType[];
  features: string[];
  minDeposit?: number;
  spread?: string;
  commission?: string;
  leverage?: string;
  regulation: string[];
  pros: string[];
  cons: string[];
  rating: number; // 1-5
}

export interface GoldProduct {
  type: GoldProductType;
  name: string;
  description: string;
  icon: string;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Very High';
  suitableFor: string[];
  typicalHoldingPeriod: string;
  keyFeatures: string[];
  considerations: string[];
}

export interface TimeframeOption {
  label: string;
  value: string;
  days: number;
}

export const TIMEFRAMES: TimeframeOption[] = [
  { label: '1 Week', value: '5d', days: 7 },
  { label: '1 Month', value: '1mo', days: 30 },
  { label: '3 Months', value: '3mo', days: 90 },
  { label: '6 Months', value: '6mo', days: 180 },
  { label: '1 Year', value: '1y', days: 365 },
  { label: '2 Years', value: '2y', days: 730 },
  { label: '3 Years', value: '3y', days: 1095 },
];
