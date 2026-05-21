import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Card } from '../ui/Card';
import { PanelHeader } from '../ui/PanelTitle';
import { fmtEUR } from '../../lib/format';
import type { DashboardData } from '../../types';

const STORAGE_KEY = 'rebalance_targets';

export function RebalanceView({ data }: { data: DashboardData }) {
  const { totalMV } = data;
  const holdings = data.holdings.filter((h) => h.market_value !== null && h.market_value > 0);

  const [targets, setTargets] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, string>; }
    catch { return {}; }
  });

  const handleTargetChange = (isin: string, value: string) => {
    setTargets((prev) => {
      const next = { ...prev, [isin]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleReset = () => {
    setTargets({});
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between">
        <PanelHeader title="Rebalance" subtitle="Current vs target allocation — enter target weights to see suggested actions" />
        <button onClick={handleReset} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
          <RefreshCw size={16} /> Reset targets
        </button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="pro-table min-w-[820px]">
            <thead>
              <tr><th>Asset</th><th className="text-right">Current %</th><th className="text-right">Target %</th><th className="text-right">Diff</th><th className="text-right">Action</th></tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const currentPct = h.weight;
                const targetRaw  = targets[h.isin];
                const targetPct  = targetRaw !== undefined && targetRaw !== '' ? Number(targetRaw) : null;
                const diff       = targetPct !== null ? currentPct - targetPct : null;
                const absWithin  = diff !== null && Math.abs(diff) <= 1;
                const overweight = diff !== null && diff > 1;
                const underweight = diff !== null && diff < -1;
                const actionAmount = diff !== null && totalMV > 0 ? Math.abs(diff / 100) * totalMV : null;
                const diffColor   = absWithin ? 'text-emerald-500' : overweight ? 'text-amber-500' : underweight ? 'text-sky-500' : 'text-slate-400';

                return (
                  <tr key={h.isin}>
                    <td><div className="font-bold">{h.name}</div><div className="num text-xs text-slate-500">{h.isin}</div></td>
                    <td className="num text-right font-bold">{currentPct.toFixed(1)}%</td>
                    <td className="text-right">
                      <input
                        type="number" min="0" max="100" step="0.1" placeholder="—"
                        value={targets[h.isin] ?? ''}
                        onChange={(e) => handleTargetChange(h.isin, e.target.value)}
                        className="w-20 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-right text-sm font-bold text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </td>
                    <td className={`num text-right font-black ${diffColor}`}>
                      {diff !== null ? `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}%` : '—'}
                    </td>
                    <td className={`num text-right font-bold ${diffColor}`}>
                      {diff === null ? '—' : absWithin ? 'On target' : overweight ? `Sell ${fmtEUR(actionAmount)}` : `Buy ${fmtEUR(actionAmount)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-500">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-amber-500" />Overweight (&gt;1% above target)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-sky-500" />Underweight (&gt;1% below target)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />On target (within ±1%)</span>
      </div>
    </section>
  );
}
