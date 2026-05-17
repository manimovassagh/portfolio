import type { DashboardData } from '../types';

const euro = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
const euroCompact = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export function fmtEUR(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Math.abs(value) >= 10_000 ? euroCompact.format(value) : euro.format(value);
}

export function signedEUR(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value >= 0 ? '+' : ''}${fmtEUR(value)}`;
}

export function pct(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
}

export function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number')
    return Math.abs(value) > 100 || Number.isInteger(value)
      ? value.toLocaleString('en-GB', { maximumFractionDigits: 2 })
      : value.toFixed(2);
  return String(value);
}

export function rollingReturns(twr: DashboardData['perf']['twr']) {
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
