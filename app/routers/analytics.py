# pyright: reportGeneralTypeIssues=false
"""Analytics, geographic, FSA, and dividend-calendar routes."""
from __future__ import annotations

import pandas as pd
import yfinance as yf
from fastapi import APIRouter

from app.deps import get_state, to_float
from app.schemas import (
    CountryAllocation, DividendCalendarResponse, DividendEntry,
    FsaBreakdown, FsaResponse, GeographicResponse,
)
from portfolio import prices, returns

router = APIRouter()

_COUNTRY_NAMES: dict[str, str] = {
    "DE": "Germany",
    "US": "United States",
    "IE": "Ireland",
    "LU": "Luxembourg",
    "FR": "France",
    "GB": "United Kingdom",
    "NL": "Netherlands",
    "SE": "Sweden",
    "CH": "Switzerland",
    "JP": "Japan",
    "CN": "China",
    "KY": "Cayman Islands",
    "XS": "International",
    "QS": "International",
}

_FSA_LIMIT = 1000.0


@router.get("/api/analytics")
def get_analytics(export: str | None = None) -> dict:
    s = get_state(export)
    perf = s["perf"]
    holdings, live = s["holdings"], s["prices"]

    if perf.empty or "portfolio_value" not in perf.columns:
        return {
            "monthly": {}, "annual": [], "sharpe": None, "volatility": None,
            "max_dd_days": 0, "sectors": [], "pnl_series": [],
        }

    pv = perf["portfolio_value"].dropna()
    contrib = perf["contributions"] if "contributions" in perf.columns else None
    twr_series = returns.twr(pv, contrib) if contrib is not None else pv

    sectors: dict[str, float] = {}
    for h in holdings.values():
        cur = live.get(h.isin)
        mv = (cur * h.shares) if cur else h.cost_basis
        ac = h.asset_class or "Other"
        sectors[ac] = sectors.get(ac, 0) + mv

    pnl_series = []
    if contrib is not None:
        for ts in perf.index:
            pv_val = to_float(perf.loc[ts, "portfolio_value"])
            c_val = to_float(perf.loc[ts, "contributions"])
            if pv_val is not None and c_val is not None:
                pnl_series.append({"date": ts.strftime("%Y-%m-%d"), "pnl": round(pv_val - c_val, 2)})

    return {
        "monthly": returns.monthly_returns(twr_series),
        "annual": returns.annual_returns(pv),
        "sharpe": to_float(returns.sharpe_ratio(twr_series)),
        "volatility": to_float(returns.annualized_volatility(twr_series)),
        "max_dd_days": returns.max_drawdown_duration(pv),
        "sectors": [{"label": k, "value": to_float(v)} for k, v in sectors.items()],
        "pnl_series": pnl_series,
    }


@router.get("/api/geographic", response_model=GeographicResponse)
def get_geographic(export: str | None = None) -> GeographicResponse:
    s = get_state(export)
    holdings, live = s["holdings"], s["prices"]

    country_values: dict[str, float] = {}
    for isin, h in holdings.items():
        code = isin[:2].upper()
        price = live.get(isin)
        mv = (price * h.shares) if price else h.cost_basis
        country_values[code] = country_values.get(code, 0.0) + mv

    total = sum(country_values.values()) or 1.0
    rows = [
        CountryAllocation(
            code=code,
            name=_COUNTRY_NAMES.get(code, code),
            value=to_float(value),
            pct=to_float(value / total * 100),
        )
        for code, value in country_values.items()
    ]
    rows.sort(key=lambda c: -(c.value or 0))
    return GeographicResponse(countries=rows)


@router.get("/api/fsa", response_model=FsaResponse)
def get_fsa(export: str | None = None) -> FsaResponse:
    s = get_state(export)
    df, realized = s["df"], s["realized"]

    current_year = pd.Timestamp.now().year
    df_year = df[df["date"].dt.year == current_year]

    dividends = float(df_year[df_year["type"] == "DIVIDEND"]["amount"].sum() or 0.0)
    interest = float(
        df_year[df_year["type"].isin(["INTEREST_PAYMENT"])]["amount"].sum() or 0.0
    )
    stockperks = float(df_year[df_year["type"] == "STOCKPERK"]["amount"].sum() or 0.0)
    realized_gains = float(
        sum(r.pnl for r in realized if pd.Timestamp(r.date).year == current_year and r.pnl > 0)
    )

    used = dividends + interest + stockperks + realized_gains
    remaining = max(0.0, _FSA_LIMIT - used)

    return FsaResponse(
        year=current_year,
        limit=_FSA_LIMIT,
        used=to_float(used),
        remaining=to_float(remaining),
        breakdown=FsaBreakdown(
            dividends=to_float(dividends),
            interest=to_float(interest),
            stockperks=to_float(stockperks),
            realized_gains=to_float(realized_gains),
        ),
    )


@router.get("/api/dividend_calendar", response_model=DividendCalendarResponse)
def get_dividend_calendar(export: str | None = None) -> DividendCalendarResponse:
    s = get_state(export)
    holdings = s["holdings"]
    ticker_map = prices.resolve_tickers(list(holdings.keys()))

    upcoming: list[DividendEntry] = []
    for isin, h in holdings.items():
        ticker = ticker_map.get(isin)
        if not ticker:
            continue
        try:
            fi = yf.Ticker(ticker).fast_info
            last_div_value = fi.get("last_dividend_value") if hasattr(fi, "get") else getattr(fi, "last_dividend_value", None)
            last_div_date = fi.get("last_dividend_date") if hasattr(fi, "get") else getattr(fi, "last_dividend_date", None)

            if not last_div_value or last_div_value <= 0:
                continue

            date_str: str | None = None
            if last_div_date is not None:
                try:
                    date_str = pd.Timestamp(last_div_date).strftime("%Y-%m-%d")
                except Exception:
                    date_str = str(last_div_date)

            upcoming.append(DividendEntry(
                isin=isin,
                name=h.name,
                last_dividend_date=date_str,
                last_amount=to_float(last_div_value),
            ))
        except Exception:
            continue

    upcoming.sort(key=lambda x: x.last_dividend_date or "", reverse=True)
    return DividendCalendarResponse(upcoming=upcoming)
