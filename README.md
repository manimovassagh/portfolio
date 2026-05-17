# Kapital Portfolio Dashboard

Local FastAPI + React dashboard for portfolio CSV exports. The repo ships with a synthetic demo export in `exports/sample-portfolio.csv` for screenshots and videos.

## Run

```bash
npm install
npm run build
uv run uvicorn api:app --port 8765
```

Opens at <http://127.0.0.1:8765>.

## How to use

1. Export transactions from the Trade Republic app: **Profile → Documents → Transaction history → Export**.
2. Drop the CSV into `exports/`, or use the dashboard import control.
3. Open the dashboard. The newest export is selected by default; old exports stay available in the file selector.

## Tabs

- **Overview** — headline numbers, rolling returns, performance chart, and movers.
- **Analytics** — monthly returns, annual P&L, allocation, geographic exposure, unrealized P&L over time.
- **Holdings** — current holdings with shares, avg cost, market value, unrealized P&L, TTM yield.
- **Cash flow** — cash balance area chart + inflow/outflow waterfall.
- **Income** — dividends, interest, stock perks log + dividend calendar.
- **Realized P&L** — closed trades with per-trade P&L.
- **Tax** — Vorabpauschale, withholding tax, capital gains tax; FSA (Freistellungsauftrag) tracker.
- **Watchlist** — track assets with target prices; persisted in SQLite.
- **Rebalance** — enter target weights, see buy/sell actions needed.
- **Goals / FIRE** — FIRE number calculator, custom goal tracker, 10-year projection.
- **Asset modal** — per-asset transaction history with position notes.

## Adding a new asset

If the dashboard can't find a price for an ISIN, it'll show a warning in the **Positions** tab. Two options:

1. **Auto-discovery** — the app already tries Yahoo's search endpoint. New tickers are cached to `cache/isin_to_ticker.json`.
2. **Manual mapping** — edit `KNOWN_TICKERS` in `portfolio/prices.py` to force a specific Yahoo ticker.

Currency handling: USD-denominated tickers are FX-converted to EUR automatically using `USDEUR=X`.

## File layout

```
├── api.py                    # FastAPI entry point (20 lines)
├── app/
│   ├── deps.py               # Shared state cache + helpers
│   ├── schemas.py            # Pydantic response models
│   └── routers/
│       ├── core.py           # SPA index, export listing, CSV upload
│       ├── portfolio.py      # Summary, holdings, performance, income…
│       ├── analytics.py      # Analytics, geographic, FSA, dividends
│       └── watchlist.py      # Watchlist CRUD
├── portfolio/                # Pure data layer
│   ├── loader.py             # CSV → DataFrame
│   ├── positions.py          # Holdings & realized P&L (avg-cost basis)
│   ├── cash.py               # Cash flow & income
│   ├── prices.py             # Live prices via yfinance, FX-adjusted
│   ├── performance.py        # Daily portfolio value vs contributions
│   ├── returns.py            # TWR, XIRR, Sharpe, drawdown
│   ├── benchmark.py          # Benchmark comparison
│   └── db.py                 # SQLite persistence (watchlist)
├── src/                      # React + TypeScript frontend
│   ├── App.tsx               # Root: state, layout, routing
│   ├── lib/                  # Pure utilities (format, chart theme)
│   └── components/
│       ├── ui/               # Card, MetricCard, InfoModal, …
│       ├── charts/           # HeroChart, AllocationTreemap
│       └── views/            # One file per tab
├── index.html                # Vite entry point
├── exports/                  # Drop CSVs here
└── portfolio.db              # SQLite database (watchlist)
```
