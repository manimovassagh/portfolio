import type { ElementType } from 'react';
import { Card } from './Card';

type Tone = 'neutral' | 'gain' | 'loss' | 'warn';

interface MetricCardProps {
  label: string;
  value: string;
  detail: string;
  tone?: Tone;
  icon: ElementType;
  onClick?: () => void;
}

export function MetricCard({ label, value, detail, tone = 'neutral', icon: Icon, onClick }: MetricCardProps) {
  const color =
    tone === 'gain' ? 'text-emerald-500' :
    tone === 'loss' ? 'text-rose-500' :
    tone === 'warn' ? 'text-amber-500' :
    'text-slate-950 dark:text-white';

  const border =
    tone === 'gain' ? 'border-l-emerald-500' :
    tone === 'loss' ? 'border-l-rose-500' :
    tone === 'warn' ? 'border-l-amber-500' :
    'border-l-slate-300 dark:border-l-slate-700';

  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</div>
        <Icon size={18} className={onClick ? 'text-emerald-400' : 'text-slate-400'} />
      </div>
      <div className={`num mt-4 text-2xl font-black tracking-normal ${color}`}>{value}</div>
      <div className="mt-3 text-sm font-semibold text-slate-500">{detail}</div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={`min-h-[124px] w-full rounded-xl border border-l-4 border-slate-200 bg-white p-5 text-left shadow-sm transition hover:ring-2 hover:ring-emerald-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 dark:border-slate-800 dark:bg-slate-900 ${border}`}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <Card className={`min-h-[124px] border-l-4 ${border} p-5`}>
      {content}
    </Card>
  );
}
