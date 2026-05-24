export type ExportName = string;

export type SectionId = 'overview' | 'analytics' | 'holdings' | 'cash' | 'income' | 'realized' | 'tax' | 'watchlist' | 'rebalance' | 'goals' | 'markets';
export type ChartMode = 'Value' | 'TWR' | 'Drawdown';

export type AuthUser = {
  id: string;
  provider: string;
  email: string;
  name: string;
  created_at: string;
};

export type AuthSession = {
  authenticated: boolean;
  required: boolean;
  user: AuthUser | null;
};

export type AuthProviders = {
  providers: {
    local: boolean;
    auth0: boolean;
    google: boolean;
    apple: boolean;
    passkey: boolean;
  };
};

export type Summary = {
  export: string;
  portfolio_value: number;
  market_value: number;
  cash_balance: number;
  cost_basis: number;
  net_deposits: number;
  deposits: number;
  withdrawals: number;
  unrealized_pnl: number;
  unrealized_pct: number;
  realized_pnl: number;
  total_return: number;
  xirr: number | null;
  dividends: number;
  interest: number;
  stockperks: number;
  fees: number;
  tax: number;
  n_holdings: number;
  n_realized: number;
  holder_name: string | null;
  first_trade_date: string | null;
};

export type Holding = {
  isin: string;
  name: string;
  asset_class: string;
  shares: number;
  avg_cost: number;
  cost_basis: number;
  current_price: number | null;
  market_value: number | null;
  unrealized_pnl: number | null;
  unrealized_pct: number | null;
  weight: number;
  fees_paid: number;
  ttm_dividend: number | null;
  ttm_yield: number | null;
};

export type PositionRange = '1D' | '1W' | '1M' | 'YTD' | '1Y';
export type PositionReturns = Record<string, Record<PositionRange, { pnl: number | null; pct: number | null }>>;

export type BenchmarkPoint = { date: string; twr: number };

export type Performance = {
  series: Array<{ date: string; portfolio_value: number | null; contributions: number | null; holdings_value: number | null }>;
  drawdown: Array<{ date: string; drawdown: number }>;
  twr: Array<{ date: string; twr: number }>;
  benchmark: BenchmarkPoint[] | null;
  best_worst: {
    best: Array<{ date: string; pnl: number }>;
    worst: Array<{ date: string; pnl: number }>;
  };
};

export type CashFlow = {
  balance: Array<{ date: string; cash: number }>;
  buckets: Array<{ label: string; value: number }>;
};

export type Analytics = {
  monthly: Record<string, Record<string, number | null>>;
  annual: Array<{ year: number; pnl: number; pct: number }>;
  sharpe: number | null;
  volatility: number | null;
  max_dd_days: number;
  sectors: Array<{ label: string; value: number }>;
  pnl_series: Array<{ date: string; pnl: number }>;
};

export type IncomeRow = Record<string, string | number | null>;
export type TaxRow = Record<string, string | number | null>;

export type RealizedRow = {
  date: string | null;
  name: string;
  isin: string;
  shares: number;
  sell_price: number;
  avg_cost: number;
  pnl: number;
  pnl_pct: number;
};

export type AssetDetail = {
  isin: string;
  name: string;
  asset_class: string;
  transactions: Array<{
    date: string | null;
    type: string;
    shares: number | null;
    price: number | null;
    amount: number | null;
    fee: number | null;
    tax: number | null;
    description: string;
  }>;
  current: {
    shares: number;
    avg_cost: number;
    cost_basis: number;
    current_price: number | null;
    market_value: number | null;
    unrealized: number | null;
  };
};

export type GeographicData = {
  countries: Array<{ code: string; name: string; value: number; pct: number }>;
};

export type FsaData = {
  year: number;
  limit: number;
  used: number;
  remaining: number;
  breakdown: { dividends: number; interest: number; stockperks: number; vorabpauschale: number; realized_gains: number };
};

export type WatchlistItem = {
  isin: string;
  ticker: string;
  name: string;
  notes: string;
  target_price: number | null;
  added_date: string;
  current_price: number | null;
};

export type WatchlistData = { items: WatchlistItem[] };

export type DividendCalendarData = {
  upcoming: Array<{ isin: string; name: string; last_dividend_date: string; last_amount: number }>;
};

export type MarketSearchResult = {
  ticker: string;
  name: string;
  type: string;
  exchange: string;
};

export type MarketQuote = {
  ticker: string;
  price: number | null;
  prev_close: number | null;
  change: number | null;
  change_pct: number | null;
  day_high: number | null;
  day_low: number | null;
  wk52_high: number | null;
  wk52_low: number | null;
  market_cap: number | null;
  currency: string | null;
  volume: number | null;
};

export type MarketCandle = { date: string; close: number; volume: number | null };

export type MarketNewsItem = {
  title: string;
  publisher: string;
  link: string;
  date: string | null;
  thumbnail: string | null;
};

export type DashboardData = {
  summary: Summary;
  holdings: Holding[];
  positionReturns: PositionReturns;
  totalMV: number;
  perf: Performance;
  cashFlow: CashFlow;
  income: IncomeRow[];
  incomeTotals: Record<string, number>;
  realized: RealizedRow[];
  realizedTotal: number;
  tax: TaxRow[];
  analytics: Analytics;
};
