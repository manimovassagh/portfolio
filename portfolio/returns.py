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
