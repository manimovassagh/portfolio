import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Moon, RefreshCw, Sun, Upload, User, Wifi } from 'lucide-react';
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { listExports, loadAsset, loadDashboard, uploadExport } from './api';
import { sections } from './lib/sections';
import { AssetModal } from './components/AssetModal';
import { SkeletonDashboard, EmptyState } from './components/ui/Skeleton';
import type { AssetDetail, ChartMode, DashboardData, ExportName, Holding, SectionId } from './types';

const Overview = lazy(() => import('./components/views/Overview').then((m) => ({ default: m.Overview })));
const AnalyticsView = lazy(() => import('./components/views/Analytics').then((m) => ({ default: m.AnalyticsView })));
const HoldingsView = lazy(() => import('./components/views/Holdings').then((m) => ({ default: m.HoldingsView })));
const CashView = lazy(() => import('./components/views/Cash').then((m) => ({ default: m.CashView })));
const IncomeView = lazy(() => import('./components/views/Income').then((m) => ({ default: m.IncomeView })));
const RealizedView = lazy(() => import('./components/views/Realized').then((m) => ({ default: m.RealizedView })));
const TaxView = lazy(() => import('./components/views/Tax').then((m) => ({ default: m.TaxView })));
const WatchlistView = lazy(() => import('./components/views/Watchlist').then((m) => ({ default: m.WatchlistView })));
const RebalanceView = lazy(() => import('./components/views/Rebalance').then((m) => ({ default: m.RebalanceView })));
const GoalsView = lazy(() => import('./components/views/Goals').then((m) => ({ default: m.GoalsView })));

const sectionPaths: Record<SectionId, string> = {
  overview: '/overview',
  analytics: '/analytics',
  holdings: '/holdings',
  cash: '/cash',
  income: '/income',
  realized: '/realized',
  tax: '/tax',
  watchlist: '/watchlist',
  rebalance: '/rebalance',
  goals: '/goals',
};

function sectionFromPath(pathname: string): SectionId {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized === '/') return 'overview';
  if (normalized.startsWith('/holdings/')) return 'holdings';
  return Object.entries(sectionPaths).find(([, path]) => path === normalized)?.[0] as SectionId | undefined || 'overview';
}

function assetIsinFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/holdings\/([^/]+)\/?$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export default function App() {
  const [dark, setDark]             = useState(() => localStorage.getItem('theme') !== 'light');
  const routerNavigate              = useNavigate();
  const location                    = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const active                      = sectionFromPath(location.pathname);
  const routeAssetIsin              = assetIsinFromPath(location.pathname);
  const exportParam                 = searchParams.get('export') || '';
  const cleanSearch                  = useMemo(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('export');
    const value = next.toString();
    return value ? `?${value}` : '';
  }, [searchParams]);
  const [exports, setExports]       = useState<ExportName[]>([]);
  const [exportName, setExportName] = useState<ExportName>('');
  const [data, setData]             = useState<DashboardData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [toast, setToast]           = useState<string | null>(null);
  const [modal, setModal]           = useState<AssetDetail | null>(null);
  const [chartMode, setChartMode]   = useState<ChartMode>('Value');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [liveRefresh, setLiveRefresh] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    localStorage.setItem('activeTab', active);
  }, [active]);

  useEffect(() => {
    if (location.pathname === '/') {
      routerNavigate({ pathname: sectionPaths.overview, search: cleanSearch }, { replace: true });
    }
  }, [cleanSearch, location.pathname, routerNavigate]);

  const navigate = useCallback((id: SectionId) => {
    routerNavigate({ pathname: sectionPaths[id], search: cleanSearch });
  }, [cleanSearch, routerNavigate]);

  const clearExportParam = useCallback((replace = true) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('export');
      return next;
    }, { replace });
  }, [setSearchParams]);

  const sectionHref = useCallback((id: SectionId) => {
    return `${sectionPaths[id]}${cleanSearch}`;
  }, [cleanSearch]);

  const loadByName = useCallback(async (name: string) => {
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await loadDashboard(name);
      setData(payload);
      setExports(payload.exports);
      setExportName(name);
      localStorage.setItem('selectedExport', name);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dashboard load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async (name = exportName) => {
    if (!name) return;
    clearExportParam();
    await loadByName(name);
  }, [clearExportParam, exportName, loadByName]);

  useEffect(() => {
    if (!liveRefresh || !exportName) return;
    const id = window.setInterval(() => {
      if (!document.hidden) void loadByName(exportName);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [exportName, liveRefresh, loadByName]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    listExports()
      .then((items) => {
        if (!mounted) return;
        setExports(items);
        const saved = localStorage.getItem('selectedExport') || '';
        const chosen = items.includes(exportParam)
          ? exportParam
          : items.includes(saved)
            ? saved
            : items[0] || '';
        setExportName(chosen);
        if (exportParam) clearExportParam(true);
        if (chosen) loadByName(chosen); else setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not list exports');
        setLoading(false);
      });
    return () => { mounted = false; };
  }, [clearExportParam, exportParam, loadByName]);

  const openAsset = useCallback((holding: Holding) => {
    routerNavigate({ pathname: `/holdings/${encodeURIComponent(holding.isin)}`, search: cleanSearch });
  }, [cleanSearch, routerNavigate]);

  const closeAsset = useCallback(() => {
    setModal(null);
    routerNavigate({ pathname: sectionPaths.holdings, search: cleanSearch });
  }, [cleanSearch, routerNavigate]);

  useEffect(() => {
    let mounted = true;
    if (!routeAssetIsin || !exportName) {
      setModal(null);
      return () => { mounted = false; };
    }

    loadAsset(routeAssetIsin, exportName)
      .then((asset) => { if (mounted) setModal(asset); })
      .catch((err) => {
        if (!mounted) return;
        setModal(null);
        setError(err instanceof Error ? err.message : 'Asset load failed');
      });

    return () => { mounted = false; };
  }, [exportName, routeAssetIsin]);

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    const payload = await uploadExport(file);
    setExports(payload.exports);
    setExportName(payload.filename);
    localStorage.setItem('selectedExport', payload.filename);
    clearExportParam();
    setToast(`Loaded ${payload.filename}`);
    window.setTimeout(() => setToast(null), 2800);
    await loadByName(payload.filename);
  };

  const holderName   = data?.summary.holder_name;
  const initials     = holderName?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const currentLabel = sections.find((s) => s.id === active)?.label || 'Overview';
  const routeContent = useMemo(() => {
    if (!data) return null;
    return (
      <Suspense fallback={<SkeletonDashboard />}>
        {active === 'overview'  && <Overview data={data} dark={dark} chartMode={chartMode} setChartMode={setChartMode} openAsset={openAsset} navigate={navigate} />}
        {active === 'analytics' && <AnalyticsView data={data} dark={dark} />}
        {active === 'holdings'  && <HoldingsView data={data} openAsset={openAsset} />}
        {active === 'cash'      && <CashView data={data} dark={dark} />}
        {active === 'income'    && <IncomeView data={data} />}
        {active === 'realized'  && <RealizedView data={data} />}
        {active === 'tax'       && <TaxView data={data} exportName={exportName} />}
        {active === 'watchlist' && <WatchlistView exportName={exportName} />}
        {active === 'rebalance' && <RebalanceView data={data} />}
        {active === 'goals'     && <GoalsView data={data} />}
      </Suspense>
    );
  }, [active, chartMode, dark, data, exportName, navigate, openAsset]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-black dark:text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(69,196,176,0.12),transparent_34%),linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:auto,56px_56px,56px_56px]" />

      <main className="min-h-screen min-w-0">
        <header className="sticky top-0 z-30 border-b border-black/10 bg-white/90 backdrop-blur-xl dark:border-[#2b2b2b] dark:bg-[#242424]/95">
          <div className="mx-auto flex h-[68px] max-w-[1580px] items-center gap-6 px-5 lg:px-8">
            <NavLink to={`${sectionPaths.overview}${cleanSearch}`} className="flex shrink-0 items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#45b9a8] text-white shadow-sm">
                <Activity size={20} strokeWidth={2.6} />
              </div>
              <div className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Kapital</div>
            </NavLink>

            <nav className="hidden min-w-0 flex-1 items-center justify-start gap-1 overflow-x-auto xl:flex">
              {sections.map(({ id, label, icon: Icon }) => {
                const selected = active === id;
                return (
                  <NavLink key={id} to={sectionHref(id)} className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${selected ? 'bg-black/5 text-slate-950 dark:bg-white/8 dark:text-white' : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'}`}>
                    <Icon size={17} />{label}
                  </NavLink>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setLiveRefresh((v) => !v)}
                  className={`hidden h-10 items-center gap-2 rounded-md border px-3 text-sm font-black shadow-sm sm:inline-flex ${
                    liveRefresh
                      ? 'border-[#45b9a8]/35 bg-[#45b9a8]/12 text-[#45b9a8]'
                      : 'border-slate-200 bg-white text-slate-500 dark:border-[#3a3a3a] dark:bg-[#303030]'
                  }`}
                  title={liveRefresh ? 'Live refresh enabled' : 'Live refresh paused'}
                >
                  <Wifi size={16} className={loading ? 'animate-pulse' : ''} />
                  {liveRefresh ? 'Live' : 'Paused'}
                </button>
                {exports.length > 1 && (
                  <select value={exportName} onChange={(e) => refresh(e.target.value)} className="hidden h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm md:block dark:border-[#3a3a3a] dark:bg-[#303030] dark:text-slate-100" disabled={loading}>
                    {exports.map((item) => <option key={item}>{item}</option>)}
                  </select>
                )}
                <label className="hidden h-10 cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 lg:inline-flex dark:border-[#3a3a3a] dark:bg-[#303030] dark:text-slate-200 dark:hover:bg-[#383838]">
                  <Upload size={16} /> Import
                  <input type="file" accept=".csv" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0])} />
                </label>
                <button onClick={() => refresh()} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-[#3a3a3a] dark:bg-[#303030] dark:text-slate-200 dark:hover:bg-[#383838]">
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
                <button onClick={() => setDark((v) => !v)} className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-slate-700 shadow-sm hover:bg-slate-50 dark:border-[#3a3a3a] dark:bg-[#303030] dark:text-slate-200 dark:hover:bg-[#383838]">
                  {dark ? <Sun size={16} /> : <Moon size={16} />}
                </button>
                <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 md:flex dark:bg-[#333] dark:text-slate-300">
                  {initials ? <span className="text-xs font-black">{initials}</span> : <User size={18} />}
                </div>
              </div>
            </div>
        </header>

          <div className="mx-auto max-w-[1580px] space-y-6 px-5 py-8 lg:px-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-500 dark:text-slate-500">Net worth / Investments / Trade Republic</div>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">{currentLabel}</h1>
              </div>
              <div className="text-right text-sm text-slate-500">
                Last updated {(lastUpdated || new Date()).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            {error && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-500">{error}</div>}
            {toast && <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-lg">{toast}</div>}
            {data && loading && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400">Refreshing dashboard data...</div>}
            {!data && loading && <SkeletonDashboard />}
            {!loading && !data && !error && <EmptyState />}
            {routeContent}
          </div>
        </main>

      {modal && <AssetModal asset={modal} onClose={closeAsset} />}
    </div>
  );
}
