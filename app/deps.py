# pyright: reportGeneralTypeIssues=false
"""Shared dependencies: application state cache, float helper, date serialiser."""
from __future__ import annotations

import math
import os
import threading
import time
from datetime import date, datetime
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import HTTPException

from portfolio import cash, loader, performance, positions, prices

BASE_DIR = Path(__file__).resolve().parent.parent  # project root

_cache: dict[str, Any] = {}
_lock = threading.Lock()


def to_float(v: Any) -> float | None:
    """Convert to JSON-safe float — NaN/Inf become None."""
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if (math.isnan(f) or math.isinf(f)) else f


def get_state(export_name: str | None = None, force_refresh: bool = False) -> dict[str, Any]:
    """Load and cache portfolio state for the given export file."""
    exports = loader.list_exports()
    if not exports:
        raise HTTPException(404, "No CSV files in exports/")

    if export_name:
        chosen = next((p for p in exports if p.name == export_name), None)
        if not chosen:
            raise HTTPException(404, f"Export '{export_name}' not found")
    else:
        chosen = exports[0]

    key = f"{chosen.name}-{chosen.stat().st_mtime}"
    ttl_seconds = int(os.environ.get("PRICE_REFRESH_SECONDS", "60"))
    with _lock:
        cached = _cache.get(key)
        if not force_refresh and cached and time.time() - cached.get("loaded_at", 0) < ttl_seconds:
            return _cache[key]

    try:
        df = loader.load(chosen)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    holdings, realized = positions.compute_holdings(df)
    isins = list(holdings.keys())
    live = prices.fetch_prices(isins, force_refresh=force_refresh)
    perf = performance.performance_series(df)
    summary = cash.summarize(df)

    spark_end = pd.Timestamp.now().normalize()
    spark_start = spark_end - pd.Timedelta(days=90)
    hist = performance._historical_prices(isins, spark_start, spark_end)
    spark_data: dict[str, list[float]] = {}
    if not hist.empty:
        for isin in isins:
            if isin in hist.columns:
                series = hist[isin].dropna().tolist()
                if series:
                    spark_data[isin] = [float(v) for v in series]

    with _lock:
        _cache[key] = {
            "export": chosen,
            "df": df,
            "holdings": holdings,
            "realized": realized,
            "prices": live,
            "perf": perf,
            "summary": summary,
            "spark_data": spark_data,
            "exports": [p.name for p in exports],
            "loaded_at": time.time(),
        }
    return _cache[key]


def clear_cache() -> None:
    _cache.clear()


def serialize_dates(records: list[dict]) -> list[dict]:
    """Normalise date/timestamp values to ISO strings in-place."""
    for r in records:
        for k, v in list(r.items()):
            if isinstance(v, (pd.Timestamp, datetime, date)):
                r[k] = pd.Timestamp(v).strftime("%Y-%m-%d")
            elif pd.isna(v) if not isinstance(v, (list, dict, str)) else False:
                r[k] = None
    return records
