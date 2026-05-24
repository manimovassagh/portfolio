import type { Page } from '@playwright/test';

// Mock responses that exactly match the frontend's Zod schemas.

const HOLDING = {
  isin: 'IE00B4L5Y983',
  name: 'iShares Core MSCI World',
  asset_class: 'ETF',
  shares: 10,
  avg_cost: 80.0,
  cost_basis: 800.0,
  current_price: 90.0,
  market_value: 900.0,
  unrealized_pnl: 100.0,
  unrealized_pct: 12.5,
  weight: 100.0,
  fees_paid: 0.5,
  ttm_dividend: null,
  ttm_yield: null,
};

const SUMMARY = {
  export: 'demo.csv',
  portfolio_value: 12345.67,
  market_value: 900.0,
  cash_balance: 500.0,
  cost_basis: 800.0,
  net_deposits: 800.0,
  deposits: 800.0,
  withdrawals: 0,
  unrealized_pnl: 100.0,
  unrealized_pct: 12.5,
  realized_pnl: 0.0,
  total_return: 12.5,
  xirr: null,
  dividends: 12.34,
  interest: 0.0,
  stockperks: 0.0,
  fees: 0.5,
  tax: 0.0,
  n_holdings: 1,
  n_realized: 0,
  holder_name: null,
  first_trade_date: '2024-01-01',
};

const HOLDINGS_PAYLOAD = {
  holdings: [HOLDING],
  total_market_value: 900.0,
};

const POSITION_RETURNS = {
  returns: {},
};

const PERFORMANCE = {
  series: [],
  drawdown: [],
  twr: [],
  benchmark: null,
  best_worst: { best: [], worst: [] },
};

const CASH_FLOW = {
  balance: [],
  buckets: [],
};

const INCOME_PAYLOAD = {
  log: [
    { date: '2024-01-15', name: 'iShares Core MSCI World', isin: 'IE00B4L5Y983', type: 'DIVIDEND', amount: 12.34, tax: 0, net: 12.34 },
  ],
  totals: { dividends: 12.34 },
};

const REALIZED_PAYLOAD = {
  realized: [],
  total: 0,
};

const TAX_PAYLOAD = {
  records: [],
};

const ANALYTICS = {
  monthly: {},
  annual: [],
  sharpe: 1.2,
  volatility: 0.15,
  max_dd_days: 5,
  sectors: [],
  pnl_series: [],
};

const EXPORTS = { exports: ['demo.csv'] };

const SESSION = {
  authenticated: true,
  required: false,
  user: { id: 'dev:test', provider: 'dev', provider_subject: 'test', email: 'test@example.com', name: 'Test User', created_at: '2025-01-01T00:00:00Z' },
};

const WATCHLIST = {
  items: [
    {
      isin: 'US0378331005',
      ticker: 'AAPL',
      name: 'Apple Inc.',
      notes: 'Watching for dip',
      target_price: 150.0,
      added_date: '2025-01-01',
      current_price: 180.0,
    },
  ],
};

// mockApiRoutes intercepts all /api/* calls and returns stub data so tests
// run without a live backend.
export async function mockApiRoutes(page: Page): Promise<void> {
  await page.route('**/api/auth/session', (r) => r.fulfill({ json: SESSION }));
  await page.route('**/api/auth/providers', (r) => r.fulfill({ json: { providers: { local: true, auth0: false, google: false, apple: false, passkey: false, dev: true } } }));
  await page.route('**/api/exports', (r) => r.fulfill({ json: EXPORTS }));
  await page.route('**/api/summary**', (r) => r.fulfill({ json: SUMMARY }));
  await page.route('**/api/portfolio**', (r) => r.fulfill({ json: SUMMARY }));
  await page.route('**/api/holdings**', (r) => r.fulfill({ json: HOLDINGS_PAYLOAD }));
  await page.route('**/api/position_returns**', (r) => r.fulfill({ json: POSITION_RETURNS }));
  await page.route('**/api/performance**', (r) => r.fulfill({ json: PERFORMANCE }));
  await page.route('**/api/cash_flow**', (r) => r.fulfill({ json: CASH_FLOW }));
  await page.route('**/api/income**', (r) => r.fulfill({ json: INCOME_PAYLOAD }));
  await page.route('**/api/realized**', (r) => r.fulfill({ json: REALIZED_PAYLOAD }));
  await page.route('**/api/tax**', (r) => r.fulfill({ json: TAX_PAYLOAD }));
  await page.route('**/api/analytics**', (r) => r.fulfill({ json: ANALYTICS }));
  await page.route('**/api/watchlist', (r) => r.fulfill({ json: WATCHLIST }));
  await page.route('**/api/watchlist/*', (r) => r.fulfill({ json: { items: [] } }));
  await page.route('**/api/geographic**', (r) => r.fulfill({ json: { countries: [{ code: 'IE', name: 'Ireland', value: 900.0 }] } }));
  await page.route('**/api/fsa**', (r) => r.fulfill({ json: { year: 2025, limit: 1000, used: 12.34, remaining: 987.66, breakdown: { dividends: 12.34, interest: 0, stockperks: 0, vorabpauschale: 0, realized_gains: 0 } } }));
  await page.route('**/api/dividend_calendar**', (r) => r.fulfill({ json: { upcoming: [] } }));
  await page.route('**/api/market/search**', (r) => r.fulfill({ json: { results: [{ ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', type: 'Equity', currency: 'USD' }] } }));
  await page.route('**/api/market/quote**', (r) => r.fulfill({ json: { ticker: 'AAPL', price: 180.0, prev_close: 178.5, change: 1.5, change_pct: 0.84, day_high: 181.0, day_low: 177.0, wk52_high: 200.0, wk52_low: 140.0, market_cap: 2800000000000.0, currency: 'USD', volume: 1000000 } }));
  await page.route('**/api/market/history**', (r) => r.fulfill({ json: { series: [] } }));
  await page.route('**/api/market/news**', (r) => r.fulfill({ json: { news: [] } }));
  await page.route('**/api/readyz', (r) => r.fulfill({ json: { ok: true } }));
  await page.route('**/api/refresh_prices**', (r) => r.fulfill({ json: { status: 'ok' } }));
  await page.route('**/api/upload', (r) => r.fulfill({ json: { filename: 'demo.csv', exports: ['demo.csv'] } }));
}
