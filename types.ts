import type { User as FirebaseUser } from 'firebase/auth';

export type User = FirebaseUser;

export enum Exchange {
  USA = 'USA',
  CANADA = 'Canada',
}

export enum Currency {
  USD = 'USD',
  CAD = 'CAD',
}

export enum AssetType {
  Stock = 'Stock',
  Cash = 'Cash',
}

export enum AccountType {
  TFSA = 'TFSA',
  FHSA = 'FHSA',
  RRSP = 'RRSP',
  MARGIN = 'Margin',
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
}

export interface UserProfileData {
  estimatedEarnings?: number;
}

interface BaseAsset {
  id:string;
  accountId: string;
}

export interface StockAsset extends BaseAsset {
  type: AssetType.Stock;
  ticker: string;
  name: string;
  shares: number;
  avgCost: number;
  exchange: Exchange;
  currentPrice: number;
  yearlyDividend: number | null;
  peRatio: number | null;
  forwardPeRatio: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekHigh: number | null;
  // New fields for caching
  companyProfile: string;
  marketCap: string | null;
  dividendYield: number | null;
  lastPriceUpdate: number; // timestamp
  lastMetricsUpdate: number; // timestamp
}

export interface CashAsset extends BaseAsset {
    type: AssetType.Cash;
    currency: Currency;
    amount: number;
    name: string; 
}

export type Asset = StockAsset | CashAsset;


export interface PortfolioSummaryData {
  totalMarketValue: number;
  totalCost: number;
  totalGainLoss: number;
  dayGainLoss: number;
  overallReturn: number;
}

export interface TickerNews {
    title: string;
    source: string;
    url: string | null;
    publishedAt: string; // e.g. "2 hours ago", "2024-07-28"
}

export interface TickerPriceHistory {
    date: string; // YYYY-MM-DD
    close: number;
}

export interface TickerDetails {
    name: string;
    companyProfile: string;
    marketCap: string | null;
    peRatio: number | null;
    dividendYield: number | null;
    fiftyTwoWeekLow: number | null;
    fiftyTwoWeekHigh: number | null;
    priceHistory: TickerPriceHistory[];
    dayChange: number | null;
    dayChangePercent: number | null;
    currentPrice: number;
}