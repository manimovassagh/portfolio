import { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { PanelTitle } from '../ui/PanelTitle';
import { ProgressBar } from '../ui/ProgressBar';
import { TableView } from '../TableView';
import { fmtEUR } from '../../lib/format';
import { fetchFsa } from '../../api';
import type { DashboardData, ExportName, FsaData } from '../../types';

interface TaxViewProps {
  data: DashboardData;
  exportName: ExportName;
}

export function TaxView({ data, exportName }: TaxViewProps) {
  const [fsa, setFsa] = useState<FsaData | null>(null);

  useEffect(() => {
    fetchFsa(exportName).catch(() => null).then((d) => { if (d) setFsa(d); });
  }, [exportName]);

  const usedPct = fsa ? (fsa.used / fsa.limit) * 100 : 0;
  const barColor  = usedPct > 80 ? 'bg-amber-500' : 'bg-emerald-500';
  const textColor = usedPct > 80 ? 'text-amber-500' : 'text-emerald-500';

  return (
    <section className="space-y-6">
      {fsa && (
        <Card className="p-5">
          <PanelTitle title={`FSA tracker — ${fsa.year}`} subtitle="Annual savings allowance usage" />
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <div className={`num text-3xl font-black ${textColor}`}>{fmtEUR(fsa.used)}</div>
              <div className="mt-1 text-sm font-semibold text-slate-500">of {fmtEUR(fsa.limit)} limit · {fmtEUR(fsa.remaining)} remaining</div>
            </div>
            <div className={`num text-2xl font-black ${textColor}`}>{usedPct.toFixed(1)}%</div>
          </div>
          <ProgressBar pct={usedPct} color={barColor} />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Dividends',      value: fsa.breakdown.dividends },
              { label: 'Interest',       value: fsa.breakdown.interest },
              { label: 'Stock perks',    value: fsa.breakdown.stockperks },
              { label: 'Realized gains', value: fsa.breakdown.realized_gains },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{item.label}</div>
                <div className="num mt-1 text-base font-black">{fmtEUR(item.value)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      <TableView title="Tax" subtitle="Vorabpauschale and withholding tax records" rows={data.tax} columns={['Date', 'Type', 'Asset', 'Amount (EUR)', 'Tax (EUR)']} />
    </section>
  );
}
