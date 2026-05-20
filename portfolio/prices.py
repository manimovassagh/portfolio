# pyright: reportGeneralTypeIssues=false
"""Fetch current market prices by ISIN.

Strategy:
1. Look up ISIN → Yahoo ticker via Yahoo's search endpoint (cached forever once found).
2. Fetch the latest close from yfinance.
3. Cache prices to a local JSON for the day so reloads are instant.

For European ETFs we prefer XETRA (.DE) tickers as they're EUR-denominated.
"""
from __future__ import annotations

import json
import os
import time
from datetime import date
from pathlib import Path

import requests
import yfinance as yf

CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"
PRICE_CACHE_FILE = CACHE_DIR / "prices.json"
TICKER_MAP_FILE = CACHE_DIR / "isin_to_ticker.json"

# Pre-seeded mappings — covers the assets in your current export.
# Add new entries here, or let the search endpoint discover them.
# Prefer .DE (XETRA, EUR-denominated) tickers for ETFs and EU stocks so we don't
# need to FX-convert. US stocks fall back to USD which yfinance still returns.
KNOWN_TICKERS: dict[str, str] = {
    # ETFs (XETRA, EUR)
    "IE00B4L5Y983": "EUNL.DE",   # iShares Core MSCI World UCITS ETF USD (Acc)
    "IE00B5BMR087": "SXR8.DE",   # iShares Core S&P 500 UCITS ETF (Acc)
    "IE00BK5BQT80": "VWCE.DE",   # Vanguard FTSE All-World UCITS ETF (Acc)
    # IE000BI8OT95 (Amundi MSCI World) and IE00BFNM3J75 (iShares MSCI World ESG)
    # are auto-resolved via Yahoo search — XETRA tickers for those got delisted.
    # Stocks
    "DE0007664039": "VOW3.DE",   # Volkswagen Vz
    "US0378331005": "AAPL",      # Apple
    "US02079K1079": "GOOG",      # Alphabet (C)
    "US0231351067": "AMZN",      # Amazon
    "US30303M1027": "META",      # Meta
    "US7731211089": "RKLB",      # Rocket Lab
    # Crypto (Trade Republic uses BTC/ETH symbols, not ISINs)
    "BTC": "BTC-EUR",
    "ETH": "ETH-EUR",
}


def _load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return {}


def _save_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, sort_keys=True))


def search_ticker(isin: str) -> str | None:
    """Look up a Yahoo ticker for an ISIN via Yahoo Finance's search endpoint."""
    try:
        resp = requests.get(
            "https://query2.finance.yahoo.com/v1/finance/search",
            params={"q": isin, "quotesCount": 5, "newsCount": 0},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        return None

    quotes = data.get("quotes", [])
    # Prefer XETRA (.DE) tickers; fall back to first equity-like quote
    for q in quotes:
        sym = q.get("symbol", "")
        if sym.endswith(".DE"):
            return sym
    for q in quotes:
        sym = q.get("symbol", "")
        if sym and q.get("quoteType") in ("EQUITY", "ETF", "MUTUALFUND"):
            return sym
    return None


def resolve_tickers(isins: list[str]) -> dict[str, str]:
    """Return ISIN→ticker dict, discovering missing ones via Yahoo search."""
    mapping = {**KNOWN_TICKERS, **_load_json(TICKER_MAP_FILE)}
    dirty = False
    for isin in isins:
        if isin in mapping:
            continue
        found = search_ticker(isin)
        if found:
            mapping[isin] = found
            dirty = True
            time.sleep(0.2)  # be nice to Yahoo
    if dirty:
        _save_json(TICKER_MAP_FILE, {k: v for k, v in mapping.items() if k not in KNOWN_TICKERS})
    return {k: v for k, v in mapping.items() if k in isins}


def _fetch_fx_rate(from_ccy: str, to_ccy: str = "EUR") -> float:
    """Get spot FX. Returns 1.0 if conversion fails or currencies are equal."""
    if from_ccy == to_ccy:
        return 1.0
    pair = f"{from_ccy}{to_ccy}=X"
    try:
        hist = yf.Ticker(pair).history(period="5d", auto_adjust=False)
        if not hist.empty:
            return float(hist["Close"].iloc[-1])
    except Exception:
        pass
    return 1.0


def fetch_prices(isins: list[str], force_refresh: bool = False) -> dict[str, float]:
    """Fetch latest prices for the given ISINs, converted to EUR.

    Cached briefly so the dashboard can live-refresh without hammering Yahoo.
    """
    if not isins:
        return {}

    cache = _load_json(PRICE_CACHE_FILE)
    today = date.today().isoformat()
    ttl_seconds = int(os.environ.get("PRICE_REFRESH_SECONDS", "60"))
    fetched_at = float(cache.get("_fetched_at", 0) or 0)
    cache_is_fresh = time.time() - fetched_at < ttl_seconds

    if not force_refresh and cache.get("_date") == today and cache_is_fresh:
        cached_prices = cache.get("prices", {})
        if all(isin in cached_prices for isin in isins):
            return {isin: float(cached_prices[isin]) for isin in isins}

    tickers_map = resolve_tickers(isins)
    prices: dict[str, float] = {}
    fx_cache: dict[str, float] = {}

    for isin, ticker in tickers_map.items():
        try:
            t = yf.Ticker(ticker)
            hist = t.history(period="5d", auto_adjust=False)
            if hist.empty:
                continue
            raw = float(hist["Close"].iloc[-1])

            # Determine currency. yfinance exposes it via `fast_info.currency`.
            try:
                ccy = (t.fast_info.get("currency") or "EUR").upper()
            except Exception:
                ccy = "EUR"

            if ccy != "EUR":
                if ccy not in fx_cache:
                    fx_cache[ccy] = _fetch_fx_rate(ccy, "EUR")
                raw *= fx_cache[ccy]

            prices[isin] = raw
        except Exception:
            continue

    if prices:
        merged = {**cache.get("prices", {}), **prices}
        _save_json(PRICE_CACHE_FILE, {"_date": today, "_fetched_at": time.time(), "prices": merged})

    return prices
