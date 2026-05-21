import { Card } from '../ui/Card';
import { PanelHeader } from '../ui/PanelTitle';
import { fmtEUR, signedEUR, pct } from '../../lib/format';
import type { DashboardData, Holding } from '../../types';

interface HoldingsViewProps {
  data: DashboardData;
  openAsset: (holding: Holding) => void;
}

export function HoldingsView({ data, openAsset }: HoldingsViewProps) {
  const hasConcentrated = data.holdings.some((h) => h.weight > 20);

  return (
    <section className="space-y-4">
      <PanelHeader title="Holdings" subtitle={`${data.holdings.length} open positions · ${fmtEUR(data.totalMV)} market value`} />
      {hasConcentrated && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-600 dark:text-amber-400">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
          Holdings above 20% of portfolio are flagged
        </div>
      )}
      {/* Mobile card view */}
      <div className="sm:hidden space-y-2">
        {data.holdings.map((h) => (
          <div
            key={h.isin}
            className="rounded-lg border border-slate-200 bg-white p-4 dark:border-[#2b2b2b] dark:bg-[#1a1a1a] cursor-pointer"
            onClick={() => openAsset(h)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openAsset(h);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={`Open details for ${h.name}`}
          >
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <div className="font-bold truncate">{h.name}</div>
                <div className="text-xs text-slate-500">{h.isin}</div>
              </div>
              <span className={`num shrink-0 font-black ${(h.unrealized_pnl || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{signedEUR(h.unrealized_pnl)}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-y-1.5 text-sm">
              <div className="text-slate-500">Shares</div>
              <div className="num text-right">{(h.shares ?? 0).toFixed(4)}</div>
              <div className="text-slate-500">Market value</div>
              <div className="num text-right font-bold">{fmtEUR(h.market_value)}</div>
              <div className="text-slate-500">P&amp;L %</div>
              <div className={`num text-right font-bold ${(h.unrealized_pct || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{pct(h.unrealized_pct)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table view */}
      <div className="hidden sm:block">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="pro-table min-w-[1100px]">
              <thead>
                <tr><th>Asset</th><th>Class</th><th>Shares</th><th>Avg cost</th><th>Price</th><th>Market value</th><th>P&L</th><th>P&L %</th><th>Yield</th><th>Weight</th></tr>
              </thead>
              <tbody>
                {data.holdings.map((h) => (
                  <tr
                    key={h.isin}
                    onClick={() => openAsset(h)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openAsset(h);
                      }
                    }}
                    className="cursor-pointer focus:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#45b9a8]/50 dark:focus:bg-slate-800/60"
                    tabIndex={0}
                    role="button"
                    aria-label={`Open details for ${h.name}`}
                  >
                    <td>
                      <div className="font-bold">{h.name}</div>
                      <div className="num text-xs text-slate-500">{h.isin}</div>
                    </td>
                    <td><span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{h.asset_class}</span></td>
                    <td className="num text-right">{(h.shares ?? 0).toFixed(4)}</td>
                    <td className="num text-right">{fmtEUR(h.avg_cost)}</td>
                    <td className="num text-right">{fmtEUR(h.current_price)}</td>
                    <td className="num text-right font-bold">{fmtEUR(h.market_value)}</td>
                    <td className={`num text-right font-black ${(h.unrealized_pnl || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{signedEUR(h.unrealized_pnl)}</td>
                    <td className={`num text-right font-bold ${(h.unrealized_pct || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{pct(h.unrealized_pct)}</td>
                    <td className="num text-right text-slate-500">{h.ttm_yield !== null ? `${h.ttm_yield.toFixed(2)}%` : '—'}</td>
                    <td className="num text-right">
                      <span className="inline-flex items-center gap-1.5">
                        {(h.weight ?? 0).toFixed(1)}%
                        {(h.weight ?? 0) > 20 && <span className="inline-block h-2 w-2 rounded-full bg-amber-500" title="Concentration warning: above 20% of portfolio" />}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </section>
  );
}
