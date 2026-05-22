import { useState } from 'react';
import { Target } from 'lucide-react';
import { Card } from '../ui/Card';
import { PanelTitle } from '../ui/PanelTitle';
import { ProgressBar } from '../ui/ProgressBar';
import { fmtEUR } from '../../lib/format';
import type { DashboardData } from '../../types';

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';
const labelCls = 'mb-1.5 block text-xs font-extrabold uppercase tracking-wide text-slate-500';

function yearsToGoal(target: number, current: number, rate: number, monthly: number): number | null {
  if (target <= current) return 0;
  if (rate <= 0 && monthly <= 0) return null;
  let balance = current;
  for (let year = 1; year <= 100; year++) {
    balance = balance * (1 + rate) + monthly * 12;
    if (balance >= target) return year;
  }
  return null;
}

export function GoalsView({ data }: { data: DashboardData }) {
  const pv   = data.summary.portfolio_value;
  const xirr = data.summary.xirr;

  const [targetValue,    setTargetValue]    = useState<number>(() => Number(localStorage.getItem('goal_target')   || 0));
  const [annualExpenses, setAnnualExpenses] = useState<number>(() => Number(localStorage.getItem('goal_expenses') || 0));
  const [monthlyContrib, setMonthlyContrib] = useState<number>(() => Number(localStorage.getItem('goal_monthly')  || 0));
  const [planningRate,   setPlanningRate]   = useState<number>(() => Number(localStorage.getItem('goal_rate')     || 0.07));

  const save = (key: string, val: number) => localStorage.setItem(key, String(val));

  const fireNumber  = annualExpenses > 0 ? annualExpenses * 25 : null;
  const firePct     = fireNumber ? (pv / fireNumber) * 100 : null;
  const customPct   = targetValue > 0 ? (pv / targetValue) * 100 : null;
  const yearsToFire   = fireNumber  ? yearsToGoal(fireNumber,  pv, planningRate, monthlyContrib) : null;
  const yearsToCustom = targetValue > 0 ? yearsToGoal(targetValue, pv, planningRate, monthlyContrib) : null;

  return (
    <section className="space-y-6">
      <Card className="p-6">
        <PanelTitle title="Your inputs" subtitle="Saved automatically to this browser" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={labelCls}>Target portfolio (€)</label>
            <input type="number" min={0} value={targetValue || ''} placeholder="e.g. 500000" className={inputCls}
              onChange={(e) => { const v = Number(e.target.value); setTargetValue(v); save('goal_target', v); }} />
          </div>
          <div>
            <label className={labelCls}>Annual expenses (€)</label>
            <input type="number" min={0} value={annualExpenses || ''} placeholder="e.g. 30000" className={inputCls}
              onChange={(e) => { const v = Number(e.target.value); setAnnualExpenses(v); save('goal_expenses', v); }} />
          </div>
          <div>
            <label className={labelCls}>Monthly contribution (€)</label>
            <input type="number" min={0} value={monthlyContrib || ''} placeholder="e.g. 1000" className={inputCls}
              onChange={(e) => { const v = Number(e.target.value); setMonthlyContrib(v); save('goal_monthly', v); }} />
          </div>
          <div>
            <label className={labelCls}>Planning rate (% / yr)</label>
            <input type="number" min={0} max={50} step={0.1} value={(planningRate * 100).toFixed(1)} className={inputCls}
              onChange={(e) => { const v = Number(e.target.value) / 100; setPlanningRate(v); save('goal_rate', v); }} />
            {xirr != null && (
              <p className="mt-1 text-xs text-slate-400">Historical XIRR: {(xirr * 100).toFixed(1)}% — use conservatively</p>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="p-6">
          <div className="mb-1 flex items-center gap-2">
            <Target size={18} className="text-emerald-500" />
            <h2 className="text-base font-black">FIRE goal</h2>
          </div>
          <p className="mb-4 text-sm text-slate-500">25× annual expenses · 4% withdrawal rule</p>
          {fireNumber ? (
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <div className="num text-3xl font-black text-slate-900 dark:text-white">{fmtEUR(pv)}</div>
                  <div className="text-sm text-slate-400">of {fmtEUR(fireNumber)} FIRE number</div>
                </div>
                <div className={`num text-2xl font-black ${(firePct || 0) >= 100 ? 'text-emerald-500' : 'text-amber-500'}`}>{firePct?.toFixed(1)}%</div>
              </div>
              <ProgressBar pct={firePct || 0} color={(firePct || 0) >= 100 ? 'bg-emerald-500' : 'bg-amber-400'} />
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><div className="text-xs font-bold text-slate-400">Still needed</div><div className="num mt-1 text-sm font-black text-rose-500">{fmtEUR(Math.max(0, fireNumber - pv))}</div></div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><div className="text-xs font-bold text-slate-400">Est. years</div><div className="num mt-1 text-sm font-black">{yearsToFire === 0 ? '🎉 Done' : yearsToFire ? `${yearsToFire} yr` : '> 100'}</div></div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><div className="text-xs font-bold text-slate-400">Monthly (4%)</div><div className="num mt-1 text-sm font-black text-emerald-500">{fmtEUR(annualExpenses / 12)}</div></div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Enter your annual expenses above to calculate your FIRE number.</p>
          )}
        </Card>

        <Card className="p-6">
          <div className="mb-1 flex items-center gap-2">
            <Target size={18} className="text-sky-500" />
            <h2 className="text-base font-black">Custom goal</h2>
          </div>
          <p className="mb-4 text-sm text-slate-500">Your own target portfolio value</p>
          {targetValue > 0 ? (
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <div>
                  <div className="num text-3xl font-black text-slate-900 dark:text-white">{fmtEUR(pv)}</div>
                  <div className="text-sm text-slate-400">of {fmtEUR(targetValue)} target</div>
                </div>
                <div className={`num text-2xl font-black ${(customPct || 0) >= 100 ? 'text-emerald-500' : 'text-sky-500'}`}>{customPct?.toFixed(1)}%</div>
              </div>
              <ProgressBar pct={customPct || 0} color={(customPct || 0) >= 100 ? 'bg-emerald-500' : 'bg-sky-500'} />
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><div className="text-xs font-bold text-slate-400">Still needed</div><div className="num mt-1 text-sm font-black text-rose-500">{fmtEUR(Math.max(0, targetValue - pv))}</div></div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><div className="text-xs font-bold text-slate-400">Est. years</div><div className="num mt-1 text-sm font-black">{yearsToCustom === 0 ? '🎉 Done' : yearsToCustom ? `${yearsToCustom} yr` : '> 100'}</div></div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Enter a target value above to track progress.</p>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <PanelTitle title="Growth projection" subtitle={`${(planningRate * 100).toFixed(1)}% annual return · €${monthlyContrib}/mo contributions`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                {['Year', 'Projected value', 'vs FIRE target', 'vs Custom goal'].map((h) => (
                  <th key={h} className="pb-3 text-left text-xs font-extrabold uppercase tracking-wide text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }, (_, i) => {
                const yr = i + 1;
                let bal = pv;
                for (let y = 0; y < yr; y++) bal = bal * (1 + planningRate) + monthlyContrib * 12;
                return (
                  <tr key={yr} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2.5 font-bold text-slate-500">+{yr}y</td>
                    <td className="py-2.5 num font-black">{fmtEUR(bal)}</td>
                    <td className="py-2.5">{fireNumber ? <span className={`num font-bold ${bal >= fireNumber ? 'text-emerald-500' : 'text-slate-400'}`}>{bal >= fireNumber ? '✓ reached' : `${fmtEUR(fireNumber - bal)} left`}</span> : <span className="text-slate-300">—</span>}</td>
                    <td className="py-2.5">{targetValue > 0 ? <span className={`num font-bold ${bal >= targetValue ? 'text-emerald-500' : 'text-slate-400'}`}>{bal >= targetValue ? '✓ reached' : `${fmtEUR(targetValue - bal)} left`}</span> : <span className="text-slate-300">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

