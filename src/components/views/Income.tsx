import { Card } from '../ui/Card';
import { PanelHeader, PanelTitle } from '../ui/PanelTitle';
import { TableView } from '../TableView';
import { fmtEUR, formatCell } from '../../lib/format';
import { useDividendCalendarQuery } from '../../lib/queries';
import type { DashboardData } from '../../types';

interface IncomeViewProps {
  data: DashboardData;
}

export function IncomeView({ data }: IncomeViewProps) {
  const { data: calendar } = useDividendCalendarQuery(data.summary.export);

  const total = Object.values(data.incomeTotals).reduce((a, b) => a + b, 0);

  return (
    <section className="space-y-6">
      {/* Mobile card view for income */}
      <div className="sm:hidden space-y-3">
        <PanelHeader title="Income" subtitle={`Total ${fmtEUR(total)}`} />
        {data.income.length === 0 ? (
          <Card className="p-8 text-center">
            <h3 className="text-base font-black text-slate-900 dark:text-white">No income yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-slate-500">Dividend, interest, and stock perk transactions will appear here once they exist in the selected export.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {data.income.map((row, idx) => (
              <div key={idx} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-[#2b2b2b] dark:bg-[#1a1a1a]">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-semibold truncate">{formatCell(row['Asset'])}</span>
                  <span className="num shrink-0 font-black text-emerald-500">{formatCell(row['Amount (EUR)'])}</span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                  <span>{formatCell(row['Date'])}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 font-bold dark:bg-slate-800">{formatCell(row['Type'])}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Desktop table view for income */}
      <div className="hidden sm:block">
        <TableView
          title="Income"
          subtitle={`Total ${fmtEUR(total)}`}
          rows={data.income}
          columns={['Date', 'Type', 'Asset', 'Amount (EUR)', 'Tax (EUR)']}
          emptyTitle="No income yet"
          emptyMessage="Dividend, interest, and stock perk transactions will appear here once they exist in the selected export."
        />
      </div>

      {calendar && calendar.upcoming.length > 0 && (
        <Card className="p-5">
          <PanelTitle title="Dividend calendar" subtitle="Upcoming dividends based on last payment dates" />
          <div className="overflow-x-auto">
            <table className="pro-table min-w-[560px]">
              <thead><tr><th>Asset</th><th>Last dividend date</th><th>Last amount</th></tr></thead>
              <tbody>
                {calendar.upcoming.map((item) => (
                  <tr key={item.isin}>
                    <td><div className="font-bold">{item.name}</div><div className="num text-xs text-slate-500">{item.isin}</div></td>
                    <td className="text-slate-500">{item.last_dividend_date}</td>
                    <td className="num text-right font-bold text-emerald-500">{fmtEUR(item.last_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  );
}
