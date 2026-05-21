# pyright: reportGeneralTypeIssues=false
# pyright: reportOptionalSubscript=false
# pyright: reportOptionalMemberAccess=false
# pyright: reportMissingImports=false
from __future__ import annotations

import logging
import math
from collections import defaultdict
from typing import Any

import pandas as pd
import yfinance as yf
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from pathlib import Path
from pydantic import BaseModel

from .hist_cache import download_cached
from .prices import fetch_prices, resolve_tickers

logger = logging.getLogger(__name__)
app = FastAPI(title="pricer", docs_url=None, redoc_url=None)


@app.get("/prices")
def get_prices(isins: str = Query(..., description="Comma-separated ISIN list")) -> dict[str, float]:
    isin_list = [i.strip() for i in isins.split(",") if i.strip()]
    try:
        return fetch_prices(isin_list)
    except Exception as exc:
        logger.exception("fetch_prices failed: %s", exc)
        raise HTTPException(status_code=503, detail="price fetch failed") from exc


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/readyz")
def readyz() -> JSONResponse:
    checks: dict[str, str] = {}
    try:
        Path("cache").mkdir(parents=True, exist_ok=True)
        (Path("cache") / ".probe").touch()
        checks["cache"] = "ok"
    except Exception as e:
        checks["cache"] = str(e)

    status = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    code = 200 if status == "ok" else 503
    return JSONResponse({"status": status, "checks": checks}, status_code=code)


@app.post("/cache/clear")
def cache_clear() -> dict[str, Any]:
    from .hist_cache import clear_hist_cache
    deleted = clear_hist_cache()
    return {"deleted": deleted}


@app.get("/search")
def search(q: str = Query(..., description="Search query")) -> dict[str, Any]:
    try:
        results = yf.Search(q, max_results=10).quotes
        out = []
        for r in (results or []):
            out.append({
                "ticker": r.get("symbol", ""),
                "name": r.get("longname") or r.get("shortname") or "",
                "type": r.get("quoteType", ""),
                "exchange": r.get("exchange", ""),
            })
        return {"results": out}
    except Exception as exc:
        logger.exception("search failed: %s", exc)
        return {"results": []}


@app.get("/quote")
def quote(ticker: str = Query(...)) -> dict[str, Any]:
    try:
        t = yf.Ticker(ticker)
        fi = t.fast_info
        info = t.info or {}

        def _f(v: Any) -> float | None:
            try:
                fv = float(v)
                import math
                return fv if math.isfinite(fv) else None
            except (TypeError, ValueError):
                return None

        price = _f(fi.get("lastPrice")) or _f(info.get("regularMarketPrice"))
        prev = _f(fi.get("previousClose")) or _f(info.get("previousClose"))
        change = (_f(price) - _f(prev)) if price is not None and prev is not None else None
        change_pct = (change / prev * 100) if change is not None and prev and prev != 0 else None

        return {
            "ticker": ticker,
            "price": price,
            "prev_close": prev,
            "change": change,
            "change_pct": change_pct,
            "day_high": _f(fi.get("dayHigh")),
            "day_low": _f(fi.get("dayLow")),
            "wk52_high": _f(fi.get("yearHigh")),
            "wk52_low": _f(fi.get("yearLow")),
            "market_cap": _f(fi.get("marketCap")),
            "currency": fi.get("currency"),
            "volume": _f(fi.get("shares3MonthAvgVol")),
        }
    except Exception as exc:
        logger.exception("quote failed: %s", exc)
        raise HTTPException(status_code=503, detail="quote fetch failed") from exc


_RANGE_MAP = {
    "1D": ("1d", "5m"),
    "1W": ("5d", "1h"),
    "1M": ("1mo", "1d"),
    "3M": ("3mo", "1d"),
    "6M": ("6mo", "1d"),
    "YTD": ("ytd", "1d"),
    "1Y": ("1y", "1d"),
    "5Y": ("5y", "1wk"),
}


@app.get("/history")
def history(
    ticker: str = Query(...),
    range: str = Query("1M"),
) -> dict[str, Any]:
    try:
        import math
        period, interval = _RANGE_MAP.get(range, ("1mo", "1d"))
        data = yf.Ticker(ticker).history(period=period, interval=interval, auto_adjust=True)
        if data is None or data.empty:
            return {"series": []}
        series = []
        for ts, row in data.iterrows():
            close = float(row["Close"])
            if not math.isfinite(close):
                continue
            vol = row.get("Volume")
            series.append({
                "date": ts.strftime("%Y-%m-%d") if hasattr(ts, "strftime") else str(ts)[:10],
                "close": close,
                "volume": float(vol) if vol is not None and math.isfinite(float(vol)) else None,
            })
        return {"series": series}
    except Exception as exc:
        logger.exception("history failed: %s", exc)
        return {"series": []}


@app.get("/news")
def news(ticker: str = Query(...)) -> dict[str, Any]:
    try:
        items = yf.Ticker(ticker).news or []
        out = []
        for item in items[:10]:
            content = item.get("content") or {}
            thumbnail = None
            thumbs = content.get("thumbnail") or {}
            for res in (thumbs.get("resolutions") or []):
                if res.get("url"):
                    thumbnail = res["url"]
                    break
            pub_date = content.get("pubDate") or content.get("displayTime") or ""
            out.append({
                "title": content.get("title") or item.get("title") or "",
                "publisher": (content.get("provider") or {}).get("displayName") or "",
                "link": (content.get("canonicalUrl") or {}).get("url") or item.get("link") or "",
                "date": pub_date[:10] if pub_date else None,
                "thumbnail": thumbnail,
            })
        return {"news": out}
    except Exception as exc:
        logger.exception("news failed: %s", exc)
        return {"news": []}


# ── Portfolio analytics ────────────────────────────────────────────────────────

class AnalyticsTxIn(BaseModel):
    date: str
    isin: str
    shares: float
    amount: float
    type: str


class PortfolioAnalyticsRequest(BaseModel):
    transactions: list[AnalyticsTxIn]
    benchmark: str = "URTH"


_MONTH_ABBREVS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _empty_analytics() -> dict[str, Any]:
    return {"monthly": {}, "annual": [], "sharpe": None,
            "volatility": None, "max_dd_days": 0, "pnl_series": []}


def _is_eur_ticker(ticker: str) -> bool:
    return (ticker.endswith(".DE") or ticker.endswith(".PA")
            or ticker.endswith(".MI") or ticker.endswith(".AS")
            or "-EUR" in ticker)


def _compute_portfolio_series(
    txs: list[AnalyticsTxIn],
) -> "tuple[pd.Series, pd.Series] | None":
    """Download historical prices and build daily (pv_series, cb_series).

    pv_series: daily portfolio market value in EUR
    cb_series: daily cumulative cost basis in EUR
    Returns None if computation is not possible.
    """
    filtered = [t for t in txs if t.isin and t.date]
    if not filtered:
        return None

    isins = list({t.isin for t in filtered})
    tickers_map = resolve_tickers(isins)
    if not tickers_map:
        return None

    start_date = min(t.date for t in filtered)
    tickers = list(set(tickers_map.values()))

    try:
        if len(tickers) == 1:
            raw = download_cached(tickers[0], start=start_date)
            close = pd.DataFrame({tickers[0]: raw["Close"]})
        else:
            raw = download_cached(tickers, start=start_date)
            close = raw["Close"]
        close = close.ffill()
    except Exception as exc:
        logger.exception("yfinance historical download failed: %s", exc)
        return None

    # Convert non-EUR prices to EUR using historical EURUSD rate
    non_eur = [t for t in tickers if not _is_eur_ticker(t)]
    if non_eur:
        try:
            fx_raw = download_cached("EURUSD=X", start=start_date, label="fx")
            if not fx_raw.empty:
                usd_to_eur = (1.0 / fx_raw["Close"].ffill()).reindex(close.index).ffill()
                for t in non_eur:
                    if t in close.columns:
                        close[t] = close[t] * usd_to_eur
        except Exception:
            pass

    sorted_txs = sorted(filtered, key=lambda t: t.date)
    shares_state: dict[str, float] = defaultdict(float)
    cost_state = 0.0
    tx_idx = 0
    pv_list: list[float] = []
    cb_list: list[float] = []
    date_list: list[Any] = []

    for dt in close.index:
        dt_str = dt.strftime("%Y-%m-%d")
        while tx_idx < len(sorted_txs) and sorted_txs[tx_idx].date <= dt_str:
            tx = sorted_txs[tx_idx]
            if tx.isin in tickers_map:
                if tx.type in ("BUY", "SAVINGS_PLAN"):
                    shares_state[tx.isin] += abs(tx.shares)
                    cost_state += abs(tx.amount)
                elif tx.type == "SELL":
                    shares_state[tx.isin] = max(0.0, shares_state[tx.isin] - abs(tx.shares))
            tx_idx += 1

        pv = 0.0
        for isin, shares in shares_state.items():
            if shares <= 0:
                continue
            ticker = tickers_map.get(isin)
            if not ticker or ticker not in close.columns:
                continue
            try:
                price = float(close.at[dt, ticker])
                if math.isfinite(price):
                    pv += shares * price
            except (KeyError, ValueError, TypeError):
                pass

        if pv > 0 or cost_state > 0:
            pv_list.append(pv)
            cb_list.append(cost_state)
            date_list.append(dt)

    if not pv_list:
        return None

    pv_series = pd.Series(pv_list, index=date_list)
    cb_series = pd.Series(cb_list, index=date_list)

    nonzero = pv_series[pv_series > 0]
    if nonzero.empty:
        return None
    first = nonzero.index[0]
    return pv_series[first:], cb_series[first:]


@app.post("/portfolio_analytics")
def portfolio_analytics(req: PortfolioAnalyticsRequest) -> dict[str, Any]:
    result = _compute_portfolio_series(req.transactions)
    if result is None:
        return _empty_analytics()
    pv_series, cb_series = result

    # Sharpe and volatility (annualised, risk-free = 0)
    daily_ret = pv_series.pct_change().dropna()
    sharpe: float | None = None
    volatility: float | None = None
    if len(daily_ret) >= 30:
        std = float(daily_ret.std())
        if std > 0:
            sharpe = round(float(daily_ret.mean()) / std * math.sqrt(252), 3)
        volatility = round(std * math.sqrt(252), 4)

    # Max drawdown duration (longest underwater streak)
    running_max = pv_series.expanding().max()
    underwater = pv_series < running_max
    max_dd_days = 0
    streak = 0
    for u in underwater:
        if u:
            streak += 1
            if streak > max_dd_days:
                max_dd_days = streak
        else:
            streak = 0

    pnl_raw = pv_series - cb_series

    # Monthly market return: ΔunrealisedPnL / month-end cost basis
    pnl_eom = pnl_raw.resample("ME").last()
    cb_eom = cb_series.resample("ME").last()
    monthly: dict[str, dict[str, float]] = {}
    for i in range(1, len(pnl_eom)):
        prev_pnl = float(pnl_eom.iloc[i - 1])
        curr_pnl = float(pnl_eom.iloc[i])
        cb_curr = float(cb_eom.iloc[i])
        if cb_curr > 0 and not math.isnan(curr_pnl):
            dt = pnl_eom.index[i]
            monthly.setdefault(str(dt.year), {})[_MONTH_ABBREVS[dt.month - 1]] = \
                round((curr_pnl - prev_pnl) / cb_curr * 100, 2)

    # Annual P&L: ΔunrealisedPnL per calendar year, pct = year-end pnl / year-end cb
    annual: list[dict[str, Any]] = []
    for year in sorted(set(pnl_raw.index.year)):
        mask = pnl_raw.index.year == year
        year_pnl = pnl_raw[mask]
        year_cb = cb_series[mask]
        if year_pnl.empty:
            continue
        pnl_start = float(year_pnl.iloc[0])
        pnl_end = float(year_pnl.iloc[-1])
        cb_end = float(year_cb.iloc[-1])
        pct_pct = (pnl_end / cb_end * 100) if cb_end > 0 else 0.0
        annual.append({"year": int(year), "pnl": round(pnl_end - pnl_start, 2), "pct": round(pct_pct, 2)})

    # Unrealised P&L series sampled to ≤500 points
    step = max(1, len(pnl_raw) // 500)
    pnl_list = [
        {"date": dt.strftime("%Y-%m-%d"), "pnl": round(float(v), 2)}
        for dt, v in pnl_raw.iloc[::step].items()
        if not math.isnan(float(v))
    ]

    return {
        "monthly": monthly,
        "annual": annual,
        "sharpe": sharpe,
        "volatility": volatility,
        "max_dd_days": int(max_dd_days),
        "pnl_series": pnl_list,
    }


@app.post("/portfolio_performance")
def portfolio_performance(req: PortfolioAnalyticsRequest) -> dict[str, Any]:
    """Build the daily portfolio time series for the hero chart on the overview page.

    TWR is computed as:  daily_return = Σ(shares_start_of_day × Δprice) / pv_start_of_day
    Using start-of-day shares (before that day's transactions) completely excludes the
    distortion caused by new deposits — buying more shares has zero effect on the return.
    """
    filtered = [t for t in req.transactions if t.isin and t.date]
    if not filtered:
        return {"series": [], "drawdown": [], "twr": [], "benchmark": []}

    isins = list({t.isin for t in filtered})
    tickers_map = resolve_tickers(isins)
    if not tickers_map:
        return {"series": [], "drawdown": [], "twr": [], "benchmark": []}

    start_date = min(t.date for t in filtered)
    tickers = list(set(tickers_map.values()))

    try:
        if len(tickers) == 1:
            raw = download_cached(tickers[0], start=start_date)
            close = pd.DataFrame({tickers[0]: raw["Close"]})
        else:
            raw = download_cached(tickers, start=start_date)
            close = raw["Close"]
        close = close.ffill()
    except Exception as exc:
        logger.exception("yfinance download failed: %s", exc)
        return {"series": [], "drawdown": [], "twr": [], "benchmark": []}

    non_eur = [t for t in tickers if not _is_eur_ticker(t)]
    if non_eur:
        try:
            fx_raw = download_cached("EURUSD=X", start=start_date, label="fx")
            if not fx_raw.empty:
                usd_to_eur = (1.0 / fx_raw["Close"].ffill()).reindex(close.index).ffill()
                for t in non_eur:
                    if t in close.columns:
                        close[t] = close[t] * usd_to_eur
        except Exception:
            pass

    sorted_txs = sorted(filtered, key=lambda t: t.date)
    shares_state: dict[str, float] = defaultdict(float)
    cost_state = 0.0
    tx_idx = 0

    twr_factor = 1.0
    running_max_pv = 0.0
    prev_dt = None

    pv_list: list[float] = []
    cb_list: list[float] = []
    twr_list: list[float] = []
    dd_list: list[float] = []
    date_list: list[Any] = []

    for dt in close.index:
        dt_str = dt.strftime("%Y-%m-%d")

        # Snapshot shares BEFORE applying today's transactions (for correct TWR)
        shares_start = dict(shares_state)

        while tx_idx < len(sorted_txs) and sorted_txs[tx_idx].date <= dt_str:
            tx = sorted_txs[tx_idx]
            if tx.isin in tickers_map:
                if tx.type in ("BUY", "SAVINGS_PLAN"):
                    shares_state[tx.isin] += abs(tx.shares)
                    cost_state += abs(tx.amount)
                elif tx.type == "SELL":
                    shares_state[tx.isin] = max(0.0, shares_state[tx.isin] - abs(tx.shares))
            tx_idx += 1

        # End-of-day portfolio value (after transactions)
        pv = 0.0
        for isin, shares in shares_state.items():
            if shares <= 0:
                continue
            ticker = tickers_map.get(isin)
            if not ticker or ticker not in close.columns:
                continue
            try:
                price = float(close.at[dt, ticker])
                if math.isfinite(price):
                    pv += shares * price
            except (KeyError, ValueError, TypeError):
                pass

        # TWR: Σ(start_shares × Δprice) / Σ(start_shares × prev_price)
        # This is zero for a day where you only bought/sold (no market movement), which is correct.
        if prev_dt is not None and shares_start:
            market_gain = 0.0
            pv_start = 0.0
            for isin, shares in shares_start.items():
                if shares <= 0:
                    continue
                ticker = tickers_map.get(isin)
                if not ticker or ticker not in close.columns:
                    continue
                try:
                    p_today = float(close.at[dt, ticker])
                    p_prev = float(close.at[prev_dt, ticker])
                    if math.isfinite(p_today) and math.isfinite(p_prev):
                        market_gain += shares * (p_today - p_prev)
                        pv_start += shares * p_prev
                except (KeyError, ValueError, TypeError):
                    pass
            if pv_start > 0:
                twr_factor *= (1 + market_gain / pv_start)

        twr_pct = (twr_factor - 1) * 100

        # Drawdown from all-time high portfolio value
        if pv > running_max_pv:
            running_max_pv = pv
        dd = (pv - running_max_pv) / running_max_pv * 100 if running_max_pv > 0 else 0.0

        if pv > 0 or cost_state > 0:
            pv_list.append(pv)
            cb_list.append(cost_state)
            twr_list.append(twr_pct)
            dd_list.append(dd)
            date_list.append(dt)

        prev_dt = dt

    if not pv_list:
        return {"series": [], "drawdown": [], "twr": [], "benchmark": []}

    # Compute benchmark TWR series
    benchmark_series: list[dict[str, Any]] = []
    try:
        bm_ticker = req.benchmark.strip() if req.benchmark else "URTH"
        bm_raw = download_cached(bm_ticker, start=start_date, label=bm_ticker)
        if bm_raw is not None and not bm_raw.empty:
            bm_close = bm_raw["Close"].ffill()
            # Filter to dates present in our date_list range
            date_set = {dt.strftime("%Y-%m-%d") for dt in date_list}
            first_portfolio_date = date_list[0].strftime("%Y-%m-%d")
            bm_factor = 1.0
            bm_prev_price: float | None = None
            for ts, row in bm_close.items():
                ts_str = ts.strftime("%Y-%m-%d") if hasattr(ts, "strftime") else str(ts)[:10]
                if ts_str < first_portfolio_date:
                    bm_prev_price = float(row)
                    continue
                price = float(row)
                if not math.isfinite(price):
                    continue
                if bm_prev_price is not None and bm_prev_price > 0:
                    bm_factor *= (1 + (price - bm_prev_price) / bm_prev_price)
                elif bm_prev_price is None:
                    # First data point at or after portfolio start
                    pass
                bm_prev_price = price
                if ts_str in date_set:
                    benchmark_series.append({
                        "date": ts_str,
                        "twr": round((bm_factor - 1) * 100, 4),
                    })
    except Exception as exc:
        logger.exception("benchmark download failed: %s", exc)
        benchmark_series = []

    return {
        "series": [
            {
                "date": dt.strftime("%Y-%m-%d"),
                "portfolio_value": round(float(pv), 2),
                "contributions": round(float(cb), 2),
                "holdings_value": round(float(pv), 2),
            }
            for dt, pv, cb in zip(date_list, pv_list, cb_list)
        ],
        "drawdown": [
            {"date": dt.strftime("%Y-%m-%d"), "drawdown": round(float(v), 4)}
            for dt, v in zip(date_list, dd_list)
        ],
        "twr": [
            {"date": dt.strftime("%Y-%m-%d"), "twr": round(float(v), 4)}
            for dt, v in zip(date_list, twr_list)
        ],
        "benchmark": benchmark_series,
    }
