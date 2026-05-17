import { Card } from './Card';

export function SkeletonDashboard() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="h-32 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
      ))}
    </div>
  );
}

export function EmptyState() {
  return (
    <Card className="p-8 text-center">
      <h2 className="text-lg font-black">No CSV export found</h2>
      <p className="mt-2 text-sm text-slate-500">Add a CSV file to exports/ or import one from the toolbar.</p>
    </Card>
  );
}
