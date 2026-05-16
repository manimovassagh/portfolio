# pyright: reportGeneralTypeIssues=false
"""Reconstruct portfolio value over time vs cumulative contributions.

For each historical day we know:
- The shares held in each ISIN (cumulative shares from BUYs/SELLs)
- The cumulative deposits minus withdrawals
- The historical close price of each ISIN (from yfinance)

Portfolio value(day) = sum over ISIN of (shares_held(day) * close_price(day)) + cash_balance(day)
"""
from __future__ import annotations

import pandas as pd
import yfinance as yf

from .cash import DEPOSIT_TYPES, WITHDRAWAL_TYPES
from .prices import resolve_tickers


def _daily_share_balance(df: pd.DataFrame, isins: list[str]) -> pd.DataFrame:
    """Wide DataFrame: index=date (daily), columns=ISINs, values=cumulative shares."""
    trades = df[df["category"] == "TRADING"].copy()
    if trades.empty:
        return pd.DataFrame()

    trades["day"] = trades["date"].dt.normalize()
    pivot = trades.pivot_table(
        index="day", columns="symbol", values="shares", aggfunc="sum"
    ).fillna(0)

    start = trades["day"].min()
    end = pd.Timestamp.now().normalize()
    all_days = pd.date_range(start, end, freq="D")
    pivot = pivot.reindex(all_days, fill_value=0).cumsum()

    for isin in isins:
        if isin not in pivot.columns:
            pivot[isin] = 0.0
    return pivot[isins]


def _daily_cash(df: pd.DataFrame) -> pd.Series:
    """Daily cumulative cash balance (deposits in + dividends + interest - trade outflows - fees - tax)."""
    daily = df.copy()
    daily["day"] = daily["date"].dt.normalize()
    daily["delta"] = daily["amount"].fillna(0) + daily["fee"].fillna(0) + daily["tax"].fillna(0)
    grouped = daily.groupby("day")["delta"].sum()
    start = grouped.index.min()
    end = pd.Timestamp.now().normalize()
    return grouped.reindex(pd.date_range(start, end, freq="D"), fill_value=0).cumsum()


def _daily_contributions(df: pd.DataFrame) -> pd.Series:
    """Daily cumulative net deposits (what you put in)."""
    contrib = df[df["type"].isin(DEPOSIT_TYPES + WITHDRAWAL_TYPES)].copy()
    if contrib.empty:
        return pd.Series(dtype=float)
    contrib["day"] = contrib["date"].dt.normalize()
    grouped = contrib.groupby("day")["amount"].sum()
    start = grouped.index.min()
    end = pd.Timestamp.now().normalize()
    return grouped.reindex(pd.date_range(start, end, freq="D"), fill_value=0).cumsum()


def _ticker_currency(ticker: str) -> str:
    """Best-effort currency detection per ticker."""
    try:
        info = yf.Ticker(ticker).fast_info
        return (info.get("currency") or "EUR").upper()
    except Exception:
        return "EUR"


def _fx_history(ccy: str, start: pd.Timestamp, end: pd.Timestamp) -> pd.Series:
    """Daily ccy→EUR rate, forward-filled to every calendar day."""
    if ccy == "EUR":
        idx = pd.date_range(start, end, freq="D")
        return pd.Series(1.0, index=idx)
    pair = f"{ccy}EUR=X"
    try:
        h = yf.Ticker(pair).history(
            start=start.strftime("%Y-%m-%d"),
            end=(end + pd.Timedelta(days=2)).strftime("%Y-%m-%d"),
            auto_adjust=False,
        )
        s = h["Close"]
        s.index = s.index.tz_localize(None) if s.index.tz is not None else s.index
    except Exception:
        idx = pd.date_range(start, end, freq="D")
        return pd.Series(1.0, index=idx)
    full_idx = pd.date_range(start, end, freq="D")
    return s.reindex(full_idx).ffill().bfill().fillna(1.0)


def _historical_prices(isins: list[str], start: pd.Timestamp, end: pd.Timestamp) -> pd.DataFrame:
    """Download daily close prices for each ISIN's mapped ticker, converted to EUR."""
    tickers = resolve_tickers(isins)
    if not tickers:
        return pd.DataFrame()

    ticker_list = list(tickers.values())
    try:
        data = yf.download(
            ticker_list,
            start=start.strftime("%Y-%m-%d"),
            end=(end + pd.Timedelta(days=1)).strftime("%Y-%m-%d"),
            progress=False,
            auto_adjust=False,
            group_by="ticker" if len(ticker_list) > 1 else "column",
        )
    except Exception:
        return pd.DataFrame()

    if data is None or data.empty:
        return pd.DataFrame()

    closes = pd.DataFrame()
    if len(ticker_list) == 1:
        if "Close" in data.columns:
            closes[ticker_list[0]] = data["Close"]
    else:
        for tkr in ticker_list:
            if isinstance(data.columns, pd.MultiIndex) and tkr in data.columns.levels[0]:
                closes[tkr] = data[tkr]["Close"]

    full_idx = pd.date_range(start, end, freq="D")
    if not closes.empty:
        closes.index = closes.index.tz_localize(None) if closes.index.tz is not None else closes.index
    closes = closes.reindex(full_idx).ffill().bfill()

    # FX-adjust each ticker into EUR
    currencies = {tkr: _ticker_currency(tkr) for tkr in ticker_list}
    fx_cache: dict[str, pd.Series] = {}
    for tkr, ccy in currencies.items():
        if ccy == "EUR" or tkr not in closes.columns:
            continue
        if ccy not in fx_cache:
            fx_cache[ccy] = _fx_history(ccy, start, end)
        closes[tkr] = closes[tkr] * fx_cache[ccy]

    result = pd.DataFrame(index=full_idx)
    for isin, tkr in tickers.items():
        if tkr in closes.columns:
            result[isin] = closes[tkr]
    return result


def performance_series(df: pd.DataFrame) -> pd.DataFrame:
    """Return DataFrame indexed by day with columns: portfolio_value, contributions, cash."""
    isins = sorted({s for s in df.loc[df["category"] == "TRADING", "symbol"].dropna().unique() if s})
    if not isins:
        return pd.DataFrame(columns=["portfolio_value", "contributions", "cash"])

    shares = _daily_share_balance(df, isins)
    cash = _daily_cash(df)
    contrib = _daily_contributions(df)

    if shares.empty:
        return pd.DataFrame(columns=["portfolio_value", "contributions", "cash"])

    start, end = shares.index.min(), shares.index.max()
    prices = _historical_prices(isins, start, end)
    if prices.empty:
        invested = -df.loc[df["category"] == "TRADING", "amount"].fillna(0)
        invested.index = df.loc[df["category"] == "TRADING", "date"].dt.normalize()
        invested = invested.groupby(level=0).sum().reindex(shares.index, fill_value=0).cumsum()
        return pd.DataFrame(
            {"portfolio_value": invested + cash, "contributions": contrib, "cash": cash}
        ).fillna(method="ffill").fillna(0)

    # Align prices to the share-balance index
    prices = prices.reindex(shares.index).ffill().bfill()
    holdings_value = (shares * prices).sum(axis=1)

    result = pd.DataFrame(
        {
            "portfolio_value": holdings_value + cash,
            "contributions": contrib.reindex(shares.index).ffill().fillna(0),
            "cash": cash,
            "holdings_value": holdings_value,
        }
    )
    return result
