"""SQLite persistence layer for user data (watchlist, future: alerts, notes)."""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Generator

_DB_PATH: Path | None = None


def init(db_path: Path) -> None:
    """Call once at startup with the database file path."""
    global _DB_PATH
    _DB_PATH = db_path
    with _connect() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS watchlist (
                isin        TEXT PRIMARY KEY,
                ticker      TEXT NOT NULL DEFAULT '',
                name        TEXT NOT NULL DEFAULT '',
                notes       TEXT NOT NULL DEFAULT '',
                target_price REAL,
                added_date  TEXT NOT NULL
            )
        """)


@contextmanager
def _connect() -> Generator[sqlite3.Connection, None, None]:
    assert _DB_PATH is not None, "db.init() must be called before use"
    conn = sqlite3.connect(_DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@dataclass
class WatchlistRow:
    isin: str
    ticker: str
    name: str
    notes: str
    target_price: float | None
    added_date: str


def list_watchlist() -> list[WatchlistRow]:
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM watchlist ORDER BY added_date DESC").fetchall()
    return [_row_to_dataclass(r) for r in rows]


def add_watchlist_item(
    isin: str,
    ticker: str,
    name: str,
    notes: str = "",
    target_price: float | None = None,
) -> None:
    """Insert a new item, silently ignore if ISIN already exists."""
    with _connect() as conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO watchlist (isin, ticker, name, notes, target_price, added_date)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (isin, ticker, name, notes, target_price, date.today().isoformat()),
        )


def remove_watchlist_item(isin: str) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM watchlist WHERE isin = ?", (isin,))


def _row_to_dataclass(row: sqlite3.Row) -> WatchlistRow:
    return WatchlistRow(
        isin=row["isin"],
        ticker=row["ticker"],
        name=row["name"],
        notes=row["notes"],
        target_price=row["target_price"],
        added_date=row["added_date"],
    )
