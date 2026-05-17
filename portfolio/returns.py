# pyright: reportGeneralTypeIssues=false
"""Money-weighted return (XIRR), time-weighted return (TWR), drawdown."""
from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd
from scipy.optimize import brentq


def xirr(cashflows: list[tuple[date, float]]) -> float | None:
    """Annualized money-weighted return (IRR) on irregular cash flows.

    Cashflows: list of (date, amount). Outflows (deposits / buys) are negative
    from the investor's perspective; inflows (withdrawals, current value) positive.
    The final 'cash flow' should be the current portfolio value as a positive amount.

    Returns None if XIRR can't be solved (e.g., all flows same sign).
    """
    if len(cashflows) < 2:
        return None
    if all(cf[1] >= 0 for cf in cashflows) or all(cf[1] <= 0 for cf in cashflows):
        return None

    t0 = cashflows[0][0]
    days = np.array([(cf[0] - t0).days for cf in cashflows], dtype=float)
    amounts = np.array([cf[1] for cf in cashflows], dtype=float)

    def npv(rate: float) -> float:
        return float(np.sum(amounts / (1 + rate) ** (days / 365.0)))

    try:
        return float(brentq(npv, -0.999, 100.0, maxiter=200))
    except (ValueError, RuntimeError):
        return None


def twr(portfolio_value: pd.Series, contributions: pd.Series) -> pd.Series:
    """Time-weighted return as a daily indexed cumulative-growth series (1.0 = breakeven).

    Removes the impact of deposits/withdrawals by chaining sub-period returns
    around contribution events. Result is a multiplier: 1.10 means +10% TWR.
    """
    pv, contrib = portfolio_value.align(contributions, join="outer")
    pv = pv.ffill().fillna(0)
    contrib = contrib.ffill().fillna(0)

    daily_contrib = contrib.diff().fillna(contrib.iloc[0] if len(contrib) else 0)
    prev_pv = pv.shift(1).fillna(0)
    # sub-period return = (today's value - today's deposit) / yesterday's value
    denom = prev_pv.replace(0, np.nan)
    sub_returns = (pv - daily_contrib) / denom
    sub_returns = sub_returns.fillna(1.0)
    return sub_returns.cumprod()


def drawdown(portfolio_value: pd.Series) -> pd.Series:
    """Percentage drawdown from rolling all-time high."""
    high_water = portfolio_value.cummax()
    return (portfolio_value - high_water) / high_water.replace(0, np.nan)


def annualize(total_return: float, days: int) -> float:
    """Convert a total cumulative return to annualized."""
    if days <= 0:
        return 0.0
    years = days / 365.0
    if years < 1e-6:
        return 0.0
    return (1 + total_return) ** (1 / years) - 1


def monthly_returns(portfolio_value: pd.Series) -> dict:
    """Month-over-month % returns keyed by {year: {month_abbr: pct}}."""
    if portfolio_value.empty:
        return {}
    monthly = portfolio_value.resample('ME').last()
    pct = monthly.pct_change() * 100
    result: dict[int, dict[str, float]] = {}
    for ts, val in pct.items():
        if pd.isna(val):
            continue
        result.setdefault(int(ts.year), {})[ts.strftime('%b')] = round(float(val), 2)
    return result


def sharpe_ratio(portfolio_value: pd.Series, risk_free_annual: float = 0.03) -> float | None:
    """Annualized Sharpe ratio (risk-free rate = 3%)."""
    daily = portfolio_value.pct_change().dropna()
    if len(daily) < 20:
        return None
    excess = daily - risk_free_annual / 252
    std = daily.std()
    if not std or np.isnan(std):
        return None
    return float((excess.mean() / std) * np.sqrt(252))


def annualized_volatility(portfolio_value: pd.Series) -> float | None:
    """Annualized standard deviation of daily returns."""
    daily = portfolio_value.pct_change().dropna()
    if len(daily) < 5:
        return None
    vol = daily.std() * np.sqrt(252)
    return float(vol) if not np.isnan(vol) else None


def annual_returns(portfolio_value: pd.Series) -> list[dict]:
    """Year-by-year P&L and % return."""
    if portfolio_value.empty:
        return []
    out = []
    for yr, group in portfolio_value.groupby(portfolio_value.index.year):
        group = group.dropna()
        if group.empty:
            continue
        start, end = float(group.iloc[0]), float(group.iloc[-1])
        pnl = end - start
        out.append({'year': int(yr), 'pnl': round(pnl, 2), 'pct': round(pnl / start * 100 if start else 0, 2)})
    return out


def max_drawdown_duration(portfolio_value: pd.Series) -> int:
    """Longest consecutive days spent below a previous high-water mark."""
    if portfolio_value.empty:
        return 0
    hwm = portfolio_value.cummax()
    underwater = (portfolio_value < hwm)
    max_dur, cur = 0, 0
    for u in underwater:
        cur = cur + 1 if u else 0
        if cur > max_dur:
            max_dur = cur
    return max_dur


def best_worst_days(portfolio_value: pd.Series, top_n: int = 3) -> dict:
    """Return best and worst single-day P&L days."""
    daily = portfolio_value.diff().dropna()
    if daily.empty:
        return {"best": [], "worst": []}
    best = daily.nlargest(top_n)
    worst = daily.nsmallest(top_n)
    return {
        "best": [{"date": str(d.date()), "pnl": float(v)} for d, v in best.items()],
        "worst": [{"date": str(d.date()), "pnl": float(v)} for d, v in worst.items()],
    }
