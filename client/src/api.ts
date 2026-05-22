import type {
  Analytics,
  AssetDetail,
  AuthProviders,
  AuthSession,
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
  AuthProvidersSchema,
  AuthSessionSchema,
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
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`${url} failed with HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

async function postJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { method: 'POST', credentials: 'same-origin' });
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(detail?.error || `${url} failed with HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function getAuthSession(): Promise<AuthSession> {
  const raw = await getJson<unknown>('/api/auth/session');
  return AuthSessionSchema.parse(raw) as AuthSession;
}

export async function getAuthProviders(): Promise<AuthProviders> {
  const raw = await getJson<unknown>('/api/auth/providers');
  return AuthProvidersSchema.parse(raw) as AuthProviders;
}

export async function loginWithGoogle(): Promise<AuthSession> {
  const raw = await postJson<unknown>('/api/auth/google');
  return AuthSessionSchema.parse(raw) as AuthSession;
}

export async function loginWithApple(): Promise<AuthSession> {
  const raw = await postJson<unknown>('/api/auth/apple');
  return AuthSessionSchema.parse(raw) as AuthSession;
}

// Helpers to convert between base64url strings and ArrayBuffers (WebAuthn requires ArrayBuffers).
function b64urlToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}
function bufferToB64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function registerPasskey(username: string): Promise<AuthSession> {
  // Step 1: begin — get challenge options from server.
  const begin = await fetch('/api/auth/passkey/register/begin', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (!begin.ok) throw new Error('Passkey registration begin failed');
  const { session_id, options } = await begin.json() as { session_id: string; options: { publicKey: Record<string, unknown> } };

  // Decode base64url fields to ArrayBuffers for the browser WebAuthn API.
  const pk = options.publicKey;
  pk.challenge = b64urlToBuffer(pk.challenge as string);
  pk.user = { ...(pk.user as Record<string, unknown>), id: b64urlToBuffer((pk.user as { id: string }).id) };
  if (Array.isArray(pk.excludeCredentials)) {
    pk.excludeCredentials = (pk.excludeCredentials as Array<{ id: string }>).map((c) => ({ ...c, id: b64urlToBuffer(c.id) }));
  }

  // Step 2: create credential in browser.
  const credential = await navigator.credentials.create({ publicKey: pk as unknown as PublicKeyCredentialCreationOptions });
  if (!credential) throw new Error('Credential creation was cancelled');
  const pkc = credential as PublicKeyCredential;
  const resp = pkc.response as AuthenticatorAttestationResponse;

  // Encode response for the server.
  const encoded = {
    id: pkc.id, rawId: bufferToB64url(pkc.rawId),
    type: pkc.type,
    response: {
      clientDataJSON: bufferToB64url(resp.clientDataJSON),
      attestationObject: bufferToB64url(resp.attestationObject),
    },
  };

  // Step 3: finish — send attestation to server.
  const finish = await fetch('/api/auth/passkey/register/finish', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Session-Id': session_id, 'X-Username': username },
    body: JSON.stringify(encoded),
  });
  if (!finish.ok) {
    const err = await finish.json().catch(() => null) as { error?: string } | null;
    throw new Error(err?.error || 'Passkey registration finish failed');
  }
  return AuthSessionSchema.parse(await finish.json()) as AuthSession;
}

export async function loginWithPasskey(): Promise<AuthSession> {
  // Step 1: begin — get assertion challenge from server.
  const begin = await fetch('/api/auth/passkey/login/begin', {
    method: 'POST', credentials: 'same-origin',
  });
  if (!begin.ok) throw new Error('Passkey login begin failed');
  const { session_id, options } = await begin.json() as { session_id: string; options: { publicKey: Record<string, unknown> } };

  // Decode challenge.
  const pk = options.publicKey;
  pk.challenge = b64urlToBuffer(pk.challenge as string);
  if (Array.isArray(pk.allowCredentials)) {
    pk.allowCredentials = (pk.allowCredentials as Array<{ id: string }>).map((c) => ({ ...c, id: b64urlToBuffer(c.id) }));
  }

  // Step 2: get assertion from browser.
  const credential = await navigator.credentials.get({ publicKey: pk as unknown as PublicKeyCredentialRequestOptions });
  if (!credential) throw new Error('Authentication was cancelled');
  const pkc = credential as PublicKeyCredential;
  const resp = pkc.response as AuthenticatorAssertionResponse;

  const encoded = {
    id: pkc.id, rawId: bufferToB64url(pkc.rawId),
    type: pkc.type,
    response: {
      clientDataJSON: bufferToB64url(resp.clientDataJSON),
      authenticatorData: bufferToB64url(resp.authenticatorData),
      signature: bufferToB64url(resp.signature),
      userHandle: resp.userHandle ? bufferToB64url(resp.userHandle) : null,
    },
  };

  // Step 3: finish — verify assertion.
  const finish = await fetch('/api/auth/passkey/login/finish', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-Session-Id': session_id },
    body: JSON.stringify(encoded),
  });
  if (!finish.ok) {
    const err = await finish.json().catch(() => null) as { error?: string } | null;
    throw new Error(err?.error || 'Passkey login failed');
  }
  return AuthSessionSchema.parse(await finish.json()) as AuthSession;
}

export async function loginInDevMode(): Promise<AuthSession> {
  const raw = await postJson<unknown>('/api/auth/dev');
  return AuthSessionSchema.parse(raw) as AuthSession;
}

export async function logout(): Promise<void> {
  await postJson<unknown>('/api/auth/logout');
}

export async function listExports(): Promise<ExportName[]> {
  const raw = await getJson<unknown>('/api/exports');
  const payload = ExportsPayloadSchema.parse(raw);
  return payload.exports;
}

export async function fetchPerformance(exportName: ExportName, benchmark?: string): Promise<Performance> {
  const params = new URLSearchParams({ export: exportName });
  if (benchmark) params.set('benchmark', benchmark);
  const raw = await getJson<unknown>(`/api/performance?${params}`);
  return PerformanceSchema.parse(raw) as Performance;
}

export async function loadDashboard(exportName: ExportName, benchmark?: string): Promise<DashboardData> {
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
      fetchPerformance(exportName, benchmark),
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
  const response = await fetch(`/api/refresh_prices?export=${encodeURIComponent(exportName)}`, { method: 'POST', credentials: 'same-origin' });
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
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!response.ok) throw new Error(`Add watchlist item failed with HTTP ${response.status}`);
  return response.json() as Promise<WatchlistData>;
}

export async function removeWatchlistItem(isin: string): Promise<WatchlistData> {
  const response = await fetch(`/api/watchlist/${encodeURIComponent(isin)}`, { method: 'DELETE', credentials: 'same-origin' });
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
  const response = await fetch('/api/upload', { method: 'POST', body, credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Upload failed with HTTP ${response.status}`);
  return response.json() as Promise<{ filename: string; exports: ExportName[] }>;
}
