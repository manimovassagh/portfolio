import Chart from 'react-apexcharts';
import { Card } from '../ui/Card';
import { PanelTitle } from '../ui/PanelTitle';
import { chartTheme } from '../../lib/chart';
import { fmtEUR } from '../../lib/format';
import type { DashboardData } from '../../types';

interface CashViewProps {
  data: DashboardData;
  dark: boolean;
}

export function CashView({ data, dark }: CashViewProps) {
  const t = chartTheme(dark);

  return (
    <section className="grid gap-5 xl:grid-cols-3">
      <Card className="p-5 xl:col-span-2">
        <PanelTitle title="Cash balance over time" subtitle="Money sitting uninvested in the account" />
        <Chart
          type="area"
          height={320}
          series={[{ name: 'Cash', data: data.cashFlow.balance.map((p) => ({ x: p.date, y: p.cash })) }]}
          options={{ ...t, colors: ['#6366f1'], stroke: { curve: 'stepline', width: 2 }, xaxis: { type: 'datetime' }, yaxis: { labels: { formatter: (v) => fmtEUR(v) } }, dataLabels: { enabled: false } }}
        />
      </Card>
      <Card className="p-5">
        <PanelTitle title="Where money came and went" subtitle="Aggregate flows" />
        <Chart
          type="bar"
          height={320}
          series={[{ data: data.cashFlow.buckets.filter((b) => Math.abs(b.value) > 0.001).map((b) => ({ x: b.label, y: b.value, fillColor: b.value >= 0 ? '#10b981' : '#f43f5e' })) }]}
          options={{ ...t, plotOptions: { bar: { horizontal: true, borderRadius: 5, distributed: true } }, xaxis: { labels: { formatter: (v) => fmtEUR(Number(v)) } }, dataLabels: { enabled: false }, legend: { show: false } }}
        />
      </Card>
    </section>
  );
}
