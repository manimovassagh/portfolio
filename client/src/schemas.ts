import { z } from 'zod';

// ── Primitives ────────────────────────────────────────────────────────────────

const nullableNumber = z.number().nullable();
const nullableString = z.string().nullable();

// ── Holding ───────────────────────────────────────────────────────────────────

export const HoldingSchema = z.object({
  isin: z.string(),
  name: z.string(),
  asset_class: z.string(),
  shares: z.number(),
  avg_cost: z.number(),
  cost_basis: z.number(),
  current_price: nullableNumber,
  market_value: nullableNumber,
  unrealized_pnl: nullableNumber,
  unrealized_pct: nullableNumber,
  weight: z.number(),
  fees_paid: z.number(),
  ttm_dividend: nullableNumber,
  ttm_yield: nullableNumber,
});

export const HoldingsPayloadSchema = z.object({
  holdings: z.array(HoldingSchema),
  total_market_value: nullableNumber,
});

// ── Summary ───────────────────────────────────────────────────────────────────

export const SummarySchema = z.object({
  export: z.string(),
  portfolio_value: z.number(),
  market_value: z.number(),
  cash_balance: z.number(),
  cost_basis: z.number(),
  net_deposits: z.number(),
  deposits: z.number(),
  withdrawals: z.number(),
  unrealized_pnl: z.number(),
  unrealized_pct: z.number(),
  realized_pnl: z.number(),
  total_return: z.number(),
  xirr: nullableNumber,
  dividends: z.number(),
  interest: z.number(),
  stockperks: z.number(),
  fees: z.number(),
  tax: z.number(),
  n_holdings: z.number(),
  n_realized: z.number(),
  holder_name: nullableString,
  first_trade_date: nullableString,
});

// ── PositionReturns ───────────────────────────────────────────────────────────

const PositionRangeValueSchema = z.object({
  pnl: nullableNumber,
  pct: nullableNumber,
});

const PositionRangeMapSchema = z.record(z.string(), PositionRangeValueSchema);

export const PositionReturnsPayloadSchema = z.object({
  returns: z.record(z.string(), PositionRangeMapSchema),
});

// ── Performance ───────────────────────────────────────────────────────────────

const BenchmarkPointSchema = z.object({ date: z.string(), twr: z.number() });

export const PerformanceSchema = z.object({
  series: z.array(
    z.object({
      date: z.string(),
      portfolio_value: nullableNumber,
      contributions: nullableNumber,
      holdings_value: nullableNumber,
    }),
  ),
  drawdown: z.array(z.object({ date: z.string(), drawdown: z.number() })),
  twr: z.array(z.object({ date: z.string(), twr: z.number() })),
  benchmark: z.array(BenchmarkPointSchema).nullable().optional().transform((v) => v ?? null),
  best_worst: z.object({
    best: z.array(z.object({ date: z.string(), pnl: z.number() })),
    worst: z.array(z.object({ date: z.string(), pnl: z.number() })),
  }),
});

// ── CashFlow ──────────────────────────────────────────────────────────────────

export const CashFlowSchema = z.object({
  balance: z.array(z.object({ date: z.string(), cash: z.number() })),
  buckets: z.array(z.object({ label: z.string(), value: z.number() })),
});

// ── Income ────────────────────────────────────────────────────────────────────

const IncomeRowSchema = z.record(z.string(), z.union([z.string(), z.number(), z.null()]));

export const IncomePayloadSchema = z.object({
  log: z.array(IncomeRowSchema),
  totals: z.record(z.string(), z.number()),
});

// ── Realized ──────────────────────────────────────────────────────────────────

export const RealizedRowSchema = z.object({
  date: nullableString,
  name: z.string(),
  isin: z.string(),
  shares: z.number(),
  sell_price: z.number(),
  avg_cost: z.number(),
  pnl: z.number(),
  pnl_pct: z.number(),
});

export const RealizedPayloadSchema = z.object({
  realized: z.array(RealizedRowSchema),
  total: z.number(),
});

// ── Tax ───────────────────────────────────────────────────────────────────────

const TaxRowSchema = z.record(z.string(), z.union([z.string(), z.number(), z.null()]));

export const TaxPayloadSchema = z.object({
  records: z.array(TaxRowSchema),
});

// ── Analytics ─────────────────────────────────────────────────────────────────

export const AnalyticsSchema = z.object({
  monthly: z.record(z.string(), z.record(z.string(), nullableNumber)),
  annual: z.array(z.object({ year: z.number(), pnl: z.number(), pct: z.number() })),
  sharpe: nullableNumber,
  volatility: nullableNumber,
  max_dd_days: z.number(),
  sectors: z.array(z.object({ label: z.string(), value: z.number() })),
  pnl_series: z.array(z.object({ date: z.string(), pnl: z.number() })),
});

// ── Exports ───────────────────────────────────────────────────────────────────

export const ExportsPayloadSchema = z.object({
  exports: z.array(z.string()),
});

// ── AssetDetail ───────────────────────────────────────────────────────────────

export const AssetDetailSchema = z.object({
  isin: z.string(),
  name: z.string(),
  asset_class: z.string(),
  transactions: z.array(
    z.object({
      date: nullableString,
      type: z.string(),
      shares: nullableNumber,
      price: nullableNumber,
      amount: nullableNumber,
      fee: nullableNumber,
      tax: nullableNumber,
      description: z.string(),
    }),
  ),
  current: z.object({
    shares: z.number(),
    avg_cost: z.number(),
    cost_basis: z.number(),
    current_price: nullableNumber,
    market_value: nullableNumber,
    unrealized: nullableNumber,
  }),
});

// ── Geographic ────────────────────────────────────────────────────────────────

export const GeographicDataSchema = z.object({
  countries: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      value: z.number(),
      pct: z.number(),
    }),
  ),
});

// ── FSA ───────────────────────────────────────────────────────────────────────

export const FsaDataSchema = z.object({
  year: z.number(),
  limit: z.number(),
  used: z.number(),
  remaining: z.number(),
  breakdown: z.object({
    dividends: z.number(),
    interest: z.number(),
    stockperks: z.number(),
    vorabpauschale: z.number(),
    realized_gains: z.number(),
  }),
});

// ── Watchlist ─────────────────────────────────────────────────────────────────

export const WatchlistItemSchema = z.object({
  isin: z.string(),
  ticker: z.string(),
  name: z.string(),
  notes: z.string(),
  target_price: nullableNumber,
  added_date: z.string(),
  current_price: nullableNumber,
});

export const WatchlistDataSchema = z.object({
  items: z.array(WatchlistItemSchema),
});

// ── Dividend Calendar ─────────────────────────────────────────────────────────

export const DividendCalendarDataSchema = z.object({
  upcoming: z.array(
    z.object({
      isin: z.string(),
      name: z.string(),
      last_dividend_date: z.string(),
      last_amount: z.number(),
    }),
  ),
});

// ── Market ────────────────────────────────────────────────────────────────────

export const MarketSearchResultSchema = z.object({
  ticker: z.string(),
  name: z.string(),
  type: z.string(),
  exchange: z.string(),
});

export const MarketSearchPayloadSchema = z.object({
  results: z.array(MarketSearchResultSchema),
});

export const MarketQuoteSchema = z.object({
  ticker: z.string(),
  price: nullableNumber,
  prev_close: nullableNumber,
  change: nullableNumber,
  change_pct: nullableNumber,
  day_high: nullableNumber,
  day_low: nullableNumber,
  wk52_high: nullableNumber,
  wk52_low: nullableNumber,
  market_cap: nullableNumber,
  currency: nullableString,
  volume: nullableNumber,
});

export const MarketCandleSchema = z.object({
  date: z.string(),
  close: z.number(),
  volume: nullableNumber,
});

export const MarketHistoryPayloadSchema = z.object({
  series: z.array(MarketCandleSchema),
});

export const MarketNewsItemSchema = z.object({
  title: z.string(),
  publisher: z.string(),
  link: z.string(),
  date: nullableString,
  thumbnail: nullableString,
});

export const MarketNewsPayloadSchema = z.object({
  news: z.array(MarketNewsItemSchema),
});

// ── Auth ──────────────────────────────────────────────────────────────────────

export const AuthUserSchema = z.object({
  id: z.string(),
  provider: z.string(),
  email: z.string(),
  name: z.string(),
  created_at: z.string(),
});

export const AuthSessionSchema = z.object({
  authenticated: z.boolean(),
  required: z.boolean(),
  user: AuthUserSchema.nullable().optional().transform((value) => value ?? null),
});

export const AuthProvidersSchema = z.object({
  providers: z.object({
    local: z.boolean(),
    google: z.boolean(),
    apple: z.boolean(),
    passkey: z.boolean(),
  }),
});
