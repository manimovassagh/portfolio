# 📈 Trade Republic Portfolio Dashboard

Local dashboard for Trade Republic CSV exports. Cost-basis math + live EUR prices from Yahoo Finance.

## Run

```bash
uv run streamlit run app.py
```

Opens at <http://localhost:8501>.

## How to use

1. Export transactions from the Trade Republic app: **Profile → Documents → Transaction history → Export**.
2. Drop the CSV into `exports/`. Newest export is selected by default; old ones stay around so you can switch between them.
3. Open the dashboard. Hit **🔄 Refresh prices** in the sidebar if you want fresh live quotes (otherwise cached for 15 min / 1 day on disk).

## Tabs

- **Overview** — pie charts by position and asset class, headline numbers.
- **Positions** — current holdings with shares, avg cost, market value, unrealized P&L.
- **Performance** — portfolio value vs cumulative deposits over time.
- **Cash flow** — cash balance area chart + inflow/outflow waterfall.
- **Income** — dividends, interest, stock perks log.
- **Realized P&L** — closed trades with per-trade P&L.
- **Tax** — Vorabpauschale, withholding tax, capital gains tax (German tax view).
- **Deep dive** — per-asset transaction history.

## Adding a new asset

If the dashboard can't find a price for an ISIN, it'll show a warning in the **Positions** tab. Two options:

1. **Auto-discovery** — the app already tries Yahoo's search endpoint. New tickers are cached to `cache/isin_to_ticker.json`.
2. **Manual mapping** — edit `KNOWN_TICKERS` in `portfolio/prices.py` to force a specific Yahoo ticker.

Currency handling: USD-denominated tickers are FX-converted to EUR automatically using `USDEUR=X`.

## File layout

```
portfolio/
├── app.py                    # Streamlit entry point
├── pyproject.toml
├── portfolio/
│   ├── loader.py             # CSV → DataFrame
│   ├── positions.py          # Holdings & realized P&L (avg-cost basis)
│   ├── cash.py               # Cash flow & income
│   ├── prices.py             # Live prices via yfinance, FX-adjusted
│   └── performance.py        # Daily portfolio value vs contributions
├── exports/                  # Drop CSVs here
└── cache/                    # Price + ticker cache
```
