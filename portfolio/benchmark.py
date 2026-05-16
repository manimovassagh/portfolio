# pyright: reportGeneralTypeIssues=false
"""Benchmark comparison — what if you'd put the same deposits into S&P 500?"""
from __future__ import annotations

import pandas as pd
import yfinance as yf

# MSCI World ETF (EUR) — cleanest comparison for a TR account
BENCHMARKS = {
    "MSCI World (EUNL.DE)": "EUNL.DE",
    "S&P 500 (SXR8.DE)": "SXR8.DE",
}


def benchmark_series(ticker: str, start: pd.Timestamp, end: pd.Timestamp) -> pd.Series:
    """Daily EUR close prices for a benchmark, forward-filled to every calendar day."""
    try:
        hist = yf.Ticker(ticker).history(
            start=start.strftime("%Y-%m-%d"),
            end=(end + pd.Timedelta(days=2)).strftime("%Y-%m-%d"),
            auto_adjust=True,
        )
        s = hist["Close"]
        s.index = s.index.tz_localize(None) if s.index.tz is not None else s.index
    except Exception:
        return pd.Series(dtype=float)
    return s.reindex(pd.date_range(start, end, freq="D")).ffill().bfill()


def hypothetical_value(
    contributions_daily: pd.Series, benchmark_prices: pd.Series
) -> pd.Series:
    """If every contribution had bought benchmark shares at that day's price,
    what would the position be worth today?

    contributions_daily: daily *net* deposit amounts (positive on deposit days, 0 otherwise)
    """
    df = pd.DataFrame({"deposit": contributions_daily, "price": benchmark_prices}).dropna()
    if df.empty:
        return pd.Series(dtype=float)
    df["shares_bought"] = df["deposit"] / df["price"]
    df["cum_shares"] = df["shares_bought"].cumsum()
    df["value"] = df["cum_shares"] * df["price"]
    return df["value"]
