import type {
  Analytics,
  AssetDetail,
  CashFlow,
  DashboardData,
  ExportName,
  Holding,
  IncomeRow,
  Performance,
  RealizedRow,
  Summary,
  TaxRow,
} from './types';

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} failed with HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export async function listExports(): Promise<ExportName[]> {
  const payload = await getJson<{ exports: ExportName[] }>('/api/exports');
  return payload.exports;
}

export async function loadDashboard(exportName: ExportName): Promise<DashboardData> {
  const q = `?export=${encodeURIComponent(exportName)}`;
  const [exports, summary, holdingsPayload, perf, cashFlow, incomePayload, realizedPayload, taxPayload, analytics] =
    await Promise.all([
      listExports(),
      getJson<Summary>(`/api/summary${q}`),
      getJson<{ holdings: Holding[]; total_market_value: number }>(`/api/holdings${q}`),
      getJson<Performance>(`/api/performance${q}`),
      getJson<CashFlow>(`/api/cash_flow${q}`),
      getJson<{ log: IncomeRow[]; totals: Record<string, number> }>(`/api/income${q}`),
      getJson<{ realized: RealizedRow[]; total: number }>(`/api/realized${q}`),
      getJson<{ records: TaxRow[] }>(`/api/tax${q}`),
      getJson<Analytics>(`/api/analytics${q}`),
    ]);

  return {
    exports,
    summary,
    holdings: holdingsPayload.holdings,
    totalMV: holdingsPayload.total_market_value,
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

export async function loadAsset(isin: string, exportName: ExportName): Promise<AssetDetail> {
  return getJson<AssetDetail>(`/api/asset/${encodeURIComponent(isin)}?export=${encodeURIComponent(exportName)}`);
}

export async function uploadExport(file: File): Promise<{ filename: string; exports: ExportName[] }> {
  const body = new FormData();
  body.append('file', file);
  const response = await fetch('/api/upload', { method: 'POST', body });
  if (!response.ok) throw new Error(`Upload failed with HTTP ${response.status}`);
  return response.json() as Promise<{ filename: string; exports: ExportName[] }>;
}
