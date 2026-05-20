# pyright: reportGeneralTypeIssues=false
"""Pydantic response and request models for all API endpoints."""
from __future__ import annotations

from pydantic import BaseModel


# ── Watchlist ────────────────────────────────────────────────────────

class WatchlistItem(BaseModel):
    isin: str
    ticker: str
    name: str
    notes: str
    target_price: float | None
    added_date: str
    current_price: float | None

class WatchlistResponse(BaseModel):
    items: list[WatchlistItem]

class WatchlistAddRequest(BaseModel):
    isin: str
    ticker: str
    name: str
    notes: str = ""
    target_price: float | None = None


# ── Geographic allocation ────────────────────────────────────────────

class CountryAllocation(BaseModel):
    code: str
    name: str
    value: float | None
    pct: float | None

class GeographicResponse(BaseModel):
    countries: list[CountryAllocation]


# ── Freistellungsauftrag ─────────────────────────────────────────────

class FsaBreakdown(BaseModel):
    dividends: float | None
    interest: float | None
    stockperks: float | None
    realized_gains: float | None
    vorabpauschale: float | None

class FsaResponse(BaseModel):
    year: int
    limit: float
    used: float | None
    remaining: float | None
    breakdown: FsaBreakdown


# ── Dividend calendar ────────────────────────────────────────────────

class DividendEntry(BaseModel):
    isin: str
    name: str
    last_dividend_date: str | None
    last_amount: float | None

class DividendCalendarResponse(BaseModel):
    upcoming: list[DividendEntry]
