# Kapital

> Self-hosted portfolio analytics for Trade Republic — live prices, allocation, performance, tax, and FIRE projections in one dark-mode dashboard.

The repo ships with `exports/sample-portfolio.csv` so you can run the app immediately without any private data.

---

## Screenshots

![Overview](docs/screenshot-overview.png)

| Analytics | Holdings |
|---|---|
| ![Analytics](docs/screenshot-analytics.png) | ![Holdings](docs/screenshot-holdings.png) |

| Tax & FSA tracker | Rebalance |
|---|---|
| ![Tax](docs/screenshot-tax.png) | ![Rebalance](docs/screenshot-rebalance.png) |

| Income | Goals / FIRE |
|---|---|
| ![Income](docs/screenshot-income.png) | ![Goals](docs/screenshot-goals.png) |

| Cash flow | Realized P&L |
|---|---|
| ![Cash flow](docs/screenshot-cashflow.png) | ![Realized P&L](docs/screenshot-realized.png) |

---

## What it does

Kapital parses your Trade Republic CSV export and gives you a live portfolio view with:

- **Live prices** via yfinance — refreshed on demand or every 60 s in the background
- **Market status badge** — shows whether EU / US markets are open or closed
- **Performance chart** with 1D / 1W / 1M / YTD / 1Y / Max range selector
- **Allocation** — donut + treemap position wall, switchable by type / positions / regions / sectors
- **Positions table** with per-range P&L (1D through Max)
- **Analytics** — Sharpe ratio, max drawdown, monthly returns heatmap, geographic exposure, TWR, XIRR
- **Tax** — Freistellungsauftrag (FSA) allowance tracker with breakdown by dividends, interest, stock perks, and realized gains
- **Income** — dividend and interest log with TTM yield per holding
- **Realized P&L** — closed-trade history with per-trade gain/loss
- **Rebalance** — enter target weights, see suggested buy/sell amounts
- **Goals / FIRE** — FIRE number calculator and 10-year growth projection
- **Watchlist** — persisted asset watchlist with target prices (SQLite)

---

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Python 3.12, FastAPI, pandas, yfinance |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, ApexCharts |
| Persistence | CSV exports + SQLite watchlist |
| Serving | uvicorn (local) · Nginx + Docker Compose (production) |
| Tooling | uv, npm, mkcert / openssl |

---

## Run locally

**Prerequisites:** Python 3.12+, Node 20+, [`uv`](https://github.com/astral-sh/uv)

```bash
npm install
uv sync
make run          # builds frontend, generates TLS cert, starts FastAPI
```

Open **`https://127.0.0.1:8765`** — the browser will warn about the self-signed cert on first run.

### Useful make targets

```bash
make dev          # same as run but with backend auto-reload
make stop         # kill whatever is listening on PORT (default 8765)
make frontend     # rebuild the Vite bundle only
make typecheck    # run tsc --noEmit
make cache        # wipe the yfinance price cache
make exports      # list CSV files in exports/
```

Override defaults:

```bash
PORT=9000 make run
PRICE_REFRESH_SECONDS=120 make run
```

---

## Run with Docker

```bash
docker compose up --build
```

| URL | |
|---|---|
| `http://localhost` | Redirects to HTTPS |
| `https://localhost` | Serves the app via Nginx |

**Volumes:**

| Mount | Purpose |
|---|---|
| `./exports` | Your CSV exports (mounted read-write) |
| `kapital-db` | Named volume for the SQLite watchlist |

---

## Import your data

1. In Trade Republic, open **Settings → Export → Transaction history** and download the CSV.
2. Drop the file into `exports/`, or use the **Import** button in the app header.
3. If multiple exports exist, pick one from the header dropdown.

The active export is stored in `localStorage` — it is never appended to the URL.

---

## Prices

Prices are fetched from Yahoo Finance via `yfinance`, cached in memory, and converted to EUR where needed.

- Automatic background refresh every 60 s while the browser tab is active
- Manual **Refresh** button forces a live fetch bypassing the cache
- `cache/` holds ISIN→ticker mappings (runtime state, git-ignored)
- Set `PRICE_REFRESH_SECONDS=N` to change the in-memory TTL

---

## Project layout

```
api.py                  FastAPI entry point + SPA fallback (Cache-Control: no-store on index.html)
app/
  deps.py               In-memory state cache, shared across requests
  routers/
    portfolio.py        summary, holdings, performance, position_returns, tax, asset detail
    analytics.py        analytics, geographic, FSA, dividend calendar
    core.py             exports, upload, refresh_prices
    watchlist.py        CRUD watchlist (SQLite)
  schemas.py            Pydantic response models
portfolio/
  cash.py               Deposit/withdrawal parsing, income log, cash balance
  holdings.py           Position and cost-basis calculation
  performance.py        TWR, drawdown, benchmark series
  prices.py             yfinance fetcher, ISIN→ticker mapping, EUR conversion
  returns.py            XIRR, Sharpe, best/worst days
  db.py                 SQLite watchlist schema
src/                    React + TypeScript frontend (Vite)
  App.tsx               Shell, routing, live-refresh loop, market status
  api.ts                Typed fetch wrappers for all endpoints
  components/
    views/              One file per section (Overview, Analytics, Holdings, …)
    charts/             HeroChart (ApexCharts wrapper)
    ui/                 Card, Skeleton, ProgressBar, InfoModal, …
  lib/                  format.ts, chart.ts, sections.ts
exports/                CSV files — only sample-portfolio.csv is committed
nginx/                  Nginx config + Dockerfile for Docker Compose
```
