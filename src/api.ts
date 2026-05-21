import type {
  Analytics,
  AssetDetail,
  CashFlow,
  DashboardData,
  DividendCalendarData,
  ExportName,
  FsaData,
  GeographicData,
  Holding,
  IncomeRow,
  MarketCandle,
  MarketNewsItem,
  MarketQuote,
  MarketSearchResult,
  Performance,
  PositionReturns,
  RealizedRow,
  Summary,
  TaxRow,
  WatchlistData,
  WatchlistItem,
} from './types';

import {
  AnalyticsSchema,
  AssetDetailSchema,
  CashFlowSchema,
  DividendCalendarDataSchema,
  ExportsPayloadSchema,
  FsaDataSchema,
  GeographicDataSchema,
  HoldingsPayloadSchema,
  IncomePayloadSchema,
  MarketHistoryPayloadSchema,
  MarketNewsPayloadSchema,
  MarketQuoteSchema,
  MarketSearchPayloadSchema,
  PerformanceSchema,
  PositionReturnsPayloadSchema,
  RealizedPayloadSchema,
  SummarySchema,
  TaxPayloadSchema,
  WatchlistDataSchema,
} from './schemas';

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} failed with HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export async function listExports(): Promise<ExportName[]> {
  const raw = await getJson<unknown>('/api/exports');
  const payload = ExportsPayloadSchema.parse(raw);
  return payload.exports;
}

export async function loadDashboard(exportName: ExportName): Promise<DashboardData> {
  const q = `?export=${encodeURIComponent(exportName)}`;
  const [exports, summary] = await Promise.all([
    listExports(),
    getJson<unknown>(`/api/summary${q}`).then((r) => SummarySchema.parse(r) as Summary),
  ]);
  const [holdingsPayload, positionReturnsPayload, perf, cashFlow, incomePayload, realizedPayload, taxPayload, analytics] =
    await Promise.all([
      getJson<unknown>(`/api/holdings${q}`).then((r) =>
        HoldingsPayloadSchema.parse(r) as { holdings: Holding[]; total_market_value: number | null },
      ),
      getJson<unknown>(`/api/position_returns${q}`).then((r) =>
        PositionReturnsPayloadSchema.parse(r) as { returns: PositionReturns },
      ),
      getJson<unknown>(`/api/performance${q}`).then((r) => PerformanceSchema.parse(r) as Performance),
      getJson<unknown>(`/api/cash_flow${q}`).then((r) => CashFlowSchema.parse(r) as CashFlow),
      getJson<unknown>(`/api/income${q}`).then((r) =>
        IncomePayloadSchema.parse(r) as { log: IncomeRow[]; totals: Record<string, number> },
      ),
      getJson<unknown>(`/api/realized${q}`).then((r) =>
        RealizedPayloadSchema.parse(r) as { realized: RealizedRow[]; total: number },
      ),
      getJson<unknown>(`/api/tax${q}`).then((r) => TaxPayloadSchema.parse(r) as { records: TaxRow[] }),
      getJson<unknown>(`/api/analytics${q}`).then((r) => AnalyticsSchema.parse(r) as Analytics),
    ]);

  return {
    exports,
    summary,
    holdings: holdingsPayload.holdings,
    positionReturns: positionReturnsPayload.returns,
    totalMV: holdingsPayload.total_market_value ?? 0,
    perf,
    cashFlow,
    income: incomePayload.log,
    incomeTotals: incomePayload.totals,
    realized: realizedPayload.realized,
    realizedTotal: realizedPayload.total,
    tax: taxPayload.records,
    analytics,
  };
}

export async function refreshPrices(exportName: ExportName): Promise<void> {
  const response = await fetch(`/api/refresh_prices?export=${encodeURIComponent(exportName)}`, { method: 'POST' });
  if (!response.ok) throw new Error(`Price refresh failed with HTTP ${response.status}`);
}

export async function loadAsset(isin: string, exportName: ExportName): Promise<AssetDetail> {
  const raw = await getJson<unknown>(`/api/asset/${encodeURIComponent(isin)}?export=${encodeURIComponent(exportName)}`);
  return AssetDetailSchema.parse(raw) as AssetDetail;
}

export async function fetchGeographic(exportName: ExportName): Promise<GeographicData> {
  const raw = await getJson<unknown>(`/api/geographic?export=${encodeURIComponent(exportName)}`);
  return GeographicDataSchema.parse(raw) as GeographicData;
}

export async function fetchFsa(exportName: ExportName, joint = false): Promise<FsaData> {
  const q = new URLSearchParams({ export: exportName, joint: String(joint) });
  const raw = await getJson<unknown>(`/api/fsa?${q}`);
  return FsaDataSchema.parse(raw) as FsaData;
}

export async function marketSearch(q: string): Promise<MarketSearchResult[]> {
  const raw = await getJson<unknown>(`/api/market/search?q=${encodeURIComponent(q)}`);
  return MarketSearchPayloadSchema.parse(raw).results as MarketSearchResult[];
}

export async function marketQuote(ticker: string): Promise<MarketQuote> {
  const raw = await getJson<unknown>(`/api/market/quote?ticker=${encodeURIComponent(ticker)}`);
  return MarketQuoteSchema.parse(raw) as MarketQuote;
}

export async function marketHistory(ticker: string, range: string): Promise<MarketCandle[]> {
  const raw = await getJson<unknown>(`/api/market/history?ticker=${encodeURIComponent(ticker)}&range=${range}`);
  return MarketHistoryPayloadSchema.parse(raw).series as MarketCandle[];
}

export async function marketNews(ticker: string): Promise<MarketNewsItem[]> {
  const raw = await getJson<unknown>(`/api/market/news?ticker=${encodeURIComponent(ticker)}`);
  return MarketNewsPayloadSchema.parse(raw).news as MarketNewsItem[];
}

export async function fetchWatchlist(): Promise<WatchlistData> {
  const raw = await getJson<unknown>('/api/watchlist');
  return WatchlistDataSchema.parse(raw) as WatchlistData;
}

export async function addWatchlistItem(item: Omit<WatchlistItem, 'added_date' | 'current_price'>): Promise<WatchlistData> {
  const response = await fetch('/api/watchlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!response.ok) throw new Error(`Add watchlist item failed with HTTP ${response.status}`);
  return response.json() as Promise<WatchlistData>;
}

export async function removeWatchlistItem(isin: string): Promise<WatchlistData> {
  const response = await fetch(`/api/watchlist/${encodeURIComponent(isin)}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(`Remove watchlist item failed with HTTP ${response.status}`);
  return response.json() as Promise<WatchlistData>;
}

export async function fetchDividendCalendar(exportName: ExportName): Promise<DividendCalendarData> {
  const raw = await getJson<unknown>(`/api/dividend_calendar?export=${encodeURIComponent(exportName)}`);
  return DividendCalendarDataSchema.parse(raw) as DividendCalendarData;
}

export async function uploadExport(file: File): Promise<{ filename: string; exports: ExportName[] }> {
  const body = new FormData();
  body.append('file', file);
  const response = await fetch('/api/upload', { method: 'POST', body });
  if (!response.ok) throw new Error(`Upload failed with HTTP ${response.status}`);
  return response.json() as Promise<{ filename: string; exports: ExportName[] }>;
}
