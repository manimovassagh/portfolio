# pyright: reportGeneralTypeIssues=false
"""Market data routes: search, quote, price history, news."""
from __future__ import annotations

import time
from datetime import datetime, timezone

import requests
import yfinance as yf
from fastapi import APIRouter, HTTPException

router = APIRouter()

_search_cache: dict[str, tuple[float, list[dict]]] = {}
_SEARCH_TTL = 300  # 5 min


def _yahoo_search(q: str) -> list[dict]:
    cached = _search_cache.get(q)
    if cached and time.time() - cached[0] < _SEARCH_TTL:
        return cached[1]
    try:
        resp = requests.get(
            "https://query2.finance.yahoo.com/v1/finance/search",
            params={"q": q, "quotesCount": 8, "newsCount": 0},
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=8,
        )
        resp.raise_for_status()
        quotes = resp.json().get("quotes", [])
    except Exception:
        return []

    results = [
        {"ticker": q.get("symbol", ""), "name": q.get("shortname") or q.get("longname") or "", "type": q.get("quoteType", ""), "exchange": q.get("exchange", "")}
        for q in quotes
        if q.get("symbol") and q.get("quoteType") in ("EQUITY", "ETF", "MUTUALFUND", "CRYPTOCURRENCY", "CURRENCY")
    ]
    _search_cache[q] = (time.time(), results)
    return results


@router.get("/api/market/search")
def market_search(q: str) -> dict:
    if not q or len(q.strip()) < 1:
        return {"results": []}
    return {"results": _yahoo_search(q.strip())}


@router.get("/api/market/quote")
def market_quote(ticker: str) -> dict:
    try:
        t = yf.Ticker(ticker)
        fi = t.fast_info
        price      = getattr(fi, "last_price", None)
        prev_close = getattr(fi, "previous_close", None)
        day_high   = getattr(fi, "day_high", None)
        day_low    = getattr(fi, "day_low", None)
        wk52_high  = getattr(fi, "fifty_two_week_high", None)
        wk52_low   = getattr(fi, "fifty_two_week_low", None)
        mkt_cap    = getattr(fi, "market_cap", None)
        currency   = getattr(fi, "currency", None)
        volume     = getattr(fi, "three_month_average_volume", None)
    except Exception as exc:
        raise HTTPException(502, f"Could not fetch quote for {ticker}: {exc}") from exc

    change     = (price - prev_close) if price is not None and prev_close else None
    change_pct = (change / prev_close * 100) if change is not None and prev_close else None

    return {
        "ticker":     ticker,
        "price":      price,
        "prev_close": prev_close,
        "change":     change,
        "change_pct": change_pct,
        "day_high":   day_high,
        "day_low":    day_low,
        "wk52_high":  wk52_high,
        "wk52_low":   wk52_low,
        "market_cap": mkt_cap,
        "currency":   currency,
        "volume":     volume,
    }


_RANGE_PARAMS: dict[str, dict] = {
    "1D":  {"period": "1d",  "interval": "5m"},
    "1W":  {"period": "5d",  "interval": "15m"},
    "1M":  {"period": "1mo", "interval": "1d"},
    "6M":  {"period": "6mo", "interval": "1wk"},
    "1Y":  {"period": "1y",  "interval": "1wk"},
    "5Y":  {"period": "5y",  "interval": "1mo"},
}


@router.get("/api/market/history")
def market_history(ticker: str, range: str = "1M") -> dict:
    params = _RANGE_PARAMS.get(range, _RANGE_PARAMS["1M"])
    try:
        hist = yf.Ticker(ticker).history(**params, auto_adjust=False)
    except Exception as exc:
        raise HTTPException(502, f"Could not fetch history for {ticker}: {exc}") from exc

    if hist.empty:
        return {"series": []}

    series = [
        {
            "date": ts.strftime("%Y-%m-%dT%H:%M:%S") if params["interval"].endswith("m") else ts.strftime("%Y-%m-%d"),
            "close": round(float(row["Close"]), 4),
            "volume": int(row["Volume"]) if "Volume" in row and row["Volume"] == row["Volume"] else None,
        }
        for ts, row in hist.iterrows()
        if row["Close"] == row["Close"]  # skip NaN
    ]
    return {"series": series}


@router.get("/api/market/news")
def market_news(ticker: str) -> dict:
    try:
        raw = yf.Ticker(ticker).news or []
    except Exception:
        return {"news": []}

    articles = []
    for item in raw[:10]:
        content = item.get("content") or {}
        title     = content.get("title") or item.get("title", "")
        publisher = (content.get("provider") or {}).get("displayName") or item.get("publisher", "")
        link      = (content.get("canonicalUrl") or {}).get("url") or item.get("link", "")
        pub_ts    = content.get("pubDate") or None
        thumb     = None
        thumbnails = content.get("thumbnail") or {}
        if thumbnails:
            resolutions = thumbnails.get("resolutions") or []
            if resolutions:
                thumb = resolutions[0].get("url")

        pub_date: str | None = None
        if pub_ts:
            try:
                pub_date = datetime.fromisoformat(str(pub_ts).replace("Z", "+00:00")).strftime("%Y-%m-%d")
            except Exception:
                try:
                    pub_date = datetime.fromtimestamp(int(pub_ts), tz=timezone.utc).strftime("%Y-%m-%d")
                except Exception:
                    pass

        if title and link:
            articles.append({"title": title, "publisher": publisher, "link": link, "date": pub_date, "thumbnail": thumb})

    return {"news": articles}
