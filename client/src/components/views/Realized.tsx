import { TableView } from '../TableView';
import { signedEUR } from '../../lib/format';
import type { DashboardData } from '../../types';

export function RealizedView({ data }: { data: DashboardData }) {
  return (
    <TableView
      title="Realized P&L"
      subtitle={`Total ${signedEUR(data.realizedTotal)}`}
      rows={data.realized}
      columns={['date', 'name', 'shares', 'sell_price', 'avg_cost', 'pnl', 'pnl_pct']}
      emptyTitle="No realized gains yet"
      emptyMessage="Sell transactions will appear here once imported."
    />
  );
}
