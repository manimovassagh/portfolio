import { useCallback, useEffect, useRef, useState } from 'react';
import Chart from 'react-apexcharts';
import { ExternalLink, Newspaper, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { Card } from '../ui/Card';
import { marketHistory, marketNews, marketQuote, marketSearch } from '../../api';
import type { MarketCandle, MarketNewsItem, MarketQuote, MarketSearchResult } from '../../types';

type Range = '1D' | '1W' | '1M' | '6M' | '1Y' | '5Y';
const RANGES: Range[] = ['1D', '1W', '1M', '6M', '1Y', '5Y'];

function fmtPrice(n: number | null | undefined, currency?: string | null): string {
  if (n == null) return '—';
  const sym = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : '€';
  return `${sym}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtLargeNum(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `${(n / 1e6).toFixed(2)}M`;
  return n.toLocaleString();
}

const DEFAULT: MarketSearchResult = { ticker: 'AAPL', name: 'Apple Inc.', type: 'EQUITY', exchange: 'NMS' };

const QUICK_PICKS: Array<{ category: string; items: MarketSearchResult[] }> = [
  {
    category: 'Popular ETFs',
    items: [
      { ticker: 'VWCE.DE', name: 'Vanguard FTSE All-World',    type: 'ETF',    exchange: 'XETRA' },
      { ticker: 'EUNL.DE', name: 'iShares MSCI World',         type: 'ETF',    exchange: 'XETRA' },
      { ticker: 'SXR8.DE', name: 'iShares Core S&P 500',       type: 'ETF',    exchange: 'XETRA' },
      { ticker: 'EXXT.DE', name: 'iShares NASDAQ 100',         type: 'ETF',    exchange: 'XETRA' },
      { ticker: 'XDWD.DE', name: 'Xtrackers MSCI World',       type: 'ETF',    exchange: 'XETRA' },
      { ticker: 'VUSA.L',  name: 'Vanguard S&P 500 (GBP)',     type: 'ETF',    exchange: 'LSE'   },
    ],
  },
  {
    category: 'US Stocks',
    items: [
      { ticker: 'AAPL',    name: 'Apple',                      type: 'EQUITY', exchange: 'NASDAQ' },
      { ticker: 'MSFT',    name: 'Microsoft',                  type: 'EQUITY', exchange: 'NASDAQ' },
      { ticker: 'NVDA',    name: 'Nvidia',                     type: 'EQUITY', exchange: 'NASDAQ' },
      { ticker: 'GOOGL',   name: 'Alphabet',                   type: 'EQUITY', exchange: 'NASDAQ' },
      { ticker: 'AMZN',    name: 'Amazon',                     type: 'EQUITY', exchange: 'NASDAQ' },
      { ticker: 'META',    name: 'Meta',                       type: 'EQUITY', exchange: 'NASDAQ' },
      { ticker: 'TSLA',    name: 'Tesla',                      type: 'EQUITY', exchange: 'NASDAQ' },
    ],
  },
  {
    category: 'EU Stocks',
    items: [
      { ticker: 'SAP.DE',  name: 'SAP',                        type: 'EQUITY', exchange: 'XETRA' },
      { ticker: 'ASML.AS', name: 'ASML',                       type: 'EQUITY', exchange: 'AEX'   },
      { ticker: 'SIE.DE',  name: 'Siemens',                    type: 'EQUITY', exchange: 'XETRA' },
      { ticker: 'ALV.DE',  name: 'Allianz',                    type: 'EQUITY', exchange: 'XETRA' },
      { ticker: 'VOW3.DE', name: 'Volkswagen',                  type: 'EQUITY', exchange: 'XETRA' },
      { ticker: 'BMW.DE',  name: 'BMW',                        type: 'EQUITY', exchange: 'XETRA' },
    ],
  },
  {
    category: 'Crypto',
    items: [
      { ticker: 'BTC-EUR', name: 'Bitcoin',                    type: 'CRYPTOCURRENCY', exchange: 'CCC' },
      { ticker: 'ETH-EUR', name: 'Ethereum',                   type: 'CRYPTOCURRENCY', exchange: 'CCC' },
      { ticker: 'SOL-EUR', name: 'Solana',                     type: 'CRYPTOCURRENCY', exchange: 'CCC' },
      { ticker: 'XRP-EUR', name: 'XRP',                        type: 'CRYPTOCURRENCY', exchange: 'CCC' },
    ],
  },
];

export function MarketsView() {
  const [query, setQuery]         = useState('AAPL — Apple Inc.');
  const [results, setResults]     = useState<MarketSearchResult[]>([]);
  const [showDrop, setShowDrop]   = useState(false);
  const [selected, setSelected]   = useState<MarketSearchResult | null>(DEFAULT);
  const [quote, setQuote]         = useState<MarketQuote | null>(null);
  const [candles, setCandles]     = useState<MarketCandle[]>([]);
  const [news, setNews]           = useState<MarketNewsItem[]>([]);
  const [range, setRange]         = useState<Range>('1M');
  const [loadingQuote, setLoadingQuote]   = useState(false);
  const [loadingChart, setLoadingChart]   = useState(false);
  const [loadingNews, setLoadingNews]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const searchRef   = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load default on mount
  useEffect(() => {
    loadQuoteAndChart(DEFAULT.ticker, '1M');
    setLoadingNews(true);
    marketNews(DEFAULT.ticker).then(setNews).catch(() => setNews([])).finally(() => setLoadingNews(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDrop(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleInput = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 1) { setResults([]); setShowDrop(false); return; }
    debounceRef.current = setTimeout(async () => {
      const r = await marketSearch(val.trim()).catch(() => []);
      setResults(r);
      setShowDrop(r.length > 0);
    }, 280);
  };

  const loadQuoteAndChart = useCallback(async (ticker: string, r: Range) => {
    setError(null);
    setLoadingQuote(true);
    setLoadingChart(true);
    try {
      const [q, h] = await Promise.all([
        marketQuote(ticker),
        marketHistory(ticker, r),
      ]);
      setQuote(q);
      setCandles(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load market data');
    } finally {
      setLoadingQuote(false);
      setLoadingChart(false);
    }
  }, []);

  const selectStock = (result: MarketSearchResult) => {
    setSelected(result);
    setQuery(`${result.ticker} — ${result.name}`);
    setShowDrop(false);
    setNews([]);
    loadQuoteAndChart(result.ticker, range);
    setLoadingNews(true);
    marketNews(result.ticker)
      .then(setNews)
      .catch(() => setNews([]))
      .finally(() => setLoadingNews(false));
  };

  const changeRange = (r: Range) => {
    setRange(r);
    if (selected) loadQuoteAndChart(selected.ticker, r);
  };

  const isUp = (quote?.change ?? 0) >= 0;
  const chartColor = isUp ? '#10b981' : '#f43f5e';

  const chartOptions: ApexCharts.ApexOptions = {
    chart: { type: 'area', toolbar: { show: false }, animations: { enabled: false }, background: 'transparent', sparkline: { enabled: false } },
    stroke: { curve: 'smooth', width: 2, colors: [chartColor] },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.25, opacityTo: 0.0, stops: [0, 100], colorStops: [{ offset: 0, color: chartColor, opacity: 0.25 }, { offset: 100, color: chartColor, opacity: 0 }] } },
    xaxis: {
      type: 'category',
      categories: candles.map((c) => c.date),
      labels: { show: candles.length < 100, rotate: 0, style: { colors: '#64748b', fontSize: '10px' }, formatter: (v) => v?.slice(0, 10) ?? '' },
      axisBorder: { show: false },
      axisTicks: { show: false },
      tickAmount: 6,
    },
    yaxis: { labels: { style: { colors: '#64748b', fontSize: '11px' }, formatter: (v) => fmtPrice(v, quote?.currency) }, opposite: true },
    grid: { borderColor: 'rgba(100,116,139,0.12)', strokeDashArray: 4 },
    tooltip: { theme: 'dark', x: { show: true }, y: { formatter: (v) => fmtPrice(v, quote?.currency) } },
    dataLabels: { enabled: false },
  };

  const chartSeries = [{ name: selected?.ticker ?? '', data: candles.map((c) => c.close) }];

  return (
    <section className="space-y-6">
      {/* Search */}
      <Card className="p-5">
        <div ref={searchRef} className="relative">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-[#45b9a8] focus-within:ring-2 focus-within:ring-[#45b9a8]/20 dark:border-slate-700 dark:bg-slate-800/60">
            <Search size={18} className="shrink-0 text-slate-400" />
            <input
              className="flex-1 bg-transparent text-sm font-semibold text-slate-900 placeholder-slate-400 outline-none dark:text-slate-100"
              placeholder="Search ticker or company name — e.g. AAPL, Tesla, VWCE.DE"
              value={query}
              onChange={(e) => handleInput(e.target.value)}
              onFocus={() => results.length > 0 && setShowDrop(true)}
            />
          </div>
          {showDrop && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-[#1e1e1e]">
              {results.map((r) => (
                <button
                  key={r.ticker}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
                  onClick={() => selectStock(r)}
                >
                  <span className="num w-20 shrink-0 font-black text-slate-900 dark:text-white">{r.ticker}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-500">{r.name}</span>
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-400 dark:bg-slate-700">{r.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick picks */}
        <div className="mt-4 space-y-3">
          {QUICK_PICKS.map((group) => (
            <div key={group.category}>
              <div className="mb-2 text-xs font-extrabold uppercase tracking-widest text-slate-400">{group.category}</div>
              <div className="flex flex-wrap gap-2">
                {group.items.map((item) => {
                  const active = selected?.ticker === item.ticker;
                  return (
                    <button
                      key={item.ticker}
                      onClick={() => selectStock(item)}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                        active
                          ? 'border-[#45b9a8]/40 bg-[#45b9a8]/15 text-[#45b9a8]'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-[#45b9a8]/30 hover:bg-[#45b9a8]/8 hover:text-[#45b9a8] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <span className="num font-black">{item.ticker}</span>
                      <span className="hidden text-slate-400 sm:inline">· {item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {error && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-500">{error}</div>
      )}

      {selected && (
        <>
          {/* Quote panel */}
          <Card className="p-5">
            {loadingQuote ? (
              <div className="h-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            ) : quote && (
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-widest text-slate-400">{selected.exchange} · {selected.type}</div>
                  <div className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{selected.name}</div>
                  <div className="num text-xs text-slate-400">{selected.ticker}</div>
                </div>
                <div className="text-right">
                  <div className="num text-4xl font-black text-slate-900 dark:text-white">{fmtPrice(quote.price, quote.currency)}</div>
                  <div className={`num mt-1 flex items-center justify-end gap-1.5 text-base font-black ${isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {isUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    {quote.change != null && (quote.change >= 0 ? '+' : '')}{fmtPrice(quote.change, quote.currency)}
                    <span>({quote.change_pct != null ? `${quote.change_pct >= 0 ? '+' : ''}${quote.change_pct.toFixed(2)}%` : '—'})</span>
                  </div>
                </div>
              </div>
            )}
            {quote && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Day range',    value: `${fmtPrice(quote.day_low, quote.currency)} – ${fmtPrice(quote.day_high, quote.currency)}` },
                  { label: '52w range',    value: `${fmtPrice(quote.wk52_low, quote.currency)} – ${fmtPrice(quote.wk52_high, quote.currency)}` },
                  { label: 'Market cap',   value: fmtLargeNum(quote.market_cap) },
                  { label: 'Avg. volume',  value: fmtLargeNum(quote.volume) },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                    <div className="text-xs font-extrabold uppercase tracking-wide text-slate-400">{s.label}</div>
                    <div className="num mt-1 text-sm font-black text-slate-900 dark:text-white">{s.value}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Chart */}
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-sm font-black text-slate-900 dark:text-white">Price history</div>
              <div className="flex gap-1">
                {RANGES.map((r) => (
                  <button key={r} onClick={() => changeRange(r)}
                    className={`rounded-md px-2.5 py-1 text-xs font-black transition ${range === r ? 'bg-[#45b9a8] text-white' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            {loadingChart ? (
              <div className="h-56 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            ) : candles.length > 0 ? (
              <Chart options={chartOptions} series={chartSeries} type="area" height={240} />
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-slate-400">No chart data available</div>
            )}
          </Card>

          {/* News */}
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Newspaper size={17} className="text-slate-400" />
              <div className="text-sm font-black text-slate-900 dark:text-white">Latest news</div>
            </div>
            {loadingNews ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />)}
              </div>
            ) : news.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {news.map((item, i) => (
                  <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
                    className="group flex items-start gap-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-5 px-5 transition">
                    {item.thumbnail && (
                      <img src={item.thumbnail} alt="" className="mt-0.5 h-12 w-20 shrink-0 rounded object-cover" loading="lazy" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-900 group-hover:text-[#45b9a8] dark:text-slate-100 leading-snug">{item.title}</div>
                      <div className="mt-1 text-xs text-slate-400">{item.publisher}{item.date ? ` · ${item.date}` : ''}</div>
                    </div>
                    <ExternalLink size={14} className="mt-1 shrink-0 text-slate-300 group-hover:text-[#45b9a8]" />
                  </a>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-slate-400">No news available for {selected.ticker}</div>
            )}
          </Card>
        </>
      )}

      {!selected && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <Search size={40} className="text-slate-200 dark:text-slate-700" />
          <p className="text-sm font-semibold text-slate-400">Search for any stock, ETF, or crypto above</p>
          <p className="text-xs text-slate-300 dark:text-slate-600">Real-time price · history chart · latest news</p>
        </div>
      )}
    </section>
  );
}
