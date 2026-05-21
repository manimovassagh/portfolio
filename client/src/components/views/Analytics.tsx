import Chart from 'react-apexcharts';
import { Activity, ArrowDownRight, ArrowUpRight, BarChart2 } from 'lucide-react';
import { Card } from '../ui/Card';
import { MetricCard } from '../ui/MetricCard';
import { PanelTitle } from '../ui/PanelTitle';
import { chartTheme } from '../../lib/chart';
import { fmtEUR, pct } from '../../lib/format';
import { useGeographicQuery } from '../../lib/queries';
import type { DashboardData } from '../../types';

interface AnalyticsViewProps {
  data: DashboardData;
  dark: boolean;
}

export function AnalyticsView({ data, dark }: AnalyticsViewProps) {
  const t = chartTheme(dark);
  const sectors = data.analytics.sectors.filter((s) => s.value > 0);
  const years = Object.keys(data.analytics.monthly).sort();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const donutLabels = { show: true, value: { formatter: (value: string) => fmtEUR(Number(value)) } };
  const { data: geo } = useGeographicQuery(data.summary.export);

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Sharpe ratio"    value={data.analytics.sharpe?.toFixed(2) || '—'} detail="Risk-adjusted return" tone={(data.analytics.sharpe || 0) >= 1 ? 'gain' : 'warn'} icon={Activity} />
        <MetricCard label="Volatility"      value={data.analytics.volatility ? pct(data.analytics.volatility * 100, 1) : '—'} detail="Annualized std deviation" icon={BarChart2} />
        <MetricCard label="Max DD duration" value={`${data.analytics.max_dd_days || 0} days`} detail="Longest underwater streak" tone="loss" icon={ArrowDownRight} />
        <MetricCard label="Total return"    value={pct(data.summary.total_return * 100)} detail="Since first deposit" tone={data.summary.total_return >= 0 ? 'gain' : 'loss'} icon={ArrowUpRight} />
      </div>

      <Card className="p-5">
        <PanelTitle title="Monthly returns" subtitle="Month-over-month TWR change" />
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[780px]">
            <Chart
              type="heatmap"
              height={Math.max(150, years.length * 70)}
              series={years.map((year) => ({ name: year, data: months.map((m) => ({ x: m, y: data.analytics.monthly[year]?.[m] ?? null })) }))}
              options={{
                ...t,
                dataLabels: { enabled: true, formatter: (v) => (v === null ? '' : pct(Number(v), 1)), style: { fontSize: '12px', fontWeight: 800, colors: ['#fff'] } },
                plotOptions: { heatmap: { radius: 6, enableShades: false, colorScale: { ranges: [
                  { from: -100, to: -5,   color: '#be123c' },
                  { from: -5,   to: -0.1, color: '#e11d48' },
                  { from: -0.1, to: 0.1,  color: '#334155' },
                  { from: 0.1,  to: 5,    color: '#059669' },
                  { from: 5,    to: 100,  color: '#047857' },
                ] } } },
                legend: { show: false },
              }}
            />
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <PanelTitle title="Annual P&L" subtitle="Year-over-year gain or loss" />
          <Chart
            type="bar"
            height={300}
            series={[{ name: 'P&L', data: data.analytics.annual.map((a) => ({ x: String(a.year), y: a.pnl, fillColor: a.pnl >= 0 ? '#10b981' : '#f43f5e' })) }]}
            options={{ ...t, plotOptions: { bar: { borderRadius: 7, columnWidth: '54%', distributed: true } }, yaxis: { labels: { formatter: (v) => fmtEUR(v) } }, dataLabels: { enabled: true, formatter: (_v, ctx) => pct(data.analytics.annual[ctx.dataPointIndex]?.pct, 1), style: { fontSize: '12px', fontWeight: 800 } }, legend: { show: false } }}
          />
        </Card>
        <Card className="p-5">
          <PanelTitle title="Allocation by asset class" subtitle="Diversification breakdown" />
          <Chart
            type="donut"
            height={300}
            series={sectors.map((s) => s.value)}
            options={{
              ...t,
              labels: sectors.map((s) => s.label),
              colors: ['#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#06b6d4'],
              plotOptions: { pie: { donut: { size: '68%', labels: { ...donutLabels, total: { show: true, label: 'Total', formatter: () => fmtEUR(sectors.reduce((a, b) => a + b.value, 0)) } } } } },
              dataLabels: { enabled: true, formatter: (v) => `${Number(v).toFixed(1)}%`, style: { fontSize: '12px', fontWeight: 800 } },
              legend: { position: 'bottom', labels: { colors: dark ? '#cbd5e1' : '#475569' } },
              tooltip: { y: { formatter: (v) => fmtEUR(v) } },
            }}
          />
        </Card>
      </div>

      {geo && geo.countries.length > 0 && (
        <Card className="p-5">
          <PanelTitle title="Geographic exposure" subtitle="Portfolio value by country" />
          <Chart
            type="donut"
            height={300}
            series={geo.countries.map((c) => c.value)}
            options={{
              ...t,
              labels: geo.countries.map((c) => c.name),
              colors: ['#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#06b6d4', '#f43f5e', '#84cc16', '#ec4899'],
              plotOptions: { pie: { donut: { size: '68%', labels: { ...donutLabels, total: { show: true, label: 'Total', formatter: () => fmtEUR(geo.countries.reduce((a, b) => a + b.value, 0)) } } } } },
              dataLabels: { enabled: true, formatter: (v) => `${Number(v).toFixed(1)}%`, style: { fontSize: '12px', fontWeight: 800 } },
              legend: { position: 'bottom', labels: { colors: dark ? '#cbd5e1' : '#475569' } },
              tooltip: { y: { formatter: (v) => fmtEUR(v) } },
            }}
          />
        </Card>
      )}

      <Card className="p-5">
        <PanelTitle title="Unrealized P&L over time" subtitle="Market value minus cumulative cost" />
        <Chart
          type="area"
          height={300}
          series={[{ name: 'Unrealized P&L', data: data.analytics.pnl_series.map((p) => ({ x: p.date, y: p.pnl })) }]}
          options={{ ...t, colors: ['#10b981'], stroke: { curve: 'smooth', width: 2 }, fill: { type: 'gradient', gradient: { opacityFrom: 0.28, opacityTo: 0 } }, xaxis: { type: 'datetime' }, yaxis: { labels: { formatter: (v) => fmtEUR(v) } }, dataLabels: { enabled: false } }}
        />
      </Card>
    </section>
  );
}
