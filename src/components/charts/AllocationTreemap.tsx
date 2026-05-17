import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { chartTheme, tileColor } from '../../lib/chart';
import { fmtEUR, pct, signedEUR } from '../../lib/format';
import { Card } from '../ui/Card';
import { PanelTitle } from '../ui/PanelTitle';
import type { DashboardData, Holding } from '../../types';

interface AllocationTreemapProps {
  data: DashboardData;
  dark: boolean;
  openAsset: (h: Holding) => void;
  compact?: boolean;
}

export function AllocationTreemap({ data, dark, openAsset, compact = false }: AllocationTreemapProps) {
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
