# pyright: reportGeneralTypeIssues=false
"""Compute current holdings and realized P&L from a transaction DataFrame.

Cost basis uses average-cost (German tax law's standard for Vorabpauschale and
most retail brokers including Trade Republic). Realized P&L on a SELL is
(sell_price - avg_cost_at_time) * shares_sold.
"""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass
class Holding:
    isin: str
    name: str
    asset_class: str
    shares: float = 0.0
    cost_basis: float = 0.0  # total EUR invested (net of sells)
    realized_pnl: float = 0.0
    fees_paid: float = 0.0

    @property
    def avg_cost(self) -> float:
        return self.cost_basis / self.shares if self.shares > 1e-9 else 0.0


@dataclass
class RealizedTrade:
    date: pd.Timestamp
    isin: str
    name: str
    shares: float
    sell_price: float
    avg_cost: float
    pnl: float


def compute_holdings(df: pd.DataFrame) -> tuple[dict[str, Holding], list[RealizedTrade]]:
    """Walk transactions chronologically, return current holdings and realized trades."""
    holdings: dict[str, Holding] = {}
    realized: list[RealizedTrade] = []

    trades = df[df["category"] == "TRADING"].copy()

    for _, row in trades.iterrows():
        isin = str(row["symbol"] or "")
        if not isin:
            continue

        h = holdings.setdefault(
            isin,
            Holding(isin=isin, name=str(row["name"]), asset_class=str(row["asset_class"])),
        )

        shares_raw = row["shares"]
        amount_raw = row["amount"]
        fee_raw = row["fee"]
        shares = float(shares_raw) if pd.notna(shares_raw) else 0.0
        amount = float(amount_raw) if pd.notna(amount_raw) else 0.0
        fee = float(fee_raw) if pd.notna(fee_raw) else 0.0
        h.fees_paid += abs(fee)

        txn_type = str(row["type"])
        if txn_type == "BUY":
            h.shares += shares
            h.cost_basis += abs(amount)
        elif txn_type == "SELL":
            sold = abs(shares)
            avg = h.avg_cost
            price_raw = row["price"]
            sell_price = float(price_raw) if pd.notna(price_raw) else 0.0
            pnl = (sell_price - avg) * sold
            h.realized_pnl += pnl
            h.shares += shares  # shares is negative on sells
            h.cost_basis -= avg * sold
            if h.cost_basis < 0:
                h.cost_basis = 0.0
            realized.append(
                RealizedTrade(
                    date=pd.Timestamp(row["datetime"]),
                    isin=isin,
                    name=str(row["name"]),
                    shares=sold,
                    sell_price=sell_price,
                    avg_cost=avg,
                    pnl=pnl,
                )
            )

    # Stock perks (free shares) — add shares without changing cost basis
    perks = df[df["type"] == "STOCKPERK"]
    for _, row in perks.iterrows():
        isin = row["symbol"]
        if not isin or isin not in holdings:
            continue
        # STOCKPERK in TR exports often shows the EUR value, not shares; skip share adjustment
        # but track value as bonus income elsewhere.
        pass

    # Filter out fully-sold positions (≤ rounding noise)
    open_holdings = {k: v for k, v in holdings.items() if v.shares > 1e-6}
    return open_holdings, realized


def holdings_to_df(
    holdings: dict[str, Holding],
    prices: dict[str, float] | None = None,
) -> pd.DataFrame:
    """Build a display DataFrame from holdings, joining current prices if given."""
    prices = prices or {}
    rows = []
    for h in holdings.values():
        cur = prices.get(h.isin)
        market_value = (cur * h.shares) if cur else None
        unrealized = (market_value - h.cost_basis) if market_value is not None else None
        unrealized_pct = (unrealized / h.cost_basis * 100) if unrealized is not None and h.cost_basis else None
        rows.append(
            {
                "ISIN": h.isin,
                "Name": h.name,
                "Asset class": h.asset_class,
                "Shares": h.shares,
                "Avg cost (EUR)": h.avg_cost,
                "Cost basis (EUR)": h.cost_basis,
                "Current price (EUR)": cur,
                "Market value (EUR)": market_value,
                "Unrealized P&L (EUR)": unrealized,
                "Unrealized P&L %": unrealized_pct,
                "Realized P&L (EUR)": h.realized_pnl,
                "Fees paid (EUR)": h.fees_paid,
            }
        )
    return pd.DataFrame(rows)
