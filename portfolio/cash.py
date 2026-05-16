# pyright: reportGeneralTypeIssues=false
"""Cash-flow and income calculations from the transaction stream."""
from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


DEPOSIT_TYPES = ["TRANSFER_INBOUND", "TRANSFER_INSTANT_INBOUND", "CUSTOMER_INPAYMENT"]
WITHDRAWAL_TYPES = ["TRANSFER_OUTBOUND", "TRANSFER_INSTANT_OUTBOUND"]
INCOME_TYPES = ["DIVIDEND", "INTEREST_PAYMENT", "STOCKPERK"]


@dataclass
class CashSummary:
    deposits: float
    withdrawals: float
    dividends: float
    interest: float
    stockperks: float
    fees: float
    tax: float
    invested: float  # net cash spent on BUYs minus SELLs proceeds
    cash_balance: float

    @property
    def net_deposits(self) -> float:
        return self.deposits - self.withdrawals

    @property
    def total_income(self) -> float:
        return self.dividends + self.interest + self.stockperks


def summarize(df: pd.DataFrame) -> CashSummary:
    """Reduce the ledger to a single cash summary."""
    deposits = df.loc[df["type"].isin(DEPOSIT_TYPES), "amount"].sum()
    withdrawals = -df.loc[df["type"].isin(WITHDRAWAL_TYPES), "amount"].sum()
    dividends = df.loc[df["type"] == "DIVIDEND", "amount"].sum()
    interest = df.loc[df["type"] == "INTEREST_PAYMENT", "amount"].sum()
    stockperks = df.loc[df["type"] == "STOCKPERK", "amount"].sum()
    fees = -df["fee"].fillna(0).sum()  # fees stored negative
    tax = -df["tax"].fillna(0).sum()  # tax stored negative

    trades = df[df["category"] == "TRADING"]
    invested = -trades["amount"].sum()  # net outflow on trades

    # Cash balance = sum of every amount column (TR shows signed amounts already)
    cash_balance = df["amount"].fillna(0).sum() + df["fee"].fillna(0).sum() + df["tax"].fillna(0).sum()

    return CashSummary(
        deposits=float(deposits),
        withdrawals=float(withdrawals),
        dividends=float(dividends),
        interest=float(interest),
        stockperks=float(stockperks),
        fees=float(fees),
        tax=float(tax),
        invested=float(invested),
        cash_balance=float(cash_balance),
    )


def income_log(df: pd.DataFrame) -> pd.DataFrame:
    """All income events as a sortable table."""
    log = df[df["type"].isin(INCOME_TYPES)].copy()
    if log.empty:
        return pd.DataFrame(columns=["Date", "Type", "Asset", "Amount (EUR)", "Tax (EUR)"])
    log["Date"] = log["date"].dt.date
    log["Type"] = log["type"]
    log["Asset"] = log["name"].where(log["name"] != "", "—")
    log["Amount (EUR)"] = log["amount"]
    log["Tax (EUR)"] = log["tax"].fillna(0)
    return log[["Date", "Type", "Asset", "Amount (EUR)", "Tax (EUR)"]].sort_values("Date", ascending=False)


def tax_view(df: pd.DataFrame) -> pd.DataFrame:
    """German tax-relevant rows: Vorabpauschale (EARNINGS), dividends, capital gains tax."""
    tax_rows = df[(df["tax"].fillna(0) != 0) | (df["type"] == "EARNINGS")].copy()
    if tax_rows.empty:
        return pd.DataFrame(columns=["Date", "Type", "Asset", "Amount (EUR)", "Tax (EUR)", "Description"])
    tax_rows["Date"] = tax_rows["date"].dt.date
    tax_rows["Type"] = tax_rows["type"]
    tax_rows["Asset"] = tax_rows["name"].where(tax_rows["name"] != "", "—")
    tax_rows["Amount (EUR)"] = tax_rows["amount"].fillna(0)
    tax_rows["Tax (EUR)"] = tax_rows["tax"].fillna(0)
    tax_rows["Description"] = tax_rows["description"]
    return tax_rows[["Date", "Type", "Asset", "Amount (EUR)", "Tax (EUR)", "Description"]].sort_values(
        "Date", ascending=False
    )


def cash_balance_over_time(df: pd.DataFrame) -> pd.DataFrame:
    """Daily cash balance — every signed amount summed cumulatively."""
    daily = df.copy()
    daily["delta"] = daily["amount"].fillna(0) + daily["fee"].fillna(0) + daily["tax"].fillna(0)
    daily = daily.groupby(daily["date"].dt.date)["delta"].sum().cumsum().reset_index()
    daily.columns = ["date", "cash"]
    return daily
