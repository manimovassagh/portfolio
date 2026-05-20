import Chart from 'react-apexcharts';
import { chartTheme } from '../../lib/chart';
import { fmtEUR, pct } from '../../lib/format';
import type { ChartMode, DashboardData } from '../../types';

interface HeroChartProps {
  data: DashboardData;
  dark: boolean;
  mode: ChartMode;
  height?: number;
  showLegend?: boolean;
  minimal?: boolean;
}

export function HeroChart({ data, dark, mode, height = 360, showLegend = true, minimal = false }: HeroChartProps) {
  const t = chartTheme(dark);
  const money = mode === 'Value' && !minimal;
  const firstMeaningfulTwr = data.perf.twr.findIndex((p) => Math.abs(p.twr) > 0.001);
  const minimalTwr = firstMeaningfulTwr > -1 ? data.perf.twr.slice(firstMeaningfulTwr) : data.perf.twr;

  const series =
    minimal
      ? [{ name: 'Performance', data: minimalTwr.map((p) => ({ x: p.date, y: p.twr })) }]
      :
    mode === 'Value'
      ? [
          { name: 'Portfolio', data: data.perf.series.map((p) => ({ x: p.date, y: p.portfolio_value })) },
          { name: 'Deposits',  data: data.perf.series.map((p) => ({ x: p.date, y: p.contributions })) },
          ...(data.perf.benchmark
            ? [{ name: data.perf.benchmark.name, data: data.perf.benchmark.series.map((p) => ({ x: p.date, y: p.value })) }]
            : []),
        ]
      : mode === 'TWR'
        ? [{ name: 'TWR %',      data: data.perf.twr.map((p) => ({ x: p.date, y: p.twr })) }]
        : [{ name: 'Drawdown %', data: data.perf.drawdown.map((p) => ({ x: p.date, y: p.drawdown })) }];

  return (
    <Chart
      type="area"
      height={height}
      series={series}
      options={{
        ...t,
        colors: ['#6ee787', '#64748b', '#f59e0b'],
        grid: minimal ? { show: false } : t.grid,
        stroke: { curve: 'smooth', width: minimal ? [3, 0, 0] : [3, 2, 2] },
        fill: { type: 'gradient', gradient: { opacityFrom: minimal ? 0.08 : 0.25, opacityTo: 0 } },
        xaxis: minimal ? { type: 'datetime', labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false }, tooltip: { enabled: false } } : { type: 'datetime' },
        yaxis: minimal ? { show: false } : { labels: { formatter: (v) => money ? fmtEUR(v) : pct(v, 2) } },
        tooltip: { ...t.tooltip, x: { format: 'dd MMM yyyy' }, y: { formatter: (v) => money ? fmtEUR(v) : pct(v, 2) } },
        dataLabels: { enabled: false },
        legend: { show: showLegend, position: 'top', horizontalAlign: 'right', labels: { colors: dark ? '#cbd5e1' : '#475569' } },
      }}
    />
  );
}
