// API client for the Kapital backend. Mirrors the web app's api.ts but uses
// a configurable base URL so the mobile app can point to a local or remote backend.

import AsyncStorage from '@react-native-async-storage/async-storage';

// Change this to your backend URL when running on a physical device.
// For iOS simulator / Android emulator talking to localhost, use the LAN IP.
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'https://localhost:8766';

// ── Types ────────────────────────────────────────────────────────────────────

export type Summary = {
  export: string;
  portfolio_value: number;
  market_value: number;
  cash_balance: number;
  cost_basis: number;
  net_deposits: number;
  unrealized_pnl: number;
  unrealized_pct: number;
  realized_pnl: number;
  total_return: number;
  xirr: number | null;
  dividends: number;
  n_holdings: number;
  holder_name: string;
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
};

export type WatchlistItem = {
  isin: string;
  ticker: string;
  name: string;
  notes: string;
  target_price: number | null;
  current_price: number | null;
};

export type MarketSearchResult = { ticker: string; name: string; exchange: string; type: string };
export type MarketQuote = {
  ticker: string;
  price: number;
  prev_close: number;
  change: number;
  change_pct: number;
  currency: string;
  market_cap: number | null;
};

export type AuthSession = {
  authenticated: boolean;
  required: boolean;
  user: { id: string; name: string; email: string } | null;
};

// ── HTTP helpers ─────────────────────────────────────────────────────────────

const SESSION_KEY = 'kapital_session_token';

async function getSessionToken(): Promise<string | null> {
  return AsyncStorage.getItem(SESSION_KEY);
}

export async function saveSessionToken(token: string): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, token);
}

export async function clearSessionToken(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

async function headers(): Promise<Record<string, string>> {
  const token = await getSessionToken();
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['X-Session-Token'] = token;
  return h;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: await headers(),
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: await headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(err?.error ?? `POST ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function getAuthSession(): Promise<AuthSession> {
  return get<AuthSession>('/api/auth/session');
}

export async function devLogin(): Promise<AuthSession> {
  return post<AuthSession>('/api/auth/dev');
}

export async function logout(): Promise<void> {
  await post('/api/auth/logout');
  await clearSessionToken();
}

// ── Portfolio data ────────────────────────────────────────────────────────────

export async function getSummary(exportName = ''): Promise<Summary> {
  const q = exportName ? `?export=${encodeURIComponent(exportName)}` : '';
  return get<Summary>(`/api/summary${q}`);
}

export async function getHoldings(exportName = ''): Promise<{ holdings: Holding[]; total_market_value: number | null }> {
  const q = exportName ? `?export=${encodeURIComponent(exportName)}` : '';
  return get(`/api/holdings${q}`);
}

export async function listExports(): Promise<string[]> {
  const data = await get<{ exports: string[] }>('/api/exports');
  return data.exports;
}

// ── Watchlist ─────────────────────────────────────────────────────────────────

export async function getWatchlist(): Promise<WatchlistItem[]> {
  const data = await get<{ items: WatchlistItem[] }>('/api/watchlist');
  return data.items ?? [];
}

export async function addToWatchlist(isin: string): Promise<void> {
  await post('/api/watchlist', { isin });
}

export async function removeFromWatchlist(isin: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/watchlist/${isin}`, {
    method: 'DELETE',
    headers: await headers(),
  });
  if (!res.ok) throw new Error(`DELETE watchlist/${isin} → ${res.status}`);
}

// ── Markets ───────────────────────────────────────────────────────────────────

export async function searchMarket(query: string): Promise<MarketSearchResult[]> {
  const data = await get<{ results: MarketSearchResult[] }>(`/api/market/search?q=${encodeURIComponent(query)}`);
  return data.results ?? [];
}

export async function getMarketQuote(ticker: string): Promise<MarketQuote> {
  return get<MarketQuote>(`/api/market/quote?ticker=${encodeURIComponent(ticker)}`);
}
