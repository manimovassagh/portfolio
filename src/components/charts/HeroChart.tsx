import Chart from 'react-apexcharts';
import { chartTheme } from '../../lib/chart';
import { fmtEUR, pct } from '../../lib/format';
import type { ChartMode, DashboardData } from '../../types';

interface HeroChartProps {
  data: DashboardData;
  dark: boolean;
  mode: ChartMode;
}

export function HeroChart({ data, dark, mode }: HeroChartProps) {
  const t = chartTheme(dark);
  const money = mode === 'Value';

  const series =
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
      height={360}
      series={series}
      options={{
        ...t,
        colors: ['#10b981', '#6366f1', '#f59e0b'],
        stroke: { curve: 'smooth', width: [3, 2, 2] },
        fill: { type: 'gradient', gradient: { opacityFrom: 0.25, opacityTo: 0 } },
        xaxis: { type: 'datetime' },
        yaxis: { labels: { formatter: (v) => money ? fmtEUR(v) : pct(v, 2) } },
        tooltip: { x: { format: 'dd MMM yyyy' }, y: { formatter: (v) => money ? fmtEUR(v) : pct(v, 2) } },
        dataLabels: { enabled: false },
        legend: { position: 'top', horizontalAlign: 'right', labels: { colors: dark ? '#cbd5e1' : '#475569' } },
      }}
    />
  );
}
