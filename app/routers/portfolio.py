# pyright: reportGeneralTypeIssues=false
"""Portfolio data routes: summary, holdings, performance, cash, income, realized, tax, asset, sparklines."""
from __future__ import annotations

from datetime import date

import pandas as pd
from fastapi import APIRouter, HTTPException

from app.deps import get_state, serialize_dates, to_float
from portfolio import benchmark, cash, returns

router = APIRouter()


@router.get("/api/summary")
def get_summary(export: str | None = None) -> dict:
    s = get_state(export)
    holdings, summary, live, realized, df = (
        s["holdings"], s["summary"], s["prices"], s["realized"], s["df"]
    )

    market_value = sum(live.get(isin, 0) * h.shares for isin, h in holdings.items())
    cost_basis = sum(h.cost_basis for h in holdings.values())
    portfolio_value = market_value + summary.cash_balance
    unrealized = market_value - cost_basis
    realized_pnl = sum(r.pnl for r in realized)

    flows: list[tuple[date, float]] = []
    for _, row in df[df["type"].isin(cash.DEPOSIT_TYPES)].iterrows():
        if pd.notna(row["amount"]):
            flows.append((row["date"].date(), -float(row["amount"])))
    for _, row in df[df["type"].isin(cash.WITHDRAWAL_TYPES)].iterrows():
        if pd.notna(row["amount"]):
            flows.append((row["date"].date(), -float(row["amount"])))
    flows.append((date.today(), portfolio_value))
    flows.sort()

    total_return = (
        (portfolio_value - summary.net_deposits) / summary.net_deposits
        if summary.net_deposits else 0
    )

    trading = df[df["category"] == "TRADING"]
    first_trade = (
        trading["date"].min().strftime("%Y-%m-%d") if not trading.empty else None
    )

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
        "xirr": returns.xirr(flows),
        "dividends": summary.dividends,
        "interest": summary.interest,
        "stockperks": summary.stockperks,
        "fees": summary.fees,
        "tax": summary.tax,
        "n_holdings": len(holdings),
        "n_realized": len(realized),
        "holder_name": cash.holder_name(df),
        "first_trade_date": first_trade,
    }


@router.get("/api/holdings")
def get_holdings(export: str | None = None) -> dict:
    s = get_state(export)
    holdings, live, df = s["holdings"], s["prices"], s["df"]
    total_mv = sum(live.get(isin, 0) * h.shares for isin, h in holdings.items())

    ttm_cutoff = pd.Timestamp.now() - pd.DateOffset(years=1)
    ttm_divs: dict[str, float] = (
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
        rows.append({
            "isin": h.isin,
            "name": h.name,
            "asset_class": h.asset_class,
            "shares": h.shares,
            "avg_cost": h.avg_cost,
            "cost_basis": h.cost_basis,
            "current_price": cur,
            "market_value": market_value,
            "unrealized_pnl": unrealized,
            "unrealized_pct": (
                (unrealized / h.cost_basis * 100)
                if unrealized is not None and h.cost_basis else None
            ),
            "weight": (market_value / total_mv * 100) if market_value and total_mv else 0,
            "fees_paid": h.fees_paid,
            "ttm_dividend": to_float(ttm_div),
            "ttm_yield": to_float(ttm_div / market_value * 100) if market_value and ttm_div else None,
        })
    rows.sort(key=lambda r: -(r["market_value"] or 0))
    return {"holdings": rows, "total_market_value": total_mv}


@router.get("/api/performance")
def get_performance(export: str | None = None, include_benchmark: bool = True) -> dict:
    s = get_state(export)
    perf = s["perf"]
    if perf.empty:
        return {"series": [], "drawdown": [], "twr": [], "benchmark": None, "best_worst": {"best": [], "worst": []}}

    series = [
        {
            "date": ts.strftime("%Y-%m-%d"),
            "portfolio_value": to_float(perf.loc[ts, "portfolio_value"]) if "portfolio_value" in perf.columns else None,
            "contributions": to_float(perf.loc[ts, "contributions"]) if "contributions" in perf.columns else None,
            "holdings_value": to_float(perf.loc[ts, "holdings_value"]) if "holdings_value" in perf.columns else None,
        }
        for ts in perf.index
    ]

    pv = perf["portfolio_value"]
    contrib = perf["contributions"]
    dd = returns.drawdown(pv).fillna(0)
    twr_series = returns.twr(pv, contrib)

    drawdown_data = [
        {"date": ts.strftime("%Y-%m-%d"), "drawdown": to_float(dd.loc[ts] * 100) or 0.0}
        for ts in dd.index
    ]
    twr_data = [
        {"date": ts.strftime("%Y-%m-%d"), "twr": to_float((twr_series.loc[ts] - 1) * 100) or 0.0}
        for ts in twr_series.index
    ]

    bench_payload = None
    if include_benchmark:
        bench_ticker = next(iter(benchmark.BENCHMARKS.values()))
        bench_name = next(iter(benchmark.BENCHMARKS.keys()))
        bench_prices = benchmark.benchmark_series(bench_ticker, perf.index.min(), perf.index.max())
        if not bench_prices.empty:
            df = s["df"]
            deps_df = df[df["type"].isin(cash.DEPOSIT_TYPES + cash.WITHDRAWAL_TYPES)].copy()
            deps_df["day"] = deps_df["date"].dt.normalize()
            daily_deps = deps_df.groupby("day")["amount"].sum().reindex(perf.index, fill_value=0)
            hypo = benchmark.hypothetical_value(daily_deps, bench_prices)
            bench_payload = {
                "name": bench_name,
                "series": [
                    {"date": ts.strftime("%Y-%m-%d"), "value": to_float(hypo.loc[ts]) if ts in hypo.index else None}
                    for ts in perf.index
                ],
            }

    return {
        "series": series,
        "drawdown": drawdown_data,
        "twr": twr_data,
        "benchmark": bench_payload,
        "best_worst": returns.best_worst_days(pv, contrib),
    }


@router.get("/api/cash_flow")
def get_cash_flow(export: str | None = None) -> dict:
    s = get_state(export)
    summary = s["summary"]
    bal = cash.cash_balance_over_time(s["df"])
    return {
        "balance": [{"date": str(r["date"]), "cash": float(r["cash"])} for _, r in bal.iterrows()],
        "buckets": [
            {"label": "Deposits",    "value": summary.deposits},
            {"label": "Withdrawals", "value": -summary.withdrawals},
            {"label": "Dividends",   "value": summary.dividends},
            {"label": "Interest",    "value": summary.interest},
            {"label": "Stock perks", "value": summary.stockperks},
            {"label": "Fees",        "value": -summary.fees},
            {"label": "Tax",         "value": -summary.tax},
            {"label": "Net invested","value": -summary.invested},
        ],
    }


@router.get("/api/income")
def get_income(export: str | None = None) -> dict:
    s = get_state(export)
    log = cash.income_log(s["df"])
    return {
        "log": serialize_dates(log.to_dict(orient="records")),
        "totals": {
            "dividends": s["summary"].dividends,
            "interest": s["summary"].interest,
            "stockperks": s["summary"].stockperks,
        },
    }


@router.get("/api/realized")
def get_realized(export: str | None = None) -> dict:
    s = get_state(export)
    realized = s["realized"]
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
            for r in realized
        ],
        "total": sum(r.pnl for r in realized),
    }


@router.get("/api/tax")
def get_tax(export: str | None = None) -> dict:
    s = get_state(export)
    df = cash.tax_view(s["df"])
    return {"records": serialize_dates(df.to_dict(orient="records"))}


@router.get("/api/asset/{isin}")
def get_asset(isin: str, export: str | None = None) -> dict:
    s = get_state(export)
    df = s["df"]
    subset = df[df["symbol"] == isin].copy()
    if subset.empty:
        raise HTTPException(404, f"No transactions for ISIN {isin}")

    transactions = [
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
        for _, row in subset.iterrows()
    ]

    h = s["holdings"].get(isin)
    cur = s["prices"].get(isin)
    return {
        "isin": isin,
        "name": subset.iloc[0]["name"],
        "asset_class": subset.iloc[0]["asset_class"],
        "transactions": transactions,
        "current": {
            "shares": h.shares if h else 0,
            "avg_cost": h.avg_cost if h else 0,
            "cost_basis": h.cost_basis if h else 0,
            "current_price": cur,
            "market_value": (cur * h.shares) if (h and cur) else None,
            "unrealized": ((cur * h.shares) - h.cost_basis) if (h and cur) else None,
        },
    }


@router.get("/api/sparklines")
def get_sparklines(export: str | None = None) -> dict:
    s = get_state(export)
    return {"sparklines": s.get("spark_data", {})}
