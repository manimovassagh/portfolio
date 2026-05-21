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
      emptyTitle="No realized trades yet"
      emptyMessage="Closed positions and sell transactions will appear here once they exist in the selected export."
    />
  );
}
