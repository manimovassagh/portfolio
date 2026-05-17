# pyright: reportGeneralTypeIssues=false
"""Watchlist CRUD routes."""
from __future__ import annotations

from fastapi import APIRouter

from app.deps import to_float
from app.schemas import WatchlistAddRequest, WatchlistItem, WatchlistResponse
from portfolio import db, prices

router = APIRouter()


def _enrich(rows: list[db.WatchlistRow]) -> list[WatchlistItem]:
    """Attach live price to each watchlist row."""
    if not rows:
        return []
    try:
        live = prices.fetch_prices([r.isin for r in rows])
    except Exception:
        live = {}
    return [
        WatchlistItem(
            isin=r.isin,
            ticker=r.ticker,
            name=r.name,
            notes=r.notes,
            target_price=r.target_price,
            added_date=r.added_date,
            current_price=to_float(live.get(r.isin)),
        )
        for r in rows
    ]


@router.get("/api/watchlist", response_model=WatchlistResponse)
def get_watchlist() -> WatchlistResponse:
    return WatchlistResponse(items=_enrich(db.list_watchlist()))


@router.post("/api/watchlist", response_model=WatchlistResponse)
def add_watchlist(body: WatchlistAddRequest) -> WatchlistResponse:
    db.add_watchlist_item(body.isin, body.ticker, body.name, body.notes, body.target_price)
    return WatchlistResponse(items=_enrich(db.list_watchlist()))


@router.delete("/api/watchlist/{isin}", response_model=WatchlistResponse)
def delete_watchlist(isin: str) -> WatchlistResponse:
    db.remove_watchlist_item(isin)
    return WatchlistResponse(items=_enrich(db.list_watchlist()))
