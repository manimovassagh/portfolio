export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div>
      <div className="num mt-1 font-black">{value}</div>
    </div>
  );
}
