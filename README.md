# Kapital

A self-hosted portfolio dashboard for Trade Republic CSV exports. It parses exported transactions, refreshes market prices, and shows portfolio value, allocation, positions, income, realized P&L, tax allowance usage, watchlist items, rebalancing, and long-term goals.

The repo includes `exports/sample-portfolio.csv`, so the app can run without private account data.

## Screenshots

| Overview | Analytics |
|---|---|
| ![Overview](docs/screenshot-overview.png) | ![Analytics](docs/screenshot-analytics.png) |

| Holdings | Tax |
|---|---|
| ![Holdings](docs/screenshot-holdings.png) | ![Tax](docs/screenshot-tax.png) |

| Income | Realized P&L |
|---|---|
| ![Income](docs/screenshot-income.png) | ![Realized P&L](docs/screenshot-realized.png) |

| Cash flow | Rebalance |
|---|---|
| ![Cash flow](docs/screenshot-cashflow.png) | ![Rebalance](docs/screenshot-rebalance.png) |

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Python 3.12, FastAPI, pandas, yfinance |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, ApexCharts |
| Persistence | CSV exports plus SQLite for the watchlist |
| Tooling | uv, npm, Docker Compose |

## Run Locally

Prerequisites: Python 3.12+, Node 20+, and `uv`.

```bash
npm install
uv sync
make run
```

Open `https://127.0.0.1:8765/overview`.

`make run` builds the frontend and starts FastAPI with the local TLS certificate in `certs/`. The direct command is:

```bash
uv run uvicorn api:app --host 0.0.0.0 --port 8765 --ssl-keyfile certs/key.pem --ssl-certfile certs/cert.pem
```

Useful targets:

```bash
make dev          # rebuild and run with backend reload
make typecheck    # TypeScript check
make frontend     # frontend build only
make cache        # clear live-price cache
make stop         # stop the process using PORT
```

## Run With Docker

```bash
docker compose up --build
```

| URL | Behavior |
|---|---|
| `http://localhost` | Redirects to HTTPS |
| `https://localhost` | Serves the app through Nginx |

Volumes:

| Mount | Purpose |
|---|---|
| `./exports` | Local CSV exports |
| `kapital-db` | SQLite watchlist database |

## Import Data

1. In Trade Republic, export the transaction history CSV.
2. Put the CSV in `exports/`, or use the app header's **Import** control.
3. Select the export from the header dropdown when multiple exports exist.

The selected export is stored locally in the browser. It is not exposed in the visible app route.

## Features

| View | What It Shows |
|---|---|
| Overview | Live portfolio value, allocation donut, allocation wall, range chart, positions, movers, quick stats |
| Analytics | Monthly returns, annual P&L, allocation, geographic exposure, drawdown and risk metrics |
| Holdings | Current positions, shares, average cost, market value, unrealized P&L, yield, concentration flags |
| Cash flow | Cash balance history and inflow/outflow breakdown |
| Income | Dividends, interest, stock perks, and dividend calendar |
| Realized P&L | Closed trades with per-trade gains and losses |
| Tax | Tax rows plus Freistellungsauftrag allowance tracker |
| Watchlist | Persisted watchlist items with target prices |
| Rebalance | Target weights and suggested buy/sell amounts |
| Goals / FIRE | FIRE calculator, custom goal tracker, and projection |

## Prices

Prices are fetched through `yfinance`, cached briefly, and converted to EUR where needed. The default live cache window is 60 seconds and can be changed with:

```bash
PRICE_REFRESH_SECONDS=120 make run
```

Ticker discovery results are cached under `cache/`. The cache is runtime state and is intentionally ignored by Git.

## Watchlist Database

The watchlist uses SQLite. Local runs create `portfolio.db` in the project root. Docker runs set `WATCHLIST_DB=db/portfolio.db`, which stores the database in the `kapital-db` named volume.

`portfolio.db` is runtime data and should not be committed.

## Project Layout

```text
api.py                  FastAPI entry point and SPA fallback
app/
  deps.py               Shared state cache and helpers
  routers/              API routes
portfolio/              CSV parsing, cash, holdings, prices, returns, SQLite watchlist
src/                    React and TypeScript frontend
exports/                CSV exports; sample data is committed
nginx/                  Docker HTTPS reverse proxy
```
