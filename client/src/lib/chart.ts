import type { ApexOptions } from 'apexcharts';

export function chartTheme(dark: boolean): ApexOptions {
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

export function tileColor(unrealizedPct: number): string {
  if (unrealizedPct >= 5) return '#059669';
  if (unrealizedPct >= 0) return '#10b981';
  if (unrealizedPct >= -5) return '#fb7185';
  return '#e11d48';
}
