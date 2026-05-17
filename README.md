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
- **Analytics** — monthly returns, annual P&L, allocation, and unrealized P&L over time.
- **Holdings** — current holdings with shares, avg cost, market value, unrealized P&L.
- **Cash flow** — cash balance area chart + inflow/outflow waterfall.
- **Income** — dividends, interest, stock perks log.
- **Realized P&L** — closed trades with per-trade P&L.
- **Tax** — Vorabpauschale, withholding tax, capital gains tax (German tax view).
- **Asset modal** — per-asset transaction history.

## Adding a new asset

If the dashboard can't find a price for an ISIN, it'll show a warning in the **Positions** tab. Two options:

1. **Auto-discovery** — the app already tries Yahoo's search endpoint. New tickers are cached to `cache/isin_to_ticker.json`.
2. **Manual mapping** — edit `KNOWN_TICKERS` in `portfolio/prices.py` to force a specific Yahoo ticker.

Currency handling: USD-denominated tickers are FX-converted to EUR automatically using `USDEUR=X`.

## File layout

```
portfolio/
├── api.py                    # FastAPI backend
├── src/                      # React + TypeScript frontend
├── templates/index.html      # React mount page
├── static/dist/              # Built frontend assets
├── pyproject.toml
├── package.json
├── portfolio/
│   ├── loader.py             # CSV → DataFrame
│   ├── positions.py          # Holdings & realized P&L (avg-cost basis)
│   ├── cash.py               # Cash flow & income
│   ├── prices.py             # Live prices via yfinance, FX-adjusted
│   └── performance.py        # Daily portfolio value vs contributions
├── exports/                  # Drop CSVs here
└── cache/                    # Price + ticker cache
```
