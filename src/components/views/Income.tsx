import { useEffect, useState } from 'react';
import { Card } from '../ui/Card';
import { PanelTitle } from '../ui/PanelTitle';
import { TableView } from '../TableView';
import { fmtEUR } from '../../lib/format';
import { fetchDividendCalendar } from '../../api';
import type { DashboardData, DividendCalendarData } from '../../types';

interface IncomeViewProps {
  data: DashboardData;
}

export function IncomeView({ data }: IncomeViewProps) {
  const [calendar, setCalendar] = useState<DividendCalendarData | null>(null);

  useEffect(() => {
    fetchDividendCalendar(data.summary.export).catch(() => null).then((d) => { if (d) setCalendar(d); });
  }, [data.summary.export]);

  const total = Object.values(data.incomeTotals).reduce((a, b) => a + b, 0);

  return (
    <section className="space-y-6">
      <TableView title="Income" subtitle={`Total ${fmtEUR(total)}`} rows={data.income} columns={['Date', 'Type', 'Asset', 'Amount (EUR)', 'Tax (EUR)']} />
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
