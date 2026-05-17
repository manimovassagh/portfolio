import { useCallback, useEffect, useMemo, useState, type HTMLAttributes, type ReactNode } from 'react';
import Chart from 'react-apexcharts';
import {
  Activity,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  BarChart2,
  Briefcase,
  CheckCircle2,
  Coins,
  LayoutDashboard,
  Moon,
  PiggyBank,
  Receipt,
  RefreshCw,
  Sun,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { listExports, loadAsset, loadDashboard, uploadExport } from './api';
import type { ApexOptions } from 'apexcharts';
import type { AssetDetail, ChartMode, DashboardData, Holding, SectionId } from './types';

const sections: Array<{ id: SectionId; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  { id: 'holdings', label: 'Holdings', icon: Briefcase },
  { id: 'cash', label: 'Cash flow', icon: ArrowLeftRight },
  { id: 'income', label: 'Income', icon: Wallet },
  { id: 'realized', label: 'Realized P&L', icon: CheckCircle2 },
  { id: 'tax', label: 'Tax', icon: Receipt },
];

const euro = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const euroCompact = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

function fmtEUR(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Math.abs(value) >= 10_000 ? euroCompact.format(value) : euro.format(value);
}

function signedEUR(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${value >= 0 ? '+' : ''}${fmtEUR(value)}`;
}

function pct(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

function chartTheme(dark: boolean): ApexOptions {
  return {
    chart: {
      background: 'transparent',
      foreColor: dark ? '#cbd5e1' : '#475569',
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      toolbar: { show: false },
      animations: { speed: 350 },
    },
    grid: { borderColor: dark ? '#1e293b' : '#e2e8f0', strokeDashArray: 3 },
    tooltip: { theme: dark ? 'dark' : 'light' },
    xaxis: {
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { fontSize: '12px', colors: dark ? '#94a3b8' : '#64748b' } },
    },
    yaxis: {
      labels: { style: { fontSize: '12px', colors: dark ? '#94a3b8' : '#64748b' } },
    },
  };
}

function usePersistedSection() {
  const [active, setActive] = useState<SectionId>(() => (localStorage.getItem('activeTab') as SectionId) || 'overview');
  const navigate = useCallback((id: SectionId) => {
    localStorage.setItem('activeTab', id);
    setActive(id);
  }, []);
  return [active, navigate] as const;
}

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') !== 'light');
  const [active, navigate] = usePersistedSection();
  const [exports, setExports] = useState<string[]>([]);
  const [exportName, setExportName] = useState<string>('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [modal, setModal] = useState<AssetDetail | null>(null);
  const [chartMode, setChartMode] = useState<ChartMode>('Value');

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

  const refresh = useCallback(async (name = exportName) => {
    await loadByName(name);
  }, [exportName, loadByName]);

  useEffect(() => {
    let mounted = true;
    listExports()
      .then((items) => {
        if (!mounted) return;
        setExports(items);
        const first = items[0] || '';
        setExportName(first);
        if (first) loadByName(first);
        else setLoading(false);
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

  const holderName = data?.summary.holder_name;
  const initials = holderName?.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const currentLabel = sections.find((item) => item.id === active)?.label || 'Overview';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.10),transparent_35%),radial-gradient(ellipse_at_top_right,rgba(14,165,233,0.10),transparent_40%)]" />
      <div className="flex min-h-screen">
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
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/15 text-xs font-bold text-emerald-300">
                  {initials}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{holderName}</div>
                  <div className="text-xs text-slate-500">Demo account</div>
                </div>
              </div>
            )}
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {sections.map((item) => {
              const Icon = item.icon;
              const selected = active === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                    selected ? 'bg-emerald-500/12 text-emerald-300 ring-1 ring-emerald-500/15' : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  <Icon size={17} />
                  {item.label}
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

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-slate-200 bg-white backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-4 px-5 py-4 lg:px-8">
              <div>
                <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">{currentLabel}</h1>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Last updated {new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <div className="flex items-center gap-2">
                {exports.length > 1 && (
                  <select value={exportName} onChange={(event) => refresh(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                    {exports.map((item) => <option key={item}>{item}</option>)}
                  </select>
                )}
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                  <Upload size={16} />
                  Import
                  <input type="file" accept=".csv" className="hidden" onChange={(event) => handleUpload(event.target.files?.[0])} />
                </label>
                <button onClick={() => refresh()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  Refresh
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
                {active === 'overview' && <Overview data={data} dark={dark} chartMode={chartMode} setChartMode={setChartMode} openAsset={openAsset} />}
                {active === 'analytics' && <AnalyticsView data={data} dark={dark} />}
                {active === 'holdings' && <HoldingsView data={data} openAsset={openAsset} />}
                {active === 'cash' && <CashView data={data} dark={dark} />}
                {active === 'income' && <IncomeView data={data} />}
                {active === 'realized' && <RealizedView data={data} />}
                {active === 'tax' && <TaxView data={data} />}
              </>
            )}
          </div>
        </main>
      </div>
      {modal && <AssetModal asset={modal} onClose={() => setModal(null)} />}
    </div>
  );
}

function Card({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return <div {...props} className={`rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>{children}</div>;
}

function MetricCard({ label, value, detail, tone = 'neutral', icon: Icon }: { label: string; value: string; detail: string; tone?: 'neutral' | 'gain' | 'loss' | 'warn'; icon: typeof Wallet }) {
  const color = tone === 'gain' ? 'text-emerald-500' : tone === 'loss' ? 'text-rose-500' : tone === 'warn' ? 'text-amber-500' : 'text-slate-950 dark:text-white';
  const border = tone === 'gain' ? 'border-l-emerald-500' : tone === 'loss' ? 'border-l-rose-500' : tone === 'warn' ? 'border-l-amber-500' : 'border-l-slate-300 dark:border-l-slate-700';
  return (
    <Card className={`min-h-[124px] border-l-4 ${border} p-5`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</div>
        <Icon size={18} className="text-slate-400" />
      </div>
      <div className={`num mt-4 text-2xl font-black tracking-normal ${color}`}>{value}</div>
      <div className="mt-3 text-sm font-semibold text-slate-500">{detail}</div>
    </Card>
  );
}

function Overview({ data, dark, chartMode, setChartMode, openAsset }: { data: DashboardData; dark: boolean; chartMode: ChartMode; setChartMode: (mode: ChartMode) => void; openAsset: (holding: Holding) => void }) {
  const s = data.summary;
  const returns = useMemo(() => rollingReturns(data.perf.twr), [data.perf.twr]);
  const movers = useMemo(() => [...data.holdings].filter((h) => h.unrealized_pnl !== null).sort((a, b) => Math.abs(b.unrealized_pnl || 0) - Math.abs(a.unrealized_pnl || 0)).slice(0, 6), [data.holdings]);

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="md:col-span-2">
          <MetricCard label="Portfolio value" value={fmtEUR(s.portfolio_value)} detail={`${signedEUR(s.portfolio_value - s.net_deposits)} vs deposits · since ${s.first_trade_date ?? '—'}`} tone={s.portfolio_value >= s.net_deposits ? 'gain' : 'loss'} icon={Wallet} />
        </div>
        <MetricCard label="Unrealized P&L" value={signedEUR(s.unrealized_pnl)} detail={pct(s.unrealized_pct)} tone={s.unrealized_pnl >= 0 ? 'gain' : 'loss'} icon={ArrowUpRight} />
        <MetricCard label="Realized P&L" value={signedEUR(s.realized_pnl)} detail={`${s.n_realized} closed trades`} tone={s.realized_pnl >= 0 ? 'gain' : 'loss'} icon={CheckCircle2} />
        <MetricCard label="XIRR annualized" value={s.xirr === null ? '—' : pct(s.xirr * 100)} detail="Money-weighted return" tone={(s.xirr || 0) >= 0 ? 'gain' : 'loss'} icon={Activity} />
        <MetricCard label="Net deposits" value={fmtEUR(s.net_deposits)} detail={`${s.n_holdings} open positions`} icon={PiggyBank} />
        <MetricCard label="Total income" value={fmtEUR(s.dividends + s.interest + s.stockperks)} detail={`Dividends · interest · perks`} tone="gain" icon={Banknote} />
        <MetricCard label="Fees & tax" value={fmtEUR(-(s.fees + s.tax))} detail={`${fmtEUR(s.fees)} fees · ${fmtEUR(s.tax)} tax`} tone="loss" icon={Receipt} />
      </div>

      <div className="grid gap-3 sm:grid-cols-5 xl:grid-cols-7">
        {returns.map((item) => (
          <Card key={item.label} className="border-l-4 border-l-slate-300 p-4 dark:border-l-slate-700">
            <div className="flex items-center justify-between">
              <div className="num text-base font-black tracking-normal text-slate-700 dark:text-slate-200">{item.label}</div>
              {(item.pct ?? 0) >= 0 ? <ArrowUpRight size={16} className="text-emerald-500" /> : <ArrowDownRight size={16} className="text-rose-500" />}
            </div>
            <div className={`num mt-4 text-xl font-black tracking-normal ${(item.pct ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{item.pct === null ? '—' : pct(item.pct)}</div>
          </Card>
        ))}
        {data.perf.best_worst.best[0] && (
          <Card className="border-l-4 border-l-emerald-500 p-4">
            <div className="flex items-center justify-between">
              <div className="num text-base font-black tracking-normal text-slate-700 dark:text-slate-200">Best day</div>
              <ArrowUpRight size={16} className="text-emerald-500" />
            </div>
            <div className="num mt-4 text-xl font-black tracking-normal text-emerald-500">{signedEUR(data.perf.best_worst.best[0].pnl)}</div>
            <div className="mt-1 text-xs text-slate-500">{data.perf.best_worst.best[0].date}</div>
          </Card>
        )}
        {data.perf.best_worst.worst[0] && (
          <Card className="border-l-4 border-l-rose-500 p-4">
            <div className="flex items-center justify-between">
              <div className="num text-base font-black tracking-normal text-slate-700 dark:text-slate-200">Worst day</div>
              <ArrowDownRight size={16} className="text-rose-500" />
            </div>
            <div className="num mt-4 text-xl font-black tracking-normal text-rose-500">{signedEUR(data.perf.best_worst.worst[0].pnl)}</div>
            <div className="mt-1 text-xs text-slate-500">{data.perf.best_worst.worst[0].date}</div>
          </Card>
        )}
      </div>

      <AllocationTreemap data={data} dark={dark} openAsset={openAsset} />

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <PanelTitle title="Portfolio performance" subtitle="Portfolio value, deposits, and benchmark" />
          <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(['Value', 'TWR', 'Drawdown'] as ChartMode[]).map((mode) => (
              <button key={mode} onClick={() => setChartMode(mode)} className={`rounded-md px-3 py-1.5 text-sm font-bold ${chartMode === mode ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-white' : 'text-slate-500'}`}>{mode}</button>
            ))}
          </div>
          <HeroChart data={data} dark={dark} mode={chartMode} />
        </Card>
        <Card className="p-5">
          <PanelTitle title="Movers" subtitle="Largest unrealized P&L" />
          <div className="mt-2 space-y-2">
            {movers.map((item) => (
              <button key={item.isin} onClick={() => openAsset(item)} className="flex w-full items-center justify-between gap-3 rounded-lg p-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold">{item.name}</div>
                  <div className="num text-xs text-slate-500">{item.isin}</div>
                </div>
                <div className="text-right">
                  <div className={`num text-sm font-black ${(item.unrealized_pnl || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{signedEUR(item.unrealized_pnl)}</div>
                  <div className="num text-xs text-slate-500">{pct(item.unrealized_pct)}</div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

function tileColor(pct: number) {
  if (pct >= 5)  return '#059669';
  if (pct >= 0)  return '#10b981';
  if (pct >= -5) return '#fb7185';
  return '#e11d48';
}

function AllocationTreemap({ data, dark, openAsset, compact = false }: { data: DashboardData; dark: boolean; openAsset: (h: Holding) => void; compact?: boolean }) {
  const t = chartTheme(dark);
  const holdings = data.holdings.filter((h) => h.market_value !== null && h.market_value > 0);
  if (!holdings.length) return null;

  const series = [{
    data: holdings.map((h) => ({
      x: h.name,
      y: h.market_value,
      fillColor: tileColor(h.unrealized_pct ?? 0),
    })),
  }];

  const options: ApexOptions = {
    ...t,
    chart: {
      ...t.chart,
      type: 'treemap',
      events: {
        dataPointSelection: (_e: unknown, _ctx: unknown, cfg: { dataPointIndex: number }) => {
          const h = holdings[cfg.dataPointIndex];
          if (h) openAsset(h);
        },
      },
    },
    plotOptions: { treemap: { distributed: true, enableShades: false } },
    dataLabels: {
      enabled: true,
      style: { fontSize: '13px', fontWeight: '800', fontFamily: 'Inter, ui-sans-serif, sans-serif', colors: ['#fff'] },
      formatter: (text: string, op: { value: number }) => [text, fmtEUR(op.value)] as unknown as string,
      offsetY: -4,
    },
    tooltip: {
      ...t.tooltip,
      custom: ({ seriesIndex, dataPointIndex, w }: { seriesIndex: number; dataPointIndex: number; w: { config: { series: Array<{ data: Array<{ x: string }> }> } } }) => {
        const d = w.config.series[seriesIndex]?.data[dataPointIndex];
        const h = holdings.find((x) => x.name === d?.x);
        if (!h) return '';
        const color = tileColor(h.unrealized_pct ?? 0);
        return `<div style="padding:10px 14px;font-size:12px;font-family:Inter,sans-serif">
          <div style="font-weight:800;margin-bottom:6px">${h.name}</div>
          <div>Market value: <b>${fmtEUR(h.market_value)}</b></div>
          <div>Weight: <b>${h.weight.toFixed(1)}%</b></div>
          <div>P&amp;L: <b style="color:${color}">${signedEUR(h.unrealized_pnl)} (${pct(h.unrealized_pct)})</b></div>
        </div>`;
      },
    },
    legend: { show: false },
  };

  return (
    <Card className="p-5">
      <PanelTitle title="Allocation" subtitle="Position size by market value · color = P&L" />
      <Chart type="treemap" height={compact ? 220 : 320} series={series} options={options} />
    </Card>
  );
}

function AnalyticsView({ data, dark }: { data: DashboardData; dark: boolean }) {
  const t = chartTheme(dark);
  const sectors = data.analytics.sectors.filter((item) => item.value > 0);
  const years = Object.keys(data.analytics.monthly).sort();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Sharpe ratio" value={data.analytics.sharpe?.toFixed(2) || '—'} detail="Risk-adjusted return" tone={(data.analytics.sharpe || 0) >= 1 ? 'gain' : 'warn'} icon={Activity} />
        <MetricCard label="Volatility" value={data.analytics.volatility ? pct(data.analytics.volatility * 100, 1) : '—'} detail="Annualized std deviation" icon={BarChart2} />
        <MetricCard label="Max DD duration" value={`${data.analytics.max_dd_days || 0} days`} detail="Longest underwater streak" tone="loss" icon={ArrowDownRight} />
        <MetricCard label="Total return" value={pct(data.summary.total_return * 100)} detail="Since first deposit" tone={data.summary.total_return >= 0 ? 'gain' : 'loss'} icon={ArrowUpRight} />
      </div>

      <Card className="p-5">
        <PanelTitle title="Monthly returns" subtitle="Month-over-month TWR change" />
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[780px]">
            <Chart type="heatmap" height={Math.max(150, years.length * 70)} series={years.map((year) => ({ name: year, data: months.map((m) => ({ x: m, y: data.analytics.monthly[year]?.[m] ?? null })) }))} options={{
              ...t,
              dataLabels: { enabled: true, formatter: (v) => (v === null ? '' : pct(Number(v), 1)), style: { fontSize: '12px', fontWeight: 800, colors: ['#fff'] } },
              plotOptions: { heatmap: { radius: 6, enableShades: false, colorScale: { ranges: [
                { from: -100, to: -5, color: '#be123c' },
                { from: -5, to: -0.1, color: '#e11d48' },
                { from: -0.1, to: 0.1, color: '#334155' },
                { from: 0.1, to: 5, color: '#059669' },
                { from: 5, to: 100, color: '#047857' },
              ] } } },
              legend: { show: false },
            }} />
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <PanelTitle title="Annual P&L" subtitle="Year-over-year gain or loss" />
          <Chart type="bar" height={300} series={[{ name: 'P&L', data: data.analytics.annual.map((a) => ({ x: String(a.year), y: a.pnl, fillColor: a.pnl >= 0 ? '#10b981' : '#f43f5e' })) }]} options={{ ...t, plotOptions: { bar: { borderRadius: 7, columnWidth: '54%', distributed: true } }, yaxis: { labels: { formatter: (v) => fmtEUR(v) } }, dataLabels: { enabled: true, formatter: (_v, ctx) => pct(data.analytics.annual[ctx.dataPointIndex]?.pct, 1), style: { fontSize: '12px', fontWeight: 800 } }, legend: { show: false } }} />
        </Card>
        <Card className="p-5">
          <PanelTitle title="Allocation by asset class" subtitle="Diversification breakdown" />
          <Chart type="donut" height={300} series={sectors.map((s) => s.value)} options={{
            ...t,
            labels: sectors.map((s) => s.label),
            colors: ['#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#06b6d4'],
            plotOptions: { pie: { donut: { size: '68%', labels: { show: true, total: { show: true, label: 'Total', formatter: () => fmtEUR(sectors.reduce((a, b) => a + b.value, 0)) } } } } },
            dataLabels: { enabled: true, formatter: (v) => `${Number(v).toFixed(1)}%`, style: { fontSize: '12px', fontWeight: 800 } },
            legend: { position: 'bottom', labels: { colors: dark ? '#cbd5e1' : '#475569' } },
            tooltip: { y: { formatter: (v) => fmtEUR(v) } },
          }} />
        </Card>
      </div>

      <Card className="p-5">
        <PanelTitle title="Unrealized P&L over time" subtitle="Market value minus cumulative cost" />
        <Chart type="area" height={300} series={[{ name: 'Unrealized P&L', data: data.analytics.pnl_series.map((p) => ({ x: p.date, y: p.pnl })) }]} options={{ ...t, colors: ['#10b981'], stroke: { curve: 'smooth', width: 2 }, fill: { type: 'gradient', gradient: { opacityFrom: 0.28, opacityTo: 0 } }, xaxis: { type: 'datetime' }, yaxis: { labels: { formatter: (v) => fmtEUR(v) } }, dataLabels: { enabled: false } }} />
      </Card>
    </section>
  );
}

function HoldingsView({ data, openAsset }: { data: DashboardData; openAsset: (holding: Holding) => void }) {
  return (
    <section className="space-y-4">
      <PanelHeader title="Holdings" subtitle={`${data.holdings.length} open positions · ${fmtEUR(data.totalMV)} market value`} />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="pro-table min-w-[1100px]">
            <thead><tr><th>Asset</th><th>Class</th><th>Shares</th><th>Avg cost</th><th>Price</th><th>Market value</th><th>P&L</th><th>P&L %</th><th>Yield</th><th>Weight</th></tr></thead>
            <tbody>
              {data.holdings.map((h) => (
                <tr key={h.isin} onClick={() => openAsset(h)} className="cursor-pointer">
                  <td><div className="font-bold">{h.name}</div><div className="num text-xs text-slate-500">{h.isin}</div></td>
                  <td><span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{h.asset_class}</span></td>
                  <td className="num text-right">{h.shares.toFixed(4)}</td>
                  <td className="num text-right">{fmtEUR(h.avg_cost)}</td>
                  <td className="num text-right">{fmtEUR(h.current_price)}</td>
                  <td className="num text-right font-bold">{fmtEUR(h.market_value)}</td>
                  <td className={`num text-right font-black ${(h.unrealized_pnl || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{signedEUR(h.unrealized_pnl)}</td>
                  <td className={`num text-right font-bold ${(h.unrealized_pct || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{pct(h.unrealized_pct)}</td>
                  <td className="num text-right text-slate-500">{h.ttm_yield !== null ? `${h.ttm_yield.toFixed(2)}%` : '—'}</td>
                  <td className="num text-right">{h.weight.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

function CashView({ data, dark }: { data: DashboardData; dark: boolean }) {
  const t = chartTheme(dark);
  return (
    <section className="grid gap-5 xl:grid-cols-3">
      <Card className="p-5 xl:col-span-2">
        <PanelTitle title="Cash balance over time" subtitle="Money sitting uninvested in the account" />
        <Chart type="area" height={320} series={[{ name: 'Cash', data: data.cashFlow.balance.map((p) => ({ x: p.date, y: p.cash })) }]} options={{ ...t, colors: ['#6366f1'], stroke: { curve: 'stepline', width: 2 }, xaxis: { type: 'datetime' }, yaxis: { labels: { formatter: (v) => fmtEUR(v) } }, dataLabels: { enabled: false } }} />
      </Card>
      <Card className="p-5">
        <PanelTitle title="Where money came and went" subtitle="Aggregate flows" />
        <Chart type="bar" height={320} series={[{ data: data.cashFlow.buckets.filter((b) => Math.abs(b.value) > 0.001).map((b) => ({ x: b.label, y: b.value, fillColor: b.value >= 0 ? '#10b981' : '#f43f5e' })) }]} options={{ ...t, plotOptions: { bar: { horizontal: true, borderRadius: 5, distributed: true } }, xaxis: { labels: { formatter: (v) => fmtEUR(Number(v)) } }, dataLabels: { enabled: false }, legend: { show: false } }} />
      </Card>
    </section>
  );
}

function IncomeView({ data }: { data: DashboardData }) {
  return <TableView title="Income" subtitle={`Total ${fmtEUR(Object.values(data.incomeTotals).reduce((a, b) => a + b, 0))}`} rows={data.income} columns={['Date', 'Type', 'Asset', 'Amount (EUR)', 'Tax (EUR)']} />;
}

function RealizedView({ data }: { data: DashboardData }) {
  return <TableView title="Realized P&L" subtitle={`Total ${signedEUR(data.realizedTotal)}`} rows={data.realized} columns={['date', 'name', 'shares', 'sell_price', 'avg_cost', 'pnl', 'pnl_pct']} />;
}

function TaxView({ data }: { data: DashboardData }) {
  return <TableView title="Tax" subtitle="Vorabpauschale and withholding tax records" rows={data.tax} columns={['Date', 'Type', 'Asset', 'Amount (EUR)', 'Tax (EUR)']} />;
}

function TableView({ title, subtitle, rows, columns }: { title: string; subtitle: string; rows: Array<Record<string, unknown>>; columns: string[] }) {
  return (
    <section className="space-y-4">
      <PanelHeader title={title} subtitle={subtitle} />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="pro-table min-w-[820px]">
            <thead><tr>{columns.map((column) => <th key={column}>{column.replaceAll('_', ' ')}</th>)}</tr></thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx}>{columns.map((column) => <td key={column} className={typeof row[column] === 'number' ? 'num text-right' : ''}>{formatCell(row[column])}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

function HeroChart({ data, dark, mode }: { data: DashboardData; dark: boolean; mode: ChartMode }) {
  const t = chartTheme(dark);
  const series = mode === 'Value'
    ? [
      { name: 'Portfolio', data: data.perf.series.map((p) => ({ x: p.date, y: p.portfolio_value })) },
      { name: 'Deposits', data: data.perf.series.map((p) => ({ x: p.date, y: p.contributions })) },
      ...(data.perf.benchmark ? [{ name: data.perf.benchmark.name, data: data.perf.benchmark.series.map((p) => ({ x: p.date, y: p.value })) }] : []),
    ]
    : mode === 'TWR'
      ? [{ name: 'TWR %', data: data.perf.twr.map((p) => ({ x: p.date, y: p.twr })) }]
      : [{ name: 'Drawdown %', data: data.perf.drawdown.map((p) => ({ x: p.date, y: p.drawdown })) }];
  const money = mode === 'Value';
  return <Chart type="area" height={360} series={series} options={{ ...t, colors: ['#10b981', '#6366f1', '#f59e0b'], stroke: { curve: 'smooth', width: [3, 2, 2] }, fill: { type: 'gradient', gradient: { opacityFrom: 0.25, opacityTo: 0 } }, xaxis: { type: 'datetime' }, yaxis: { labels: { formatter: (v) => money ? fmtEUR(v) : pct(v, 2) } }, tooltip: { x: { format: 'dd MMM yyyy' }, y: { formatter: (v) => money ? fmtEUR(v) : pct(v, 2) } }, dataLabels: { enabled: false }, legend: { position: 'top', horizontalAlign: 'right', labels: { colors: dark ? '#cbd5e1' : '#475569' } } }} />;
}

const TX_INFLOW = new Set(['SELL', 'DIVIDEND', 'INTEREST_PAYMENT', 'INTEREST', 'STOCK_PERK', 'ROUND_UP_REFUND', 'REFUND']);

function TxBadge({ type }: { type: string }) {
  const t = type.toUpperCase();
  const style =
    t === 'BUY'                                  ? 'bg-blue-500/10 text-blue-400' :
    t === 'SELL'                                 ? 'bg-emerald-500/10 text-emerald-400' :
    t === 'DIVIDEND'                             ? 'bg-amber-500/10 text-amber-400' :
    t.includes('INTEREST')                       ? 'bg-purple-500/10 text-purple-400' :
    t === 'STOCK_PERK'                           ? 'bg-teal-500/10 text-teal-400' :
    t.includes('FEE') || t.includes('TAX')      ? 'bg-rose-500/10 text-rose-400' :
                                                   'bg-slate-500/10 text-slate-400';
  return <span className={`rounded-md px-2 py-0.5 text-xs font-black tracking-wide ${style}`}>{type}</span>;
}

function AssetModal({ asset, onClose }: { asset: AssetDetail; onClose: () => void }) {
  const [detailed, setDetailed] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <Card className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black">{asset.name}</h2>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{asset.asset_class}</span>
            </div>
            <p className="num mt-1 text-sm text-slate-500">{asset.isin}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setDetailed((v) => !v)} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${detailed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'}`}>
              {detailed ? 'Simple' : 'Detailed'}
            </button>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18} /></button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-b border-slate-200 p-5 text-sm md:grid-cols-4 dark:border-slate-800">
          <MiniStat label="Shares" value={asset.current.shares.toFixed(4)} />
          <MiniStat label="Avg cost" value={fmtEUR(asset.current.avg_cost)} />
          <MiniStat label="Current" value={fmtEUR(asset.current.current_price)} />
          <MiniStat label="P&L" value={signedEUR(asset.current.unrealized)} />
        </div>
        <div className="overflow-auto">
          <table className="pro-table min-w-[680px]">
            <thead>
              <tr>
                <th>Date</th><th>Type</th><th>Shares</th><th>Price</th><th>Amount</th>
                {detailed && <><th>Fee</th><th>Tax</th><th>Note</th></>}
              </tr>
            </thead>
            <tbody>
              {asset.transactions.map((tx, idx) => {
                const inflow = TX_INFLOW.has((tx.type || '').toUpperCase());
                return (
                  <tr key={idx}>
                    <td className="text-slate-500">{tx.date}</td>
                    <td><TxBadge type={tx.type} /></td>
                    <td className="num text-right">{tx.shares?.toFixed(4) || '—'}</td>
                    <td className="num text-right">{fmtEUR(tx.price)}</td>
                    <td className={`num text-right font-bold ${inflow ? 'text-emerald-500' : ''}`}>
                      {tx.amount !== null ? `${inflow ? '+' : ''}${fmtEUR(Math.abs(tx.amount ?? 0))}` : '—'}
                    </td>
                    {detailed && (
                      <>
                        <td className="num text-right text-rose-400">{tx.fee ? fmtEUR(tx.fee) : '—'}</td>
                        <td className="num text-right text-rose-400">{tx.tax ? fmtEUR(tx.tax) : '—'}</td>
                        <td className="text-xs text-slate-500">{tx.description || '—'}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function PanelTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="mb-4"><h2 className="text-base font-black tracking-tight">{title}</h2><p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p></div>;
}

function PanelHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><h2 className="text-xl font-black tracking-tight">{title}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p></div>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div><div className="num mt-1 font-black">{value}</div></div>;
}

function rollingReturns(twr: DashboardData['perf']['twr']) {
  const labels = ['1M', '3M', '6M', '12M', 'YTD'];
  if (!twr.length) return labels.map((label) => ({ label, pct: null as number | null }));
  const last = twr[twr.length - 1];
  const currentMult = 1 + last.twr / 100;
  const lastDate = new Date(last.date);
  const periods = [
    { label: '1M', target: new Date(lastDate.getFullYear(), lastDate.getMonth() - 1, lastDate.getDate()) },
    { label: '3M', target: new Date(lastDate.getFullYear(), lastDate.getMonth() - 3, lastDate.getDate()) },
    { label: '6M', target: new Date(lastDate.getFullYear(), lastDate.getMonth() - 6, lastDate.getDate()) },
    { label: '12M', target: new Date(lastDate.getFullYear() - 1, lastDate.getMonth(), lastDate.getDate()) },
    { label: 'YTD', target: new Date(lastDate.getFullYear(), 0, 1) },
  ];
  return periods.map(({ label, target }) => {
    const past = [...twr].reverse().find((p) => new Date(p.date) <= target);
    if (!past) return { label, pct: null };
    return { label, pct: (currentMult / (1 + past.twr / 100) - 1) * 100 };
  });
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return Math.abs(value) > 100 || Number.isInteger(value) ? value.toLocaleString('en-GB', { maximumFractionDigits: 2 }) : value.toFixed(2);
  return String(value);
}

function SkeletonDashboard() {
  return <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />)}</div>;
}

function EmptyState() {
  return <Card className="p-8 text-center"><h2 className="text-lg font-black">No CSV export found</h2><p className="mt-2 text-sm text-slate-500">Add a CSV file to exports/ or import one from the toolbar.</p></Card>;
}
