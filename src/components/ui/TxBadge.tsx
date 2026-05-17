export function TxBadge({ type }: { type: string }) {
  const t = type.toUpperCase();
  const style =
    t === 'BUY'                               ? 'bg-blue-500/10 text-blue-400' :
    t === 'SELL'                              ? 'bg-emerald-500/10 text-emerald-400' :
    t === 'DIVIDEND'                          ? 'bg-amber-500/10 text-amber-400' :
    t.includes('INTEREST')                    ? 'bg-purple-500/10 text-purple-400' :
    t === 'STOCK_PERK'                        ? 'bg-teal-500/10 text-teal-400' :
    t.includes('FEE') || t.includes('TAX')   ? 'bg-rose-500/10 text-rose-400' :
                                               'bg-slate-500/10 text-slate-400';
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs font-black tracking-wide ${style}`}>{type}</span>
  );
}
