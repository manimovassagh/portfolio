"""Disk-based cache for yfinance historical OHLCV downloads.

Caches DataFrames as parquet files under CACHE_DIR (default: cache/).
TTL is controlled by HIST_CACHE_TTL env var (default: 3600 s = 1 hour).
"""
from __future__ import annotations

import hashlib
import logging
import os
import tempfile
import time
from pathlib import Path

import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)

_CACHE_DIR = Path(os.getenv("CACHE_DIR", "cache"))
_TTL = int(os.getenv("HIST_CACHE_TTL", "3600"))


def _cache_path(tickers: list[str], start: str, label: str) -> Path:
    key = f"{sorted(tickers)}|{start}|{label}"
    h = hashlib.sha256(key.encode()).hexdigest()[:16]
    return _CACHE_DIR / f"hist_{h}.parquet"


def download_cached(
    tickers: list[str] | str,
    start: str,
    label: str = "",
) -> pd.DataFrame:
    """Drop-in replacement for yf.download that caches results to disk.

    Args:
        tickers: single ticker string or list of tickers.
        start: start date string (YYYY-MM-DD).
        label: optional extra cache-key discriminator (e.g. "fx" or benchmark name).
    """
    ticker_list = [tickers] if isinstance(tickers, str) else sorted(tickers)
    path = _cache_path(ticker_list, start, label)

    if path.exists():
        age = time.time() - path.stat().st_mtime
        if age < _TTL:
            try:
                df = pd.read_parquet(path)
                logger.debug("cache hit: %s (age %.0fs)", path.name, age)
                return df
            except Exception as exc:
                logger.warning("corrupt cache entry %s: %s — re-downloading", path.name, exc)

    logger.debug("cache miss: downloading %s start=%s", ticker_list, start)
    if len(ticker_list) == 1:
        df = yf.download(ticker_list[0], start=start, auto_adjust=True, progress=False)
    else:
        df = yf.download(ticker_list, start=start, auto_adjust=True, progress=False)

    if df is not None and not df.empty:
        _CACHE_DIR.mkdir(parents=True, exist_ok=True)
        tmp: str | None = None
        try:
            fd, tmp = tempfile.mkstemp(dir=_CACHE_DIR, suffix=".parquet.tmp")
            os.close(fd)
            df.to_parquet(tmp)
            os.replace(tmp, path)  # atomic on POSIX
        except Exception as exc:
            logger.warning("could not write cache %s: %s", path.name, exc)
            if tmp is not None:
                try:
                    os.unlink(tmp)
                except OSError:
                    pass

    return df if df is not None else pd.DataFrame()


def clear_hist_cache() -> int:
    """Delete all hist_*.parquet files. Returns number of files deleted."""
    if not _CACHE_DIR.exists():
        return 0
    deleted = 0
    for p in _CACHE_DIR.glob("hist_*.parquet"):
        try:
            p.unlink()
            deleted += 1
        except Exception:
            pass
    return deleted
