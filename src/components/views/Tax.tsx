import { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { PanelTitle } from '../ui/PanelTitle';
import { ProgressBar } from '../ui/ProgressBar';
import { TableView } from '../TableView';
import { fmtEUR } from '../../lib/format';
import { fetchFsa } from '../../api';
import type { DashboardData, ExportName, FsaData } from '../../types';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

interface TaxViewProps {
  data: DashboardData;
  exportName: ExportName;
}

export function TaxView({ data, exportName }: TaxViewProps) {
  const [fsa, setFsa] = useState<FsaData | null>(null);
  const [joint, setJoint] = useState(() => localStorage.getItem('fsa_joint') === 'true');

  useEffect(() => {
    fetchFsa(exportName, joint).catch(() => null).then((d) => { if (d) setFsa(d); });
  }, [exportName, joint]);

  const usedPct = fsa ? (fsa.used / fsa.limit) * 100 : 0;
  const isWithinAllowance = fsa ? fsa.used <= fsa.limit : true;
  const taxableExcess = fsa ? Math.max(0, fsa.used - fsa.limit) : 0;
  const barColor = isWithinAllowance ? 'bg-emerald-500' : 'bg-rose-500';
  const textColor = isWithinAllowance ? 'text-emerald-500' : 'text-rose-500';
  const StatusIcon = isWithinAllowance ? ShieldCheck : AlertTriangle;

  return (
    <section className="space-y-6">
      {fsa && (
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <PanelTitle title={`FSA tracker — ${fsa.year}`} subtitle="Annual tax-free savings allowance usage" />
            <button
              onClick={() => { const v = !joint; setJoint(v); localStorage.setItem('fsa_joint', String(v)); }}
              className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-black transition ${joint ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800'}`}
            >
              {joint ? 'Joint filing (€2,000)' : 'Single filing (€1,000)'}
            </button>
          </div>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <div className={`num text-3xl font-black ${textColor}`}>{fmtEUR(fsa.used)}</div>
              <div className="mt-1 text-sm font-semibold text-slate-500">of {fmtEUR(fsa.limit)} limit · {fmtEUR(fsa.remaining)} remaining</div>
            </div>
            <div className={`num text-2xl font-black ${textColor}`}>{usedPct.toFixed(1)}%</div>
          </div>
          <ProgressBar pct={usedPct} color={barColor} />
          <div className={`mt-4 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm font-extrabold ${
            isWithinAllowance
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400'
          }`}>
            <div className="flex min-w-0 items-center gap-2">
              <StatusIcon size={18} className="shrink-0" />
              <span>{isWithinAllowance ? 'Safe: covered by the tax-free allowance' : 'Allowance exceeded'}</span>
            </div>
            <span className="num shrink-0">{isWithinAllowance ? `${fmtEUR(fsa.remaining)} buffer` : `${fmtEUR(taxableExcess)} excess`}</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Allowance used</div>
              <div className={`num mt-1 text-base font-black ${textColor}`}>{fmtEUR(fsa.used)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Taxable excess</div>
              <div className={`num mt-1 text-base font-black ${taxableExcess > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{fmtEUR(taxableExcess)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">Tax withheld in CSV</div>
              <div className="num mt-1 text-base font-black text-slate-700 dark:text-slate-200">{fmtEUR(data.summary.tax)}</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: 'Dividends',       value: fsa.breakdown.dividends },
              { label: 'Interest',        value: fsa.breakdown.interest },
              { label: 'Stock perks',     value: fsa.breakdown.stockperks },
              { label: 'Vorabpauschale',  value: fsa.breakdown.vorabpauschale },
              { label: 'Realized gains',  value: fsa.breakdown.realized_gains },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{item.label}</div>
                <div className="num mt-1 text-base font-black">{fmtEUR(item.value)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <TableView
        title="Tax"
        subtitle="Vorabpauschale and withholding tax records"
        rows={data.tax}
        columns={['Date', 'Type', 'Asset', 'Amount (EUR)', 'Tax (EUR)', 'Description']}
        emptyTitle="No tax records yet"
        emptyMessage="Withholding tax and Vorabpauschale entries will appear here once they exist in the selected export."
      />
    </section>
  );
}
