import { useEffect, useMemo, useState } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import {
  ArrowUpRight, ChevronRight,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { InfoModal } from '../ui/InfoModal';
import { HeroChart } from '../charts/HeroChart';
import { chartTheme, tileColor } from '../../lib/chart';
import { fmtEUR, signedEUR, pct, rollingReturns } from '../../lib/format';
import { fetchPerformance } from '../../api';
import type { BenchmarkPoint, ChartMode, DashboardData, Holding, PositionRange, SectionId } from '../../types';

type DetailView = 'unrealized' | 'income' | 'fees' | null;
type AllocationTab = 'type' | 'positions' | 'regions' | 'sectors';
type ChartRange = '1D' | '1W' | '1M' | 'YTD' | '1Y' | 'Max';
type PositionRangeOption = PositionRange | 'Max';

interface OverviewProps {
  data: DashboardData;
  dark: boolean;
  chartMode: ChartMode;
  setChartMode: (mode: ChartMode) => void;
  openAsset: (holding: Holding) => void;
  navigate: (id: SectionId) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Overview({ data, dark, chartMode, openAsset, navigate }: OverviewProps) {
  const s = data.summary;
  const t = chartTheme(true);
  const returns = useMemo(() => rollingReturns(data.perf.twr), [data.perf.twr]);
  const sortedHoldings = useMemo(
    () => [...data.holdings].filter((h) => h.market_value !== null).sort((a, b) => (b.market_value || 0) - (a.market_value || 0)),
    [data.holdings],
  );
  const topHoldings = useMemo(() => sortedHoldings.slice(0, 6), [sortedHoldings]);
  const unrealizedHoldings = useMemo(
    () => [...data.holdings].filter((h) => h.unrealized_pnl !== null).sort((a, b) => (b.unrealized_pnl || 0) - (a.unrealized_pnl || 0)),
    [data.holdings],
  );
  const [detail, setDetail] = useState<DetailView>(null);
  const [allocationTab, setAllocationTab] = useState<AllocationTab>('type');
  const [chartRange, setChartRange] = useState<ChartRange>('Max');
  const [positionRange, setPositionRange] = useState<PositionRangeOption>('Max');

  type BenchmarkOption = { label: string; ticker: string };
  const benchmarkOptions: BenchmarkOption[] = [
    { label: 'None',      ticker: '' },
    { label: 'MSCI World', ticker: 'URTH' },
    { label: 'S&P 500',   ticker: 'CSPX.L' },
  ];
  const [benchmarkTicker, setBenchmarkTicker] = useState<string>('URTH');
  const [benchmarkPoints, setBenchmarkPoints] = useState<BenchmarkPoint[] | null>(data.perf.benchmark);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBenchmarkPoints(null);
    if (!benchmarkTicker) return;
    let cancelled = false;
    fetchPerformance(data.summary.export, benchmarkTicker)
      .then((perf) => { if (!cancelled) setBenchmarkPoints(perf.benchmark); })
      .catch(() => { if (!cancelled) setBenchmarkPoints([]); });
    return () => { cancelled = true; };
  }, [benchmarkTicker, data.summary.export]);
  const totalPnl = s.portfolio_value - s.net_deposits;
  const totalPnlPct = s.net_deposits ? (totalPnl / s.net_deposits) * 100 : 0;
  const allocationHoldings = useMemo(
    () => [...data.holdings]
      .filter((holding) => (holding.market_value || 0) > 0)
      .sort((a, b) => (b.market_value || 0) - (a.market_value || 0)),
    [data.holdings],
  );
  const allocation = useMemo(() => {
    const withCash = (rows: Array<{ label: string; value: number }>) => {
      const filtered = rows.filter((item) => item.value > 0);
      if (s.cash_balance > 0) filtered.push({ label: 'Cash', value: s.cash_balance });
      return filtered.sort((a, b) => b.value - a.value);
    };

    if (allocationTab === 'positions') {
      return withCash(allocationHoldings.map((holding) => ({
        label: holding.name,
        value: holding.market_value || 0,
      })));
    }

    if (allocationTab === 'regions') {
      const names: Record<string, string> = {
        DE: 'Germany',
        US: 'United States',
        IE: 'Ireland',
        LU: 'Luxembourg',
        FR: 'France',
        GB: 'United Kingdom',
        NL: 'Netherlands',
        BTC: 'Crypto',
        ETH: 'Crypto',
      };
      const grouped = new Map<string, number>();
      allocationHoldings.forEach((holding) => {
        const code = holding.isin.length >= 2 ? holding.isin.slice(0, 2).toUpperCase() : 'Other';
        const label = names[code] || code;
        grouped.set(label, (grouped.get(label) || 0) + (holding.market_value || 0));
      });
      return withCash([...grouped.entries()].map(([label, value]) => ({ label, value })));
    }

    const grouped = new Map<string, number>();
    allocationHoldings.forEach((holding) => {
      const label = holding.asset_class || 'Other';
      grouped.set(label, (grouped.get(label) || 0) + (holding.market_value || 0));
    });
    return withCash([...grouped.entries()].map(([label, value]) => ({ label, value })));
  }, [allocationHoldings, allocationTab, s.cash_balance]);
  const allocationTotal = s.portfolio_value;
  const rangeOptions: ChartRange[] = ['1D', '1W', '1M', 'YTD', '1Y', 'Max'];
  const allocationColors = ['#3347c4', '#4974c7', '#5eb1dd', '#82d3e1', '#8ee4d8', '#62d995', '#f2ad3a'];
  const positionRangeOptions: PositionRangeOption[] = ['1D', '1W', '1M', 'YTD', '1Y', 'Max'];
  const positionRows = useMemo(() => {
    const rows = sortedHoldings.map((holding) => {
      if (positionRange === 'Max') {
        return {
          holding,
          pnl: holding.unrealized_pnl,
          pct: holding.unrealized_pct,
        };
      }
      const range = data.positionReturns[holding.isin]?.[positionRange];
      return {
        holding,
        pnl: range?.pnl ?? null,
        pct: range?.pct ?? null,
      };
    });
    return [...rows].sort((a, b) => Math.abs(b.pnl ?? 0) - Math.abs(a.pnl ?? 0));
  }, [data.positionReturns, positionRange, sortedHoldings]);
  const perfWithBenchmark = useMemo(() => ({
    ...data.perf,
    benchmark: benchmarkTicker ? (benchmarkPoints ?? null) : null,
  }), [data.perf, benchmarkTicker, benchmarkPoints]);

  const chartData = useMemo(() => {
    const baseData = { ...data, perf: perfWithBenchmark };
    if (chartRange === 'Max') return baseData;

    const allDates = [
      ...data.perf.series.map((point) => point.date),
      ...data.perf.twr.map((point) => point.date),
      ...data.perf.drawdown.map((point) => point.date),
    ].filter(Boolean).sort();
    const lastDate = allDates.at(-1);
    if (!lastDate) return baseData;

    const end = new Date(`${lastDate}T00:00:00`);
    const start = new Date(end);
    if (chartRange === '1D') start.setDate(end.getDate() - 1);
    if (chartRange === '1W') start.setDate(end.getDate() - 7);
    if (chartRange === '1M') start.setMonth(end.getMonth() - 1);
    if (chartRange === '1Y') start.setFullYear(end.getFullYear() - 1);
    if (chartRange === 'YTD') {
      start.setMonth(0);
      start.setDate(1);
    }

    const startKey = start.toISOString().slice(0, 10);
    const keepWindow = <T extends { date: string }>(rows: T[]) => {
      const filtered = rows.filter((row) => row.date >= startKey);
      return filtered.length >= 2 ? filtered : rows.slice(-2);
    };

    return {
      ...baseData,
      perf: {
        ...perfWithBenchmark,
        series: keepWindow(perfWithBenchmark.series),
        twr: keepWindow(perfWithBenchmark.twr),
        drawdown: keepWindow(perfWithBenchmark.drawdown),
        benchmark: perfWithBenchmark.benchmark
          ? keepWindow(perfWithBenchmark.benchmark)
          : null,
      },
    };
  }, [chartRange, data, perfWithBenchmark]);
  const allocationTreemapSeries = useMemo(() => [{
    data: allocationHoldings.map((holding) => ({
      x: holding.name,
      y: holding.market_value || 0,
      fillColor: tileColor(holding.unrealized_pct ?? 0),
    })),
  }], [allocationHoldings]);
  const allocationTreemapOptions = useMemo<ApexOptions>(() => ({
    ...t,
    chart: {
      ...t.chart,
      type: 'treemap',
      events: {
        dataPointSelection: (_event, _chart, config) => {
          const holding = allocationHoldings[config.dataPointIndex];
          if (holding) openAsset(holding);
        },
      },
    },
    plotOptions: {
      treemap: {
        distributed: true,
        enableShades: false,
      },
    },
    dataLabels: {
      enabled: true,
      style: {
        colors: ['#ffffff'],
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        fontSize: '12px',
        fontWeight: 800,
      },
      formatter: (label: string, opts) => {
        const holding = allocationHoldings[opts.dataPointIndex];
        if (!holding) return label;
        return `${label}\n${(holding.weight ?? 0).toFixed(1)}%`;
      },
    },
    stroke: { width: 2, colors: ['#202020'] },
    legend: { show: false },
    tooltip: {
      ...t.tooltip,
      custom: ({ dataPointIndex }) => {
        const holding = allocationHoldings[dataPointIndex];
        if (!holding) return '';
        const color = tileColor(holding.unrealized_pct ?? 0);
        const safeName = holding.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        return `<div style="padding:10px 12px;font-size:12px;font-family:Inter,sans-serif">
          <div style="max-width:240px;font-weight:800;margin-bottom:6px">${safeName}</div>
          <div>Market value: <b>${fmtEUR(holding.market_value)}</b></div>
          <div>Weight: <b>${(holding.weight ?? 0).toFixed(1)}%</b></div>
          <div>P/L: <b style="color:${color}">${signedEUR(holding.unrealized_pnl)} (${pct(holding.unrealized_pct)})</b></div>
        </div>`;
      },
    },
  }), [allocationHoldings, openAsset, t]);

  return (
    <section className="space-y-7">
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
        <InfoModal title="Cash costs breakdown" onClose={() => setDetail(null)}>
          <div className="space-y-3">
            {[
              { label: 'Trading fees', value: s.fees,           color: 'text-rose-500' },
              { label: 'Tax withheld', value: s.tax,            color: 'text-slate-700 dark:text-slate-200' },
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

      <div className="grid gap-7 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <Card className="overflow-hidden rounded-lg !border-[#303030] !bg-[#202020] text-white shadow-none">
          <div className="flex items-center justify-between border-b border-white/6 px-5 py-4">
            <div>
              <h2 className="text-lg font-black">Portfolio</h2>
              <div className="mt-4 inline-flex border-b border-white pb-2 text-sm font-black">Trade Republic</div>
            </div>
            <div className="flex items-center gap-2">
              <button className="inline-flex h-9 items-center gap-2 rounded-md bg-white px-3 text-sm font-black text-black hover:bg-slate-100" onClick={() => navigate('holdings')}>
                View holdings <ChevronRight size={16} />
              </button>
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-slate-300">
              <div className="flex items-center gap-5">
                <button className="inline-flex items-center gap-2 hover:text-white" onClick={() => navigate('analytics')}><ArrowUpRight size={17} /> Performance</button>
              </div>
            </div>

            <div className="mt-7 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
              <button className="text-left" onClick={() => navigate('analytics')}>
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 rounded-full ${totalPnl >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  <div className="num text-5xl font-black tracking-normal text-white">{fmtEUR(s.portfolio_value)}</div>
                </div>
                <div className={`num mt-3 text-xl font-black ${totalPnl >= 0 ? 'text-[#6ee787]' : 'text-rose-400'}`}>
                  {pct(totalPnlPct)} <span className="text-base">({signedEUR(totalPnl)})</span>
                </div>
              </button>

              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center justify-end gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-500">Benchmark:</span>
                    <select
                      value={benchmarkTicker}
                      onChange={(e) => setBenchmarkTicker(e.target.value)}
                      className="rounded-md bg-white/10 px-2 py-1 text-xs font-black text-slate-200 outline-none hover:bg-white/15"
                    >
                      {benchmarkOptions.map((opt) => (
                        <option key={opt.ticker} value={opt.ticker} className="bg-[#303030] text-slate-200">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {rangeOptions.map((range) => (
                    <button
                      key={range}
                      onClick={() => setChartRange(range)}
                      className={`rounded-md px-4 py-2 text-sm font-black ${range === chartRange ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
                <div className="h-48 md:h-[300px]">
                  <HeroChart
                    data={chartData}
                    dark={true}
                    mode={chartMode}
                    height={300}
                    showLegend={false}
                    minimal
                    benchmarkLabel={benchmarkOptions.find((o) => o.ticker === benchmarkTicker)?.label}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="rounded-lg !border-[#303030] !bg-[#202020] p-5 text-white shadow-none">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <h2 className="text-lg font-black">Allocation</h2>
              <span className="text-sm font-black uppercase text-slate-500">Live</span>
            </div>
            <button onClick={() => navigate('analytics')} className="inline-flex items-center gap-1 text-sm font-bold text-slate-300 hover:text-white">
              Show more <ChevronRight size={16} />
            </button>
          </div>
          <div className="mt-5 flex gap-5 overflow-x-auto border-b border-white/8 text-sm font-bold text-slate-500">
            {[
              { id: 'type', label: 'Type' },
              { id: 'positions', label: 'Positions' },
              { id: 'regions', label: 'Regions' },
              { id: 'sectors', label: 'Sectors' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setAllocationTab(item.id as AllocationTab)}
                className={`pb-3 ${allocationTab === item.id ? 'border-b-2 border-white text-white' : 'hover:text-white'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {allocationTab === 'sectors' && (
            <div className="mt-3 rounded-md bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-500">
              No sector metadata available — showing by asset class
            </div>
          )}
          <Chart
            type="donut"
            height={330}
            series={allocation.map((item) => item.value)}
            options={{
              ...t,
              labels: allocation.map((item) => item.label),
              colors: allocationColors,
              stroke: { width: 0 },
              plotOptions: { pie: { donut: { size: '70%', labels: { show: true, name: { color: '#8b8b8b', fontSize: '13px' }, value: { color: '#fff', fontSize: '26px', formatter: (v: string) => fmtEUR(Number(v)) }, total: { show: true, label: 'Allocation', color: '#8b8b8b', formatter: () => fmtEUR(allocationTotal) } } } } },
              dataLabels: { enabled: false },
              legend: { show: false },
              tooltip: { ...t.tooltip, y: { formatter: (v) => fmtEUR(v) } },
            }}
          />
          <div className="mt-2 space-y-2">
            {allocation.map((item, index) => {
              const weight = allocationTotal ? (item.value / allocationTotal) * 100 : 0;
              return (
                <div key={item.label} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: allocationColors[index % allocationColors.length] }} />
                    <span className="truncate text-sm font-black text-slate-200">{item.label}</span>
                  </div>
                  <div className="num shrink-0 text-right text-sm font-black text-white">
                    {weight.toFixed(1)}%
                    <span className="ml-2 text-slate-500">{fmtEUR(item.value)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="rounded-lg !border-[#303030] !bg-[#202020] p-5 text-white shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Position wall</h2>
            <div className="mt-1 text-sm font-bold text-slate-500">Size = value · color = P/L</div>
          </div>
          <div className="flex items-center gap-3 text-xs font-black uppercase text-slate-500">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
              Loss
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              Gain
            </span>
          </div>
        </div>
        <div className="mt-5 min-w-0 rounded-lg bg-white/[0.035] p-3">
          <Chart
            type="treemap"
            height={360}
            series={allocationTreemapSeries}
            options={allocationTreemapOptions}
          />
        </div>
      </Card>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <Card className="rounded-lg !border-[#303030] !bg-[#202020] p-5 text-white shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-black">Positions</h2>
            <button onClick={() => navigate('holdings')} className="inline-flex h-9 items-center gap-2 rounded-md bg-white px-3 text-sm font-black text-black hover:bg-slate-100">View holdings <ChevronRight size={16} /></button>
          </div>
          <div className="mt-6 flex gap-8 text-sm font-black text-slate-500">
            {positionRangeOptions.map((range) => (
              <button
                key={range}
                onClick={() => setPositionRange(range)}
                className={range === positionRange ? 'rounded-md bg-white/10 px-4 py-2 text-white' : 'py-2 hover:text-white'}
              >
                {range}
              </button>
            ))}
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs font-black uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-3">Title</th>
                  <th className="py-3 text-right">Buy in</th>
                  <th className="py-3 text-right">Position</th>
                  <th className="py-3 text-right">P/L</th>
                </tr>
              </thead>
              <tbody>
                {positionRows.map(({ holding: item, pnl, pct: rangePct }) => (
                  <tr key={item.isin} className="border-t border-white/6 transition hover:bg-white/[0.04]">
                    <td className="py-4">
                      <button onClick={() => openAsset(item)} className="flex items-center gap-3 text-left">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-sm font-black text-slate-300">{item.name.slice(0, 1)}</span>
                        <span>
                          <span className="block font-black text-white">{item.name}</span>
                          <span className="num text-xs text-slate-500">{item.isin}</span>
                        </span>
                      </button>
                    </td>
                    <td className="num py-4 text-right">
                      <div className="font-bold text-slate-200">{fmtEUR(item.cost_basis)}</div>
                      <div className="text-xs text-slate-500">{fmtEUR(item.avg_cost)}</div>
                    </td>
                    <td className="num py-4 text-right">
                      <div className="font-bold text-slate-200">{fmtEUR(item.market_value)}</div>
                      <div className="text-xs text-slate-500">{(item.shares ?? 0).toFixed(4)} shares</div>
                    </td>
                    <td className={`num py-4 text-right font-black ${(pnl || 0) >= 0 ? 'text-[#6ee787]' : 'text-rose-400'}`}>
                      <div>{signedEUR(pnl)}</div>
                      <div className="text-xs">{pct(rangePct)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-7">
          <Card className="rounded-lg !border-[#303030] !bg-[#202020] p-5 text-white shadow-none">
            <h2 className="text-lg font-black">Quick stats</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { label: 'Unrealized', value: signedEUR(s.unrealized_pnl), action: () => setDetail('unrealized'), positive: s.unrealized_pnl >= 0 },
                { label: 'Realized', value: signedEUR(s.realized_pnl), action: () => navigate('realized'), positive: s.realized_pnl >= 0 },
                { label: 'Income', value: fmtEUR(s.dividends + s.interest + s.stockperks), action: () => setDetail('income'), positive: true },
                { label: 'Costs', value: fmtEUR(-(s.fees + s.tax)), action: () => setDetail('fees'), positive: false },
              ].map((item) => (
                <button key={item.label} onClick={item.action} className="rounded-lg bg-white/[0.04] p-3 text-left hover:bg-white/[0.07]">
                  <div className="text-xs font-black uppercase tracking-wide text-slate-500">{item.label}</div>
                  <div className={`num mt-2 text-base font-black ${item.positive ? 'text-[#6ee787]' : 'text-rose-400'}`}>{item.value}</div>
                </button>
              ))}
            </div>
          </Card>
          <Card className="rounded-lg !border-[#303030] !bg-[#202020] p-5 text-white shadow-none">
            <h2 className="text-lg font-black">Performance windows</h2>
            <div className="mt-3 space-y-2">
              {returns.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2">
                  <span className="num text-sm font-black text-slate-300">{item.label}</span>
                  <span className={`num text-sm font-black ${(item.pct ?? 0) >= 0 ? 'text-[#6ee787]' : 'text-rose-400'}`}>{item.pct === null ? '—' : pct(item.pct)}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="rounded-lg !border-[#303030] !bg-[#202020] p-5 text-white shadow-none">
            <h2 className="text-lg font-black">Largest movers</h2>
            <div className="mt-2 space-y-2">
              {topHoldings.slice(0, 4).map((item) => (
              <button key={item.isin} onClick={() => openAsset(item)} className="flex w-full items-center justify-between gap-3 rounded-lg p-2 text-left hover:bg-white/[0.06]">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-100">{item.name}</div>
                  <div className="num text-xs text-slate-500">{(item.weight ?? 0).toFixed(1)}% weight</div>
                </div>
                <div className="text-right">
                  <div className={`num text-sm font-black ${(item.unrealized_pnl || 0) >= 0 ? 'text-[#6ee787]' : 'text-rose-400'}`}>{signedEUR(item.unrealized_pnl)}</div>
                  <div className="num text-xs text-slate-500">{pct(item.unrealized_pct)}</div>
                </div>
              </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
