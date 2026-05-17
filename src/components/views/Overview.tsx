import { useMemo, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowUpRight,
  Banknote, CheckCircle2, PiggyBank, Receipt, Wallet,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { MetricCard } from '../ui/MetricCard';
import { InfoModal } from '../ui/InfoModal';
import { PanelTitle } from '../ui/PanelTitle';
import { HeroChart } from '../charts/HeroChart';
import { AllocationTreemap } from '../charts/AllocationTreemap';
import { fmtEUR, signedEUR, pct, rollingReturns } from '../../lib/format';
import type { ChartMode, DashboardData, Holding, SectionId } from '../../types';

type DetailView = 'unrealized' | 'income' | 'fees' | null;

interface OverviewProps {
  data: DashboardData;
  dark: boolean;
  chartMode: ChartMode;
  setChartMode: (mode: ChartMode) => void;
  openAsset: (holding: Holding) => void;
  navigate: (id: SectionId) => void;
}

export function Overview({ data, dark, chartMode, setChartMode, openAsset, navigate }: OverviewProps) {
  const s = data.summary;
  const returns = useMemo(() => rollingReturns(data.perf.twr), [data.perf.twr]);
  const movers = useMemo(
    () => [...data.holdings].filter((h) => h.unrealized_pnl !== null).sort((a, b) => Math.abs(b.unrealized_pnl || 0) - Math.abs(a.unrealized_pnl || 0)).slice(0, 6),
    [data.holdings],
  );
  const unrealizedHoldings = useMemo(
    () => [...data.holdings].filter((h) => h.unrealized_pnl !== null).sort((a, b) => (b.unrealized_pnl || 0) - (a.unrealized_pnl || 0)),
    [data.holdings],
  );
  const [detail, setDetail] = useState<DetailView>(null);

  return (
    <section className="space-y-6">
      {detail === 'unrealized' && (
        <InfoModal title="Unrealized P&L by holding" onClose={() => setDetail(null)}>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {unrealizedHoldings.map((h) => (
              <div key={h.isin} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{h.name}</div>
                  <div className="text-xs text-slate-400">{h.shares} shares · avg {fmtEUR(h.avg_cost)}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={`num text-sm font-black ${(h.unrealized_pnl || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{signedEUR(h.unrealized_pnl)}</div>
                  <div className={`text-xs font-semibold ${(h.unrealized_pct || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{pct(h.unrealized_pct)}</div>
                </div>
              </div>
            ))}
          </div>
        </InfoModal>
      )}

      {detail === 'income' && (
        <InfoModal title="Income breakdown" onClose={() => setDetail(null)}>
          <div className="space-y-3">
            {[
              { label: 'Dividends',   value: s.dividends },
              { label: 'Interest',    value: s.interest },
              { label: 'Stock perks', value: s.stockperks },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{row.label}</span>
                <span className="num text-sm font-black text-emerald-500">{fmtEUR(row.value)}</span>
              </div>
            ))}
            <button onClick={() => { setDetail(null); navigate('income'); }} className="mt-2 w-full rounded-lg bg-emerald-500 py-2 text-sm font-bold text-white hover:bg-emerald-600">
              See all income events →
            </button>
          </div>
        </InfoModal>
      )}

      {detail === 'fees' && (
        <InfoModal title="Fees & tax breakdown" onClose={() => setDetail(null)}>
          <div className="space-y-3">
            {[
              { label: 'Trading fees', value: s.fees,           color: 'text-rose-500' },
              { label: 'Tax paid',     value: s.tax,            color: 'text-rose-500' },
              { label: 'Total drag',   value: s.fees + s.tax,   color: 'text-rose-600' },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800">
                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{row.label}</span>
                <span className={`num text-sm font-black ${row.color}`}>{fmtEUR(-row.value)}</span>
              </div>
            ))}
            <button onClick={() => { setDetail(null); navigate('tax'); }} className="mt-2 w-full rounded-lg bg-slate-700 py-2 text-sm font-bold text-white hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500">
              See tax details →
            </button>
          </div>
        </InfoModal>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="md:col-span-2">
          <MetricCard label="Portfolio value" value={fmtEUR(s.portfolio_value)} detail={`${signedEUR(s.portfolio_value - s.net_deposits)} vs deposits · since ${s.first_trade_date ?? '—'}`} tone={s.portfolio_value >= s.net_deposits ? 'gain' : 'loss'} icon={Wallet} onClick={() => navigate('analytics')} />
        </div>
        <MetricCard label="Unrealized P&L"  value={signedEUR(s.unrealized_pnl)} detail={pct(s.unrealized_pct)} tone={s.unrealized_pnl >= 0 ? 'gain' : 'loss'} icon={ArrowUpRight} onClick={() => setDetail('unrealized')} />
        <MetricCard label="Realized P&L"    value={signedEUR(s.realized_pnl)} detail={`${s.n_realized} closed trades`} tone={s.realized_pnl >= 0 ? 'gain' : 'loss'} icon={CheckCircle2} onClick={() => navigate('realized')} />
        <MetricCard label="XIRR annualized" value={s.xirr === null ? '—' : pct(s.xirr * 100)} detail="Money-weighted return" tone={(s.xirr || 0) >= 0 ? 'gain' : 'loss'} icon={Activity} onClick={() => navigate('analytics')} />
        <MetricCard label="Net deposits"    value={fmtEUR(s.net_deposits)} detail={`${s.n_holdings} open positions`} icon={PiggyBank} onClick={() => navigate('cash')} />
        <MetricCard label="Total income"    value={fmtEUR(s.dividends + s.interest + s.stockperks)} detail="Dividends · interest · perks" tone="gain" icon={Banknote} onClick={() => setDetail('income')} />
        <MetricCard label="Fees & tax"      value={fmtEUR(-(s.fees + s.tax))} detail={`${fmtEUR(s.fees)} fees · ${fmtEUR(s.tax)} tax`} tone="loss" icon={Receipt} onClick={() => setDetail('fees')} />
      </div>

      <div className="grid gap-3 sm:grid-cols-5 xl:grid-cols-7">
        {returns.map((item) => (
          <Card key={item.label} className="border-l-4 border-l-slate-300 p-4 dark:border-l-slate-700">
            <div className="flex items-center justify-between">
              <div className="num text-base font-black tracking-normal text-slate-700 dark:text-slate-200">{item.label}</div>
              {(item.pct ?? 0) >= 0 ? <ArrowUpRight size={16} className="text-emerald-500" /> : <ArrowDownRight size={16} className="text-rose-500" />}
            </div>
            <div className={`num mt-4 text-xl font-black tracking-normal ${(item.pct ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {item.pct === null ? '—' : pct(item.pct)}
            </div>
          </Card>
        ))}
        {data.perf.best_worst.best[0] && (
          <Card className="border-l-4 border-l-emerald-500 p-4">
            <div className="flex items-center justify-between">
              <div className="num text-base font-black tracking-normal text-slate-700 dark:text-slate-200">Best days</div>
              <ArrowUpRight size={16} className="text-emerald-500" />
            </div>
            <div className="mt-3 space-y-2">
              {data.perf.best_worst.best.map((d, i) => (
                <div key={d.date} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{d.date}</span>
                  <span className={`num text-sm font-black ${i === 0 ? 'text-emerald-500' : 'text-emerald-400'}`}>{signedEUR(d.pnl)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
        {data.perf.best_worst.worst[0] && (
          <Card className="border-l-4 border-l-rose-500 p-4">
            <div className="flex items-center justify-between">
              <div className="num text-base font-black tracking-normal text-slate-700 dark:text-slate-200">Worst days</div>
              <ArrowDownRight size={16} className="text-rose-500" />
            </div>
            <div className="mt-3 space-y-2">
              {data.perf.best_worst.worst.map((d, i) => (
                <div key={d.date} className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{d.date}</span>
                  <span className={`num text-sm font-black ${i === 0 ? 'text-rose-500' : 'text-rose-400'}`}>{signedEUR(d.pnl)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <AllocationTreemap data={data} dark={dark} openAsset={openAsset} />

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <PanelTitle title="Portfolio performance" subtitle="Portfolio value, deposits, and benchmark" />
          <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(['Value', 'TWR', 'Drawdown'] as ChartMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setChartMode(mode)}
                className={`rounded-md px-3 py-1.5 text-sm font-bold ${chartMode === mode ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-950 dark:text-white' : 'text-slate-500'}`}
              >
                {mode}
              </button>
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
