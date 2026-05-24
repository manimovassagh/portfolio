import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Briefcase, ChevronDown, Globe, LayoutDashboard, LogOut, Menu, Moon, RefreshCw, Sun, Target, Upload, User, Wallet, Wifi, X } from 'lucide-react';
import { NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth0 } from '@auth0/auth0-react';
import { getAuthSession, listExports, loadAsset, loadDashboard, logout, refreshPrices, uploadExport } from './api';
import { useLivePrices } from './lib/useLivePrices';
import { sections } from './lib/sections';
import { AssetModal } from './components/AssetModal';
import { AuthScreen } from './components/AuthScreen';
import { Auth0SessionBridge } from './components/Auth0SessionBridge';
import { SkeletonDashboard, EmptyState } from './components/ui/Skeleton';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import type { AssetDetail, AuthSession, ChartMode, DashboardData, ExportName, Holding, SectionId } from './types';
import { auth0Config, auth0Scopes } from './lib/auth0';

const Overview = lazy(() => import('./components/views/Overview').then((m) => ({ default: m.Overview })));
const AnalyticsView = lazy(() => import('./components/views/Analytics').then((m) => ({ default: m.AnalyticsView })));
const HoldingsView = lazy(() => import('./components/views/Holdings').then((m) => ({ default: m.HoldingsView })));
const CashView = lazy(() => import('./components/views/Cash').then((m) => ({ default: m.CashView })));
const IncomeView = lazy(() => import('./components/views/Income').then((m) => ({ default: m.IncomeView })));
const RealizedView = lazy(() => import('./components/views/Realized').then((m) => ({ default: m.RealizedView })));
const TaxView = lazy(() => import('./components/views/Tax').then((m) => ({ default: m.TaxView })));
const WatchlistView = lazy(() => import('./components/views/Watchlist').then((m) => ({ default: m.WatchlistView })));
const RebalanceView = lazy(() => import('./components/views/Rebalance').then((m) => ({ default: m.RebalanceView })));
const GoalsView   = lazy(() => import('./components/views/Goals').then((m) => ({ default: m.GoalsView })));
const MarketsView = lazy(() => import('./components/views/Markets').then((m) => ({ default: m.MarketsView })));

const NAV_GROUPS: Array<{ label: string; icon: typeof LayoutDashboard; items: SectionId[] }> = [
  { label: 'Overview',  icon: LayoutDashboard, items: ['overview'] },
  { label: 'Markets',   icon: Globe,           items: ['markets'] },
  { label: 'Portfolio', icon: Briefcase,       items: ['holdings', 'analytics', 'rebalance'] },
  { label: 'Finances',  icon: Wallet,          items: ['cash', 'income', 'realized', 'tax'] },
  { label: 'Planning',  icon: Target,          items: ['watchlist', 'goals'] },
];

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
  markets: '/markets',
};

type UploadStage = 'idle' | 'uploading' | 'processing' | 'refreshing';

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

function marketStatus(now: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || '';
  const weekday = value('weekday');
  const minutes = Number(value('hour')) * 60 + Number(value('minute'));
  const tradingDay = !['Sat', 'Sun'].includes(weekday);
  const euOpen = tradingDay && minutes >= 9 * 60 && minutes < 17 * 60 + 30;
  const usOpen = tradingDay && minutes >= 15 * 60 + 30 && minutes < 22 * 60;

  if (euOpen && usOpen) return { label: 'EU + US markets open', open: true };
  if (euOpen) return { label: 'EU market open', open: true };
  if (usOpen) return { label: 'US market open', open: true };
  return { label: 'Markets closed · crypto live', open: false };
}

export default function App() {
  const queryClient                 = useQueryClient();
  const { loginWithRedirect }       = useAuth0();
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
  const [uploadStage, setUploadStage] = useState<UploadStage>('idle');
  const [modal, setModal]           = useState<AssetDetail | null>(null);
  const [chartMode, setChartMode]   = useState<ChartMode>('Value');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [liveRefresh, setLiveRefresh] = useState(true);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [importRequested, setImportRequested] = useState(false);
  const importInputRef               = useRef<HTMLInputElement>(null);
  const visibleSections             = sections;
  const authenticated               = !!authSession?.authenticated;

  const livePrices = useLivePrices(exportName || null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    localStorage.setItem('activeTab', active);
  }, [active]);

  useEffect(() => {
    let mounted = true;
    getAuthSession()
      .then((session) => { if (mounted) setAuthSession(session); })
      .catch(() => {
        if (mounted) setAuthSession({ authenticated: false, required: false, user: null });
      })
      .finally(() => { if (mounted) setAuthLoading(false); });
    return () => { mounted = false; };
  }, []);

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

  const beginAuth0Login = useCallback(async (returnTo: string, pendingImport = false) => {
    if (pendingImport) {
      localStorage.setItem('pendingImport', '1');
    } else {
      localStorage.removeItem('pendingImport');
    }
    await loginWithRedirect({
      authorizationParams: {
        audience: auth0Config.audience,
        scope: auth0Scopes,
        redirect_uri: auth0Config.redirectUri,
      },
      appState: {
        returnTo,
      },
    });
  }, [loginWithRedirect]);

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
    setLoading(true);
    setError(null);
    try {
      await refreshPrices(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Price refresh failed');
    }
    await queryClient.invalidateQueries();
    await loadByName(name);
  }, [clearExportParam, exportName, loadByName, queryClient]);

  useEffect(() => {
    if (!liveRefresh || !exportName) return;
    const id = window.setInterval(() => {
      if (!document.hidden) void loadByName(exportName);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [exportName, liveRefresh, loadByName]);

  useEffect(() => {
    let mounted = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    listExports()
      .then((items) => {
        if (!mounted) return;
        setExports(items);
        if (authSession?.authenticated && items.length === 0) {
          setExportName('');
          setData(null);
          setError(null);
          setLoading(false);
          return;
        }
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
  }, [authSession?.authenticated, clearExportParam, exportParam, loadByName]);

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    setUploadStage('uploading');
    setLoading(true);
    setError(null);
    try {
      const payload = await uploadExport(file);
      setUploadStage('processing');
      setExports(payload.exports);
      setExportName(payload.filename);
      localStorage.setItem('selectedExport', payload.filename);
      clearExportParam();
      setToast(`Loaded ${payload.filename}`);
      window.setTimeout(() => setToast(null), 2800);
      setUploadStage('refreshing');
      await loadByName(payload.filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
      setUploadStage('idle');
    }
  };

  const handleLogout = async () => {
    await logout().catch(() => {});
    if (authSession?.user?.provider === 'auth0' && auth0Config.enabled) {
      const returnTo = encodeURIComponent(window.location.origin);
      const logoutUrl = `https://${auth0Config.domain}/v2/logout?client_id=${encodeURIComponent(auth0Config.clientId)}&returnTo=${returnTo}`;
      window.location.assign(logoutUrl);
      return;
    }
    setAuthSession({ authenticated: false, required: false, user: null });
    setData(null);
    setExports([]);
    setExportName('');
    setLoading(true);
  };

  const acceptAuthSession = useCallback((session: AuthSession) => {
    setAuthSession(session);
    if (session.authenticated) {
      setAuthPromptOpen(false);
      setError(null);
      const pendingImport = localStorage.getItem('pendingImport') === '1';
      if (pendingImport) {
        localStorage.removeItem('pendingImport');
        window.setTimeout(() => importInputRef.current?.click(), 0);
        setImportRequested(false);
      } else if (importRequested) {
        setImportRequested(false);
        window.setTimeout(() => importInputRef.current?.click(), 0);
      }
    }
  }, [importRequested]);

  const openImport = useCallback(() => {
    if (!authenticated) {
      if (auth0Config.enabled) {
        setImportRequested(true);
        void beginAuth0Login(`${window.location.pathname}${window.location.search}`, true);
        return;
      }
      setImportRequested(true);
      setAuthPromptOpen(true);
      return;
    }
    importInputRef.current?.click();
  }, [authenticated, beginAuth0Login]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const dropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openDrop  = (label: string) => { if (dropTimerRef.current) clearTimeout(dropTimerRef.current); setOpenGroup(label); };
  const closeDrop = () => { dropTimerRef.current = setTimeout(() => setOpenGroup(null), 120); };
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileMenuOpen]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMobileMenuOpen(false); }, [active]);

  const holderName   = data?.summary.holder_name;
  const accountName  = authSession?.user?.name || holderName;
  const initials     = accountName?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const currentLabel = sections.find((s) => s.id === active)?.label || 'Overview';
  const market = marketStatus(lastUpdated || new Date());
  const routeContent = useMemo(() => {
    if (!data) return null;
    return (
      <ErrorBoundary>
        <Suspense fallback={<SkeletonDashboard />}>
          {active === 'overview'  && <Overview data={data} dark={dark} chartMode={chartMode} setChartMode={setChartMode} openAsset={openAsset} navigate={navigate} />}
          {active === 'analytics' && <AnalyticsView data={data} dark={dark} />}
          {active === 'holdings'  && <HoldingsView data={data} openAsset={openAsset} livePrices={livePrices} />}
          {active === 'cash'      && <CashView data={data} dark={dark} />}
          {active === 'income'    && <IncomeView data={data} />}
          {active === 'realized'  && <RealizedView data={data} />}
          {active === 'tax'       && <TaxView data={data} exportName={exportName} />}
          {active === 'watchlist' && (
            authenticated
              ? <WatchlistView exportName={exportName} />
              : <AuthScreen embedded auth0Enabled={auth0Config.enabled} accountHolderName={holderName} onAuthenticated={acceptAuthSession} />
          )}
          {active === 'rebalance' && <RebalanceView data={data} />}
          {active === 'goals'     && <GoalsView data={data} />}
          {active === 'markets'   && <MarketsView />}
        </Suspense>
      </ErrorBoundary>
    );
  }, [acceptAuthSession, active, authenticated, chartMode, dark, data, exportName, holderName, livePrices, navigate, openAsset]);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-black dark:text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(69,196,176,0.12),transparent_34%),linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:auto,56px_56px,56px_56px]" />

      {auth0Config.enabled && (
        <Auth0SessionBridge currentSession={authSession} onAuthenticated={acceptAuthSession} />
      )}

      <main className="min-h-screen min-w-0">
        <header className="sticky top-0 z-30 border-b border-black/10 bg-white/90 backdrop-blur-xl dark:border-[#2b2b2b] dark:bg-[#242424]/95">
          <div className="mx-auto flex h-[68px] max-w-[1580px] items-center gap-6 px-5 lg:px-8">
            <NavLink to={`${sectionPaths.overview}${cleanSearch}`} className="flex shrink-0 items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#45b9a8] text-white shadow-sm">
                <Activity size={20} strokeWidth={2.6} />
              </div>
              <div className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Kapital</div>
            </NavLink>

            <nav className="hidden min-w-0 flex-1 items-center justify-start gap-0.5 xl:flex">
              {NAV_GROUPS.map((group) => {
                const isGroupActive = group.items.includes(active);
                const GroupIcon = group.icon;
                const items = group.items;
                const baseBtn = `inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-semibold transition`;
                const activeClass = `${baseBtn} bg-black/5 text-slate-950 dark:bg-white/8 dark:text-white`;
                const inactiveClass = `${baseBtn} text-slate-500 hover:bg-black/5 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/8 dark:hover:text-white`;

                if (items.length === 0) {
                  return null;
                }

                if (items.length === 1) {
                  return (
                    <NavLink key={group.label} to={sectionHref(items[0])} className={isGroupActive ? activeClass : inactiveClass}>
                      <GroupIcon size={16} />{group.label}
                    </NavLink>
                  );
                }

                return (
                  <div
                    key={group.label}
                    className="relative"
                    onMouseEnter={() => openDrop(group.label)}
                    onMouseLeave={closeDrop}
                    onFocus={() => openDrop(group.label)}
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) setOpenGroup(null);
                    }}
                  >
                    <button
                      className={isGroupActive ? activeClass : inactiveClass}
                      aria-haspopup="menu"
                      aria-expanded={openGroup === group.label}
                      onClick={() => setOpenGroup((current) => current === group.label ? null : group.label)}
                    >
                      <GroupIcon size={16} />{group.label}<ChevronDown size={12} className="opacity-50" />
                    </button>
                    {openGroup === group.label && (
                      <div className="absolute left-0 top-full z-50 w-48 pt-1.5">
                      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-[#1e1e1e]" role="menu">
                        {items.map((sectionId) => {
                          const sec = sections.find((s) => s.id === sectionId)!;
                          const SecIcon = sec.icon;
                          return (
                            <NavLink
                              key={sectionId}
                              to={sectionHref(sectionId)}
                              onClick={() => setOpenGroup(null)}
                              role="menuitem"
                              className={`flex items-center gap-3 px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-50 dark:hover:bg-slate-800 ${active === sectionId ? 'text-[#45b9a8]' : 'text-slate-700 dark:text-slate-300'}`}
                            >
                              <SecIcon size={16} />{sec.label}
                            </NavLink>
                          );
                        })}
                      </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-2">
                <button
                  className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-slate-700 shadow-sm hover:bg-slate-50 xl:hidden dark:border-[#3a3a3a] dark:bg-[#303030] dark:text-slate-200 dark:hover:bg-[#383838]"
                  onClick={() => setMobileMenuOpen((v) => !v)}
                  aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                  aria-expanded={mobileMenuOpen}
                  aria-controls="mobile-nav"
                >
                  {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
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
                  <select
                    id="export-picker"
                    name="export"
                    aria-label="Selected export"
                    value={exportName}
                    onChange={(e) => refresh(e.target.value)}
                    className="hidden h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm md:block dark:border-[#3a3a3a] dark:bg-[#303030] dark:text-slate-100"
                    disabled={loading}
                  >
                    <option value="all">All (merged)</option>
                    {exports.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                )}
                <button
                  onClick={openImport}
                  className="hidden h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 lg:inline-flex dark:border-[#3a3a3a] dark:bg-[#303030] dark:text-slate-200 dark:hover:bg-[#383838]"
                  title={authenticated ? 'Import CSV' : 'Sign in to import CSV'}
                >
                  <Upload size={16} /> Import
                </button>
                <button onClick={() => refresh()} className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-[#3a3a3a] dark:bg-[#303030] dark:text-slate-200 dark:hover:bg-[#383838]">
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> <span className="hidden sm:inline">Refresh</span>
                </button>
                <button
                  onClick={() => setDark((v) => !v)}
                  className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-slate-700 shadow-sm hover:bg-slate-50 dark:border-[#3a3a3a] dark:bg-[#303030] dark:text-slate-200 dark:hover:bg-[#383838]"
                  aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
                  title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
                >
                  {dark ? <Sun size={16} /> : <Moon size={16} />}
                </button>
                {authLoading ? (
                  <div className="hidden h-10 w-24 animate-pulse rounded-md bg-slate-200 md:block dark:bg-[#333]" />
                ) : authenticated ? (
                  <div className="hidden items-center gap-2 md:flex">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-[#333] dark:text-slate-300" title={accountName || 'Account'}>
                      {initials ? <span className="text-xs font-black">{initials}</span> : <User size={18} />}
                    </div>
                    <button
                      onClick={handleLogout}
                      className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-slate-700 shadow-sm hover:bg-slate-50 dark:border-[#3a3a3a] dark:bg-[#303030] dark:text-slate-200 dark:hover:bg-[#383838]"
                      aria-label="Sign out"
                      title="Sign out"
                    >
                      <LogOut size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (auth0Config.enabled) {
                        void beginAuth0Login(`${window.location.pathname}${window.location.search}`);
                        return;
                      }
                      setAuthPromptOpen(true);
                    }}
                    className="hidden h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50 md:inline-flex dark:border-[#3a3a3a] dark:bg-[#303030] dark:text-slate-200 dark:hover:bg-[#383838]"
                  >
                    <User size={16} /> Sign in
                  </button>
                )}
              </div>
            </div>
        </header>

        {mobileMenuOpen && (
          <>
            <div className="fixed inset-0 top-[68px] z-40 bg-black/40 backdrop-blur-sm xl:hidden" onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />
            <div id="mobile-nav" ref={mobileMenuRef} className="fixed inset-x-0 top-[68px] z-50 border-b border-black/10 bg-white/98 backdrop-blur-xl xl:hidden dark:border-[#2b2b2b] dark:bg-[#242424]/99">
              <nav className="mx-auto flex max-w-[1580px] flex-col gap-1 px-5 py-3 lg:px-8" aria-label="Mobile navigation">
                {visibleSections.map(({ id, label, icon: Icon }) => (
                  <NavLink
                    key={id}
                    to={sectionHref(id)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition ${active === id ? 'bg-black/5 text-slate-950 dark:bg-white/8 dark:text-white' : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'}`}
                  >
                    <Icon size={17} />{label}
                  </NavLink>
                ))}
                <div className="mt-1 border-t border-black/10 pt-2 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => { setMobileMenuOpen(false); openImport(); }}
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                    title={authenticated ? 'Import CSV' : 'Sign in to import CSV'}
                  >
                    <Upload size={17} /> Import CSV
                  </button>
                </div>
              </nav>
            </div>
          </>
        )}

          <input
            ref={importInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.currentTarget.value = '';
              void handleUpload(file);
            }}
          />

          <div className="mx-auto max-w-[1580px] space-y-6 px-5 py-8 lg:px-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-500 dark:text-slate-500">Net worth / Investments / Trade Republic</div>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">{currentLabel}</h1>
              </div>
              <div className="flex flex-col items-end gap-2 text-right text-sm text-slate-500">
                <span className={`rounded-md border px-2.5 py-1 text-xs font-black uppercase tracking-wide ${
                  market.open
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'border-slate-300 bg-white text-slate-500 dark:border-[#3a3a3a] dark:bg-[#303030] dark:text-slate-300'
                }`}>
                  {market.label}
                </span>
                <span>Last updated {(lastUpdated || new Date()).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-500">
                <span className="flex-1">{error}</span>
                <button
                  onClick={() => setError(null)}
                  className="shrink-0 rounded p-0.5 hover:bg-rose-500/10"
                  aria-label="Dismiss error"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {toast && <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-lg">{toast}</div>}
            {uploadStage !== 'idle' && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1f1f1f] p-6 text-slate-100 shadow-2xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#45b9a8]/15 text-[#74d6c8]">
                      <RefreshCw size={22} className="animate-spin" />
                    </div>
                    <div>
                      <div className="text-lg font-black">Importing CSV</div>
                      <div className="text-sm text-slate-400">We are processing the file and rebuilding your dashboard.</div>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {[
                      { key: 'uploading', label: 'Uploading file', help: 'Sending the CSV to the server.' },
                      { key: 'processing', label: 'Parsing transactions', help: 'Rebuilding holdings, cash, and performance data.' },
                      { key: 'refreshing', label: 'Refreshing dashboard', help: 'Loading the updated dashboard.' },
                    ].map((step, index, steps) => {
                      const currentIndex = steps.findIndex((item) => item.key === uploadStage);
                      const stepIndex = index;
                      const activeStep = uploadStage === step.key;
                      const complete = currentIndex > stepIndex;
                      return (
                        <div key={step.key} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${
                            complete
                              ? 'bg-emerald-500 text-white'
                              : activeStep
                                ? 'bg-[#45b9a8] text-black'
                                : 'bg-white/10 text-slate-500'
                          }`}>
                            {complete ? '✓' : activeStep ? '•' : stepIndex + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className={`text-sm font-bold ${activeStep ? 'text-white' : 'text-slate-300'}`}>{step.label}</div>
                            <div className="text-xs text-slate-500">{step.help}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            {data && loading && <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400">Refreshing dashboard data...</div>}
            {!data && loading && <SkeletonDashboard />}
            {!loading && !data && !error && <EmptyState />}
            {routeContent}
          </div>
        </main>

      {modal && <AssetModal asset={modal} onClose={closeAsset} />}
      {authPromptOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-5 backdrop-blur-sm"
          onMouseDown={() => {
            setAuthPromptOpen(false);
            setImportRequested(false);
          }}
        >
          <div onMouseDown={(event) => event.stopPropagation()}>
            <AuthScreen embedded auth0Enabled={auth0Config.enabled} accountHolderName={holderName} onAuthenticated={acceptAuthSession} />
          </div>
        </div>
      )}
    </div>
  );
}
