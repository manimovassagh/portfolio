# pyright: reportGeneralTypeIssues=false
"""FastAPI backend.

JSON endpoints reuse the existing `portfolio/` data layer. The frontend is a
single Jinja2-rendered page powered by Tailwind + Alpine.js + ApexCharts.

Run with:  uv run uvicorn api:app --reload --port 8000
"""
from __future__ import annotations

import math
import os
from datetime import date, datetime
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from portfolio import benchmark, cash, loader, performance, positions, prices, returns


def _f(v):
    """Convert to JSON-safe float: NaN/Inf → None."""
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return f

BASE_DIR = Path(__file__).resolve().parent
app = FastAPI(title="Trade Republic Portfolio")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
templates = Jinja2Templates(directory=BASE_DIR / "templates")


# ── Data cache: load CSV + prices once per export file ──────────────
_cache: dict[str, Any] = {}


def _state(export_name: str | None = None) -> dict[str, Any]:
    exports = loader.list_exports()
    if not exports:
        raise HTTPException(404, "No CSV files in exports/")
    if export_name:
        chosen = next((p for p in exports if p.name == export_name), None)
        if not chosen:
            raise HTTPException(404, f"Export {export_name} not found")
    else:
        chosen = exports[0]

    key = f"{chosen.name}-{chosen.stat().st_mtime}"
    if key in _cache:
        return _cache[key]

    df = loader.load(chosen)
    holdings, realized = positions.compute_holdings(df)
    isins = list(holdings.keys())
    live = prices.fetch_prices(isins)
    perf = performance.performance_series(df)
    summary = cash.summarize(df)

    # Sparklines: reuse the same price fetch, cache with everything else
    spark_end = pd.Timestamp.now().normalize()
    spark_start = spark_end - pd.Timedelta(days=90)
    hist = performance._historical_prices(isins, spark_start, spark_end)
    spark_data: dict[str, list[float]] = {}
    if not hist.empty:
        for isin in isins:
            if isin in hist.columns:
                series = hist[isin].dropna().tolist()
                if series:
                    spark_data[isin] = [float(v) for v in series]

    _cache.clear()
    _cache[key] = {
        "export": chosen,
        "df": df,
        "holdings": holdings,
        "realized": realized,
        "prices": live,
        "perf": perf,
        "summary": summary,
        "spark_data": spark_data,
        "exports": [p.name for p in exports],
    }
    return _cache[key]


def _serialize_dates(records: list[dict]) -> list[dict]:
    for r in records:
        for k, v in list(r.items()):
            if isinstance(v, (pd.Timestamp, datetime, date)):
                r[k] = pd.Timestamp(v).strftime("%Y-%m-%d")
            elif pd.isna(v) if not isinstance(v, (list, dict, str)) else False:
                r[k] = None
    return records


# ── Routes ──────────────────────────────────────────────────────────
@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse(request, "index.html")


@app.get("/api/exports")
def list_export_files():
    return {"exports": [p.name for p in loader.list_exports()]}


_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


@app.post("/api/upload")
async def upload_export(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only CSV files are accepted")
    safe_name = os.path.basename(file.filename)
    if not safe_name or ".." in safe_name:
        raise HTTPException(400, "Invalid filename")
    content = await file.read()
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large (max 10 MB)")
    loader.EXPORTS_DIR.mkdir(exist_ok=True)
    (loader.EXPORTS_DIR / safe_name).write_bytes(content)
    _cache.clear()
    return {"filename": safe_name, "exports": [p.name for p in loader.list_exports()]}


@app.get("/api/analytics")
def get_analytics(export: str | None = None):
    s = _state(export)
    perf = s["perf"]
    holdings, live = s["holdings"], s["prices"]

    if perf.empty or "portfolio_value" not in perf.columns:
        return {"monthly": {}, "annual": [], "sharpe": None, "volatility": None,
                "max_dd_days": 0, "sectors": [], "pnl_series": []}

    pv = perf["portfolio_value"].dropna()
    contrib = perf["contributions"] if "contributions" in perf.columns else None

    # TWR series removes cash-flow distortion — use it for risk metrics
    twr_series = returns.twr(pv, contrib) if contrib is not None else pv

    # Sector breakdown by market value
    sectors: dict[str, float] = {}
    for h in holdings.values():
        cur = live.get(h.isin)
        mv = (cur * h.shares) if cur else h.cost_basis
        ac = h.asset_class or "Other"
        sectors[ac] = sectors.get(ac, 0) + mv

    # Unrealized P&L over time (market value - cumulative invested)
    pnl_series = []
    if contrib is not None:
        for ts in perf.index:
            pv_val = _f(perf.loc[ts, "portfolio_value"])
            c_val = _f(perf.loc[ts, "contributions"])
            if pv_val is not None and c_val is not None:
                pnl_series.append({"date": ts.strftime("%Y-%m-%d"), "pnl": round(pv_val - c_val, 2)})

    return {
        "monthly": returns.monthly_returns(twr_series),
        "annual": returns.annual_returns(pv),
        "sharpe": _f(returns.sharpe_ratio(twr_series)),
        "volatility": _f(returns.annualized_volatility(twr_series)),
        "max_dd_days": returns.max_drawdown_duration(pv),
        "sectors": [{"label": k, "value": _f(v)} for k, v in sectors.items()],
        "pnl_series": pnl_series,
    }


@app.get("/api/summary")
def get_summary(export: str | None = None):
    s = _state(export)
    holdings, summary, live, realized = s["holdings"], s["summary"], s["prices"], s["realized"]

    market_value = sum(live.get(isin, 0) * h.shares for isin, h in holdings.items())
    cost_basis = sum(h.cost_basis for h in holdings.values())
    portfolio_value = market_value + summary.cash_balance
    unrealized = market_value - cost_basis
    realized_pnl = sum(r.pnl for r in realized)

    # XIRR: every deposit out, every withdrawal in, current value as today's inflow
    df = s["df"]
    flows = []
    for _, row in df[df["type"].isin(cash.DEPOSIT_TYPES)].iterrows():
        if pd.notna(row["amount"]):
            flows.append((row["date"].date(), -float(row["amount"])))
    for _, row in df[df["type"].isin(cash.WITHDRAWAL_TYPES)].iterrows():
        if pd.notna(row["amount"]):
            flows.append((row["date"].date(), -float(row["amount"])))
    flows.append((date.today(), portfolio_value))
    flows.sort()
    xirr_value = returns.xirr(flows)

    # Total return %
    total_return = (portfolio_value - summary.net_deposits) / summary.net_deposits if summary.net_deposits else 0

    return {
        "export": s["export"].name,
        "portfolio_value": portfolio_value,
        "market_value": market_value,
        "cash_balance": summary.cash_balance,
        "cost_basis": cost_basis,
        "net_deposits": summary.net_deposits,
        "deposits": summary.deposits,
        "withdrawals": summary.withdrawals,
        "unrealized_pnl": unrealized,
        "unrealized_pct": (unrealized / cost_basis * 100) if cost_basis else 0,
        "realized_pnl": realized_pnl,
        "total_return": total_return,
        "xirr": xirr_value,
        "dividends": summary.dividends,
        "interest": summary.interest,
        "stockperks": summary.stockperks,
        "fees": summary.fees,
        "tax": summary.tax,
        "n_holdings": len(holdings),
        "n_realized": len(realized),
        "holder_name": cash.holder_name(df),
        "first_trade_date": df.loc[df["category"] == "TRADING", "date"].min().strftime("%Y-%m-%d")
        if not df[df["category"] == "TRADING"].empty
        else None,
    }


@app.get("/api/holdings")
def get_holdings(export: str | None = None):
    s = _state(export)
    holdings, live, df = s["holdings"], s["prices"], s["df"]
    total_mv = sum(live.get(isin, 0) * h.shares for isin, h in holdings.items())

    # TTM dividends per ISIN
    ttm_cutoff = pd.Timestamp.now() - pd.DateOffset(years=1)
    ttm_divs = (
        df[(df["type"] == "DIVIDEND") & (df["date"] >= ttm_cutoff)]
        .groupby("symbol")["amount"]
        .sum()
        .to_dict()
    )

    rows = []
    for h in holdings.values():
        cur = live.get(h.isin)
        market_value = (cur * h.shares) if cur else None
        unrealized = (market_value - h.cost_basis) if market_value is not None else None
        ttm_div = ttm_divs.get(h.isin, 0.0)
        rows.append(
            {
                "isin": h.isin,
                "name": h.name,
                "asset_class": h.asset_class,
                "shares": h.shares,
                "avg_cost": h.avg_cost,
                "cost_basis": h.cost_basis,
                "current_price": cur,
                "market_value": market_value,
                "unrealized_pnl": unrealized,
                "unrealized_pct": (unrealized / h.cost_basis * 100) if unrealized is not None and h.cost_basis else None,
                "weight": (market_value / total_mv * 100) if market_value and total_mv else 0,
                "fees_paid": h.fees_paid,
                "ttm_dividend": _f(ttm_div),
                "ttm_yield": _f(ttm_div / market_value * 100) if market_value and ttm_div else None,
            }
        )
    rows.sort(key=lambda r: -(r["market_value"] or 0))
    return {"holdings": rows, "total_market_value": total_mv}


@app.get("/api/performance")
def get_performance(export: str | None = None, include_benchmark: bool = True):
    s = _state(export)
    perf = s["perf"]
    if perf.empty:
        return {"series": [], "drawdown": [], "twr": [], "benchmark": None}

    series = [
        {
            "date": ts.strftime("%Y-%m-%d"),
            "portfolio_value": _f(perf.loc[ts, "portfolio_value"]) if "portfolio_value" in perf.columns else None,
            "contributions": _f(perf.loc[ts, "contributions"]) if "contributions" in perf.columns else None,
            "holdings_value": _f(perf.loc[ts, "holdings_value"]) if "holdings_value" in perf.columns else None,
        }
        for ts in perf.index
    ]

    pv = perf["portfolio_value"]
    contrib = perf["contributions"]
    dd = returns.drawdown(pv).fillna(0)
    twr_series = returns.twr(pv, contrib)

    drawdown_data = [{"date": ts.strftime("%Y-%m-%d"), "drawdown": _f(dd.loc[ts] * 100) or 0.0} for ts in dd.index]
    twr_data = [
        {"date": ts.strftime("%Y-%m-%d"), "twr": _f((twr_series.loc[ts] - 1) * 100) or 0.0}
        for ts in twr_series.index
    ]

    bench_payload = None
    if include_benchmark:
        bench_ticker = next(iter(benchmark.BENCHMARKS.values()))
        bench_name = next(iter(benchmark.BENCHMARKS.keys()))
        bench_prices = benchmark.benchmark_series(bench_ticker, perf.index.min(), perf.index.max())
        if not bench_prices.empty:
            # Daily contributions amount (positive deposit days)
            df = s["df"]
            deps = df[df["type"].isin(cash.DEPOSIT_TYPES + cash.WITHDRAWAL_TYPES)].copy()
            deps["day"] = deps["date"].dt.normalize()
            daily_deps = deps.groupby("day")["amount"].sum()
            daily_deps = daily_deps.reindex(perf.index, fill_value=0)
            hypo = benchmark.hypothetical_value(daily_deps, bench_prices)
            bench_payload = {
                "name": bench_name,
                "series": [
                    {"date": ts.strftime("%Y-%m-%d"), "value": _f(hypo.loc[ts]) if ts in hypo.index else None}
                    for ts in perf.index
                ],
            }

    return {
        "series": series,
        "drawdown": drawdown_data,
        "twr": twr_data,
        "benchmark": bench_payload,
        "best_worst": returns.best_worst_days(pv),
    }


@app.get("/api/cash_flow")
def get_cash_flow(export: str | None = None):
    s = _state(export)
    df = s["df"]
    summary = s["summary"]
    bal = cash.cash_balance_over_time(df)
    return {
        "balance": [{"date": str(r["date"]), "cash": float(r["cash"])} for _, r in bal.iterrows()],
        "buckets": [
            {"label": "Deposits", "value": summary.deposits},
            {"label": "Withdrawals", "value": -summary.withdrawals},
            {"label": "Dividends", "value": summary.dividends},
            {"label": "Interest", "value": summary.interest},
            {"label": "Stock perks", "value": summary.stockperks},
            {"label": "Fees", "value": -summary.fees},
            {"label": "Tax", "value": -summary.tax},
            {"label": "Net invested", "value": -summary.invested},
        ],
    }


@app.get("/api/income")
def get_income(export: str | None = None):
    s = _state(export)
    log = cash.income_log(s["df"])
    records = _serialize_dates(log.to_dict(orient="records"))
    return {"log": records, "totals": {
        "dividends": s["summary"].dividends,
        "interest": s["summary"].interest,
        "stockperks": s["summary"].stockperks,
    }}


@app.get("/api/realized")
def get_realized(export: str | None = None):
    s = _state(export)
    return {
        "realized": [
            {
                "date": pd.Timestamp(r.date).strftime("%Y-%m-%d") if pd.notna(r.date) else None,
                "name": r.name,
                "isin": r.isin,
                "shares": r.shares,
                "sell_price": r.sell_price,
                "avg_cost": r.avg_cost,
                "pnl": r.pnl,
                "pnl_pct": ((r.sell_price - r.avg_cost) / r.avg_cost * 100) if r.avg_cost else 0,
            }
            for r in s["realized"]
        ],
        "total": sum(r.pnl for r in s["realized"]),
    }


@app.get("/api/tax")
def get_tax(export: str | None = None):
    s = _state(export)
    df = cash.tax_view(s["df"])
    return {"records": _serialize_dates(df.to_dict(orient="records"))}


@app.get("/api/asset/{isin}")
def get_asset(isin: str, export: str | None = None):
    s = _state(export)
    df = s["df"]
    subset = df[df["symbol"] == isin].copy()
    if subset.empty:
        raise HTTPException(404, f"No transactions for ISIN {isin}")
    records = []
    for _, row in subset.iterrows():
        records.append(
            {
                "date": row["date"].strftime("%Y-%m-%d") if pd.notna(row["date"]) else None,
                "type": row["type"],
                "shares": float(row["shares"]) if pd.notna(row["shares"]) else None,
                "price": float(row["price"]) if pd.notna(row["price"]) else None,
                "amount": float(row["amount"]) if pd.notna(row["amount"]) else None,
                "fee": float(row["fee"]) if pd.notna(row["fee"]) else None,
                "tax": float(row["tax"]) if pd.notna(row["tax"]) else None,
                "description": row["description"],
            }
        )

    h = s["holdings"].get(isin)
    current = s["prices"].get(isin)
    return {
        "isin": isin,
        "name": subset.iloc[0]["name"],
        "asset_class": subset.iloc[0]["asset_class"],
        "transactions": records,
        "current": {
            "shares": h.shares if h else 0,
            "avg_cost": h.avg_cost if h else 0,
            "cost_basis": h.cost_basis if h else 0,
            "current_price": current,
            "market_value": (current * h.shares) if (h and current) else None,
            "unrealized": ((current * h.shares) - h.cost_basis) if (h and current) else None,
        },
    }


@app.get("/api/sparklines")
def get_sparklines(export: str | None = None):
    """Per-holding price sparkline for the last 90 days (pre-computed in cache)."""
    s = _state(export)
    return {"sparklines": s.get("spark_data", {})}
