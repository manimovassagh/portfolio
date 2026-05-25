import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listExportCatalog, listExports, marketQuote, getAuthSession } from '../api';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('listExports', () => {
  it('returns the array of export names from the response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ exports: ['trading-212.csv', 'ibkr.csv'] }),
    }));

    const result = await listExports();
    expect(result).toEqual(['trading-212.csv', 'ibkr.csv']);
  });

  it('returns export metadata when present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        exports: ['trade-republic.csv'],
        export_infos: [{
          name: 'trade-republic.csv',
          label: 'Max Musterman · Trade Republic · 2026-04',
          holder_name: 'Max Musterman',
          broker: 'Trade Republic',
          imported_at: '2026-05-25T00:00:00Z',
          first_date: '2025-01-01',
          last_date: '2026-04-12',
          transaction_count: 42,
        }],
      }),
    }));

    const result = await listExportCatalog();
    expect(result.export_infos[0].label).toBe('Max Musterman · Trade Republic · 2026-04');
    expect(result.export_infos[0].transaction_count).toBe(42);
  });

  it('throws when the server returns a non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    }));

    await expect(listExports()).rejects.toThrow('401');
  });
});

describe('marketQuote', () => {
  it('returns a quote object with ticker and price fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ticker: 'AAPL',
        price: 214.5,
        prev_close: 210.0,
        change: 4.5,
        change_pct: 2.14,
        day_high: 216.0,
        day_low: 209.5,
        wk52_high: 260.0,
        wk52_low: 165.0,
        market_cap: 3200000000000,
        currency: 'USD',
        volume: 58000000,
      }),
    }));

    const quote = await marketQuote('AAPL');
    expect(quote.ticker).toBe('AAPL');
    expect(quote.price).toBe(214.5);
    expect(quote.change_pct).toBe(2.14);
  });
});

describe('getAuthSession', () => {
  it('returns an unauthenticated session correctly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: false, required: true, user: null }),
    }));

    const session = await getAuthSession();
    expect(session.authenticated).toBe(false);
    expect(session.required).toBe(true);
    expect(session.user).toBeNull();
  });

  it('returns an authenticated session with user data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        authenticated: true,
        required: false,
        user: {
          id: 'usr_123',
          provider: 'google',
          email: 'test@example.com',
          name: 'Test User',
          created_at: '2024-01-01T00:00:00Z',
        },
      }),
    }));

    const session = await getAuthSession();
    expect(session.authenticated).toBe(true);
    expect(session.user?.email).toBe('test@example.com');
    expect(session.user?.provider).toBe('google');
  });
});
