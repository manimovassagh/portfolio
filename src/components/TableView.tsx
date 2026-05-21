import { Card } from './ui/Card';
import { PanelHeader } from './ui/PanelTitle';
import { formatCell } from '../lib/format';

interface TableViewProps {
  title: string;
  subtitle: string;
  rows: Array<Record<string, unknown>>;
  columns: string[];
  emptyTitle?: string;
  emptyMessage?: string;
}

export function TableView({
  title,
  subtitle,
  rows,
  columns,
  emptyTitle = 'No rows yet',
  emptyMessage = 'There is no data for this table in the selected export.',
}: TableViewProps) {
  return (
    <section className="space-y-4">
      <PanelHeader title={title} subtitle={subtitle} />
      {rows.length === 0 ? (
        <Card className="p-8 text-center">
          <h3 className="text-base font-black text-slate-900 dark:text-white">{emptyTitle}</h3>
          <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-slate-500">{emptyMessage}</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="pro-table min-w-[820px]">
              <thead>
                <tr>{columns.map((col) => <th key={col}>{col.replaceAll('_', ' ')}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx}>
                    {columns.map((col) => (
                      <td key={col} className={typeof row[col] === 'number' ? 'num text-right' : ''}>
                        {formatCell(row[col])}
                      </td>
                    ))}
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
