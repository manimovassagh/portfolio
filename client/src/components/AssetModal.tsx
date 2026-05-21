import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Card } from './ui/Card';
import { MiniStat } from './ui/MiniStat';
import { TxBadge } from './ui/TxBadge';
import { fmtEUR, signedEUR } from '../lib/format';
import type { AssetDetail } from '../types';

const TX_INFLOW = new Set(['SELL', 'DIVIDEND', 'INTEREST_PAYMENT', 'INTEREST', 'STOCK_PERK', 'ROUND_UP_REFUND', 'REFUND']);

interface AssetModalProps {
  asset: AssetDetail;
  onClose: () => void;
}

export function AssetModal({ asset, onClose }: AssetModalProps) {
  const [detailed, setDetailed] = useState(false);
  const [notes, setNotes] = useState(() => localStorage.getItem(`notes_${asset.isin}`) || '');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <Card
        className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-modal-title"
      >
        <div className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="asset-modal-title" className="text-lg font-black">{asset.name}</h2>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {asset.asset_class}
              </span>
            </div>
            <p className="num mt-1 text-sm text-slate-500">{asset.isin}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDetailed((v) => !v)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${detailed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'}`}
            >
              {detailed ? 'Simple' : 'Detailed'}
            </button>
            <button onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Close asset details">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-slate-200 p-5 text-sm md:grid-cols-4 dark:border-slate-800">
          <MiniStat label="Shares"  value={(asset.current.shares ?? 0).toFixed(4)} />
          <MiniStat label="Avg cost" value={fmtEUR(asset.current.avg_cost)} />
          <MiniStat label="Current"  value={fmtEUR(asset.current.current_price)} />
          <MiniStat label="P&L"      value={signedEUR(asset.current.unrealized)} />
        </div>

        <div className="overflow-auto">
          <table className="pro-table min-w-[680px]">
            <thead>
              <tr>
                <th>Date</th><th>Type</th><th>Shares</th><th>Price</th><th>Amount</th>
                {detailed && <><th>Fee</th><th>Tax</th><th>Note</th></>}
              </tr>
            </thead>
            <tbody>
              {asset.transactions.map((tx, idx) => {
                const inflow = TX_INFLOW.has((tx.type || '').toUpperCase());
                return (
                  <tr key={idx}>
                    <td className="text-slate-500">{tx.date}</td>
                    <td><TxBadge type={tx.type} /></td>
                    <td className="num text-right">{tx.shares?.toFixed(4) || '—'}</td>
                    <td className="num text-right">{fmtEUR(tx.price)}</td>
                    <td className={`num text-right font-bold ${inflow ? 'text-emerald-500' : ''}`}>
                      {tx.amount !== null ? `${inflow ? '+' : ''}${fmtEUR(Math.abs(tx.amount ?? 0))}` : '—'}
                    </td>
                    {detailed && (
                      <>
                        <td className="num text-right text-rose-400">{tx.fee ? fmtEUR(tx.fee) : '—'}</td>
                        <td className="num text-right text-rose-400">{tx.tax ? fmtEUR(tx.tax) : '—'}</td>
                        <td className="text-xs text-slate-500">{tx.description || '—'}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 p-5 dark:border-slate-800">
          <label className="block">
            <div className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-slate-500">Your notes</div>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={(e) => localStorage.setItem(`notes_${asset.isin}`, e.target.value)}
              placeholder="Add private notes about this position…"
              className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </label>
        </div>
      </Card>
    </div>
  );
}
