import { Card } from './ui/Card';
import { PanelHeader } from './ui/PanelTitle';
import { formatCell } from '../lib/format';

interface TableViewProps {
  title: string;
  subtitle: string;
  rows: Array<Record<string, unknown>>;
  columns: string[];
}

export function TableView({ title, subtitle, rows, columns }: TableViewProps) {
  return (
    <section className="space-y-4">
      <PanelHeader title={title} subtitle={subtitle} />
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
    </section>
  );
}
