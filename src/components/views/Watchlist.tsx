import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Star, X } from 'lucide-react';
import { Card } from '../ui/Card';
import { PanelHeader, PanelTitle } from '../ui/PanelTitle';
import { fmtEUR } from '../../lib/format';
import { addWatchlistItem, fetchWatchlist, removeWatchlistItem } from '../../api';
import type { ExportName, WatchlistData } from '../../types';

type WatchlistForm = { isin: string; ticker: string; name: string; notes: string; target_price: string };

const EMPTY_FORM: WatchlistForm = { isin: '', ticker: '', name: '', notes: '', target_price: '' };

export function WatchlistView({ exportName: _exportName }: { exportName: ExportName }) {
  const [watchlist, setWatchlist] = useState<WatchlistData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm]         = useState<WatchlistForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setWatchlist(await fetchWatchlist()); } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = await addWatchlistItem({
        isin: form.isin.trim(),
        ticker: form.ticker.trim(),
        name: form.name.trim(),
        notes: form.notes.trim(),
        target_price: form.target_price ? Number(form.target_price) : null,
      });
      setWatchlist(data);
      setForm(EMPTY_FORM);
      setFormOpen(false);
    } catch { /* silently fail */ }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (isin: string) => {
    try { setWatchlist(await removeWatchlistItem(isin)); } catch { /* silently fail */ }
  };

  const fields = [
    { key: 'isin',         label: 'ISIN',             placeholder: 'IE00B4L5Y983', required: true },
    { key: 'ticker',       label: 'Ticker',            placeholder: 'IWDA',         required: false },
    { key: 'name',         label: 'Name',              placeholder: 'iShares Core MSCI World', required: true },
    { key: 'target_price', label: 'Target price (€)',  placeholder: '120.00',       required: false },
    { key: 'notes',        label: 'Notes',             placeholder: 'Why watching…', required: false },
  ] as const;

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between">
        <PanelHeader title="Watchlist" subtitle="Stocks and funds you are monitoring" />
        <button onClick={() => setFormOpen((v) => !v)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
          <Star size={16} /> Add item
        </button>
      </div>

      {formOpen && (
        <Card className="p-5">
          <PanelTitle title="Add to watchlist" subtitle="Track a new asset" />
          <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {fields.map(({ key, label, placeholder, required }) => (
              <label key={key} className="block">
                <div className="mb-1 text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</div>
                <input
                  type={key === 'target_price' ? 'number' : 'text'}
                  step={key === 'target_price' ? '0.01' : undefined}
                  placeholder={placeholder}
                  required={required}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
                />
              </label>
            ))}
            <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-3">
              <button type="submit" disabled={submitting} className="inline-flex h-9 items-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50">
                {submitting ? 'Adding…' : 'Add'}
              </button>
              <button type="button" onClick={() => setFormOpen(false)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      {loading && <div className="h-32 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />}

      {!loading && watchlist?.items.length === 0 && (
        <Card className="p-8 text-center">
          <Star size={32} className="mx-auto text-slate-400" />
          <h3 className="mt-3 text-base font-black">Nothing on the watchlist</h3>
          <p className="mt-1 text-sm text-slate-500">Click "Add item" to start tracking assets.</p>
        </Card>
      )}

      {watchlist && watchlist.items.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="pro-table min-w-[900px]">
              <thead><tr><th>Asset</th><th>Ticker</th><th>Current price</th><th>Target price</th><th>Notes</th><th>Added</th><th /></tr></thead>
              <tbody>
                {watchlist.items.map((item) => {
                  const atTarget = item.target_price !== null && item.current_price !== null && item.current_price <= item.target_price;
                  return (
                    <tr key={item.isin}>
                      <td><div className="font-bold">{item.name}</div><div className="num text-xs text-slate-500">{item.isin}</div></td>
                      <td><span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{item.ticker || '—'}</span></td>
                      <td className="num text-right">{fmtEUR(item.current_price)}</td>
                      <td className={`num text-right font-bold ${atTarget ? 'text-emerald-500' : 'text-slate-500'}`}>{item.target_price !== null ? fmtEUR(item.target_price) : '—'}</td>
                      <td className="max-w-[200px] truncate text-sm text-slate-500">{item.notes || '—'}</td>
                      <td className="text-slate-500">{item.added_date}</td>
                      <td>
                        <button onClick={() => handleDelete(item.isin)} className="rounded p-1 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500" title="Remove">
                          <X size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </section>
  );
}
