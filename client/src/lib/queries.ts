import { useQuery } from '@tanstack/react-query';
import {
  fetchDividendCalendar,
  fetchFsa,
  fetchGeographic,
  fetchWatchlist,
  loadDashboard,
} from '../api';
import type { ExportName } from '../types';

// ── Overview / Dashboard ────────────────────────────────────────────────────
export function useOverviewQuery(exportName: ExportName) {
  return useQuery({
    queryKey: ['dashboard', exportName],
    queryFn: () => loadDashboard(exportName),
    staleTime: 60_000,
    enabled: Boolean(exportName),
  });
}

// ── Analytics (geographic sub-query used inside AnalyticsView) ────────────
export function useGeographicQuery(exportName: ExportName) {
  return useQuery({
    queryKey: ['geographic', exportName],
    queryFn: () => fetchGeographic(exportName),
    staleTime: 120_000,
    enabled: Boolean(exportName),
  });
}

// ── Income (dividend calendar sub-query used inside IncomeView) ───────────
export function useDividendCalendarQuery(exportName: ExportName) {
  return useQuery({
    queryKey: ['dividendCalendar', exportName],
    queryFn: () => fetchDividendCalendar(exportName),
    staleTime: 300_000,
    enabled: Boolean(exportName),
  });
}

// ── Tax (FSA sub-query used inside TaxView) ───────────────────────────────
export function useFsaQuery(exportName: ExportName, joint: boolean) {
  return useQuery({
    queryKey: ['fsa', exportName, joint],
    queryFn: () => fetchFsa(exportName, joint),
    staleTime: 300_000,
    enabled: Boolean(exportName),
  });
}

// ── Watchlist ─────────────────────────────────────────────────────────────
export function useWatchlistQuery() {
  return useQuery({
    queryKey: ['watchlist'],
    queryFn: fetchWatchlist,
    staleTime: 30_000,
  });
}
