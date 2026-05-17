import { useCallback, useEffect, useState } from 'react';
import { Activity, Moon, RefreshCw, Sun, Upload } from 'lucide-react';
import { listExports, loadAsset, loadDashboard, uploadExport } from './api';
import { sections } from './lib/sections';
import { AssetModal } from './components/AssetModal';
import { SkeletonDashboard, EmptyState } from './components/ui/Skeleton';
import { Overview }       from './components/views/Overview';
import { AnalyticsView }  from './components/views/Analytics';
import { HoldingsView }   from './components/views/Holdings';
import { CashView }       from './components/views/Cash';
import { IncomeView }     from './components/views/Income';
import { RealizedView }   from './components/views/Realized';
import { TaxView }        from './components/views/Tax';
import { WatchlistView }  from './components/views/Watchlist';
import { RebalanceView }  from './components/views/Rebalance';
import { GoalsView }      from './components/views/Goals';
import type { AssetDetail, ChartMode, DashboardData, ExportName, Holding, SectionId } from './types';

function usePersistedSection() {
  const [active, setActive] = useState<SectionId>(() => (localStorage.getItem('activeTab') as SectionId) || 'overview');
  const navigate = useCallback((id: SectionId) => {
    localStorage.setItem('activeTab', id);
    setActive(id);
  }, []);
  return [active, navigate] as const;
}

export default function App() {
  const [dark, setDark]             = useState(() => localStorage.getItem('theme') !== 'light');
  const [active, navigate]          = usePersistedSection();
  const [exports, setExports]       = useState<ExportName[]>([]);
  const [exportName, setExportName] = useState<ExportName>('');
  const [data, setData]             = useState<DashboardData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [toast, setToast]           = useState<string | null>(null);
  const [modal, setModal]           = useState<AssetDetail | null>(null);
  const [chartMode, setChartMode]   = useState<ChartMode>('Value');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  const loadByName = useCallback(async (name: string) => {
    if (!name) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await loadDashboard(name);
      setData(payload);
      setExports(payload.exports);
      setExportName(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dashboard load failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async (name = exportName) => { await loadByName(name); }, [exportName, loadByName]);

  useEffect(() => {
    let mounted = true;
    listExports()
      .then((items) => {
        if (!mounted) return;
        setExports(items);
        const first = items[0] || '';
        setExportName(first);
        if (first) loadByName(first); else setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not list exports');
        setLoading(false);
      });
    return () => { mounted = false; };
  }, [loadByName]);

  const openAsset = async (holding: Holding) => {
    if (!exportName) return;
    setModal(await loadAsset(holding.isin, exportName));
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    const payload = await uploadExport(file);
    setExports(payload.exports);
    setExportName(payload.filename);
    setToast(`Loaded ${payload.filename}`);
    window.setTimeout(() => setToast(null), 2800);
    await refresh(payload.filename);
  };

  const holderName   = data?.summary.holder_name;
  const initials     = holderName?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const currentLabel = sections.find((s) => s.id === active)?.label || 'Overview';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.10),transparent_35%),radial-gradient(ellipse_at_top_right,rgba(14,165,233,0.10),transparent_40%)]" />

      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-slate-950 text-slate-300 lg:flex lg:flex-col dark:border-slate-800">
          <div className="border-b border-white/10 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm">
                <Activity size={20} strokeWidth={2.4} />
              </div>
              <div>
                <div className="text-sm font-bold text-white">Kapital</div>
                <div className="text-xs text-slate-400">Portfolio analytics</div>
              </div>
            </div>
            {holderName && (
              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/15 text-xs font-bold text-emerald-300">{initials}</div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{holderName}</div>
                  <div className="text-xs text-slate-500">Demo account</div>
                </div>
              </div>
            )}
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {sections.map(({ id, label, icon: Icon }) => {
              const selected = active === id;
              return (
                <button key={id} onClick={() => navigate(id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${selected ? 'bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-500/15' : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'}`}>
                  <Icon size={17} />{label}
                </button>
              );
            })}
          </nav>
          <div className="border-t border-white/10 p-3">
            <button onClick={() => setDark((v) => !v)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-500 hover:bg-white/5 hover:text-slate-200">
              {dark ? <Sun size={17} /> : <Moon size={17} />}
              {dark ? 'Light mode' : 'Dark mode'}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-4 px-5 py-4 lg:px-8">
              <div>
                <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">{currentLabel}</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Last updated {new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {exports.length > 1 && (
                  <select value={exportName} onChange={(e) => refresh(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                    {exports.map((item) => <option key={item}>{item}</option>)}
                  </select>
                )}
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                  <Upload size={16} /> Import
                  <input type="file" accept=".csv" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0])} />
                </label>
                <button onClick={() => refresh()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
                <button onClick={() => setDark((v) => !v)} className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                  {dark ? <Sun size={16} /> : <Moon size={16} />}
                </button>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1480px] space-y-6 px-5 py-6 lg:px-8">
            {error && <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-500">{error}</div>}
            {toast && <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-lg">{toast}</div>}
            {!data && loading && <SkeletonDashboard />}
            {!loading && !data && !error && <EmptyState />}
            {data && (
              <>
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
              </>
            )}
          </div>
        </main>
      </div>

      {modal && <AssetModal asset={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
