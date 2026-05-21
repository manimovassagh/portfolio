"""Pytest suite for the pricer FastAPI service.

All tests run without making real network calls — yfinance and requests are
never invoked because empty transaction lists short-circuit before any download,
and the /prices endpoint returns {} immediately for an empty ISIN list.
"""
from __future__ import annotations

from fastapi.testclient import TestClient

from pricer.main import app, _is_eur_ticker

client = TestClient(app)


# ---------------------------------------------------------------------------
# 1. GET /prices — empty ISIN list returns {}
# ---------------------------------------------------------------------------

def test_prices_empty_isins():
    """Passing an empty string for isins yields an empty price dict."""
    # fetch_prices([]) returns {} immediately without touching yfinance
    response = client.get("/prices", params={"isins": ""})
    assert response.status_code == 200
    assert response.json() == {}


# ---------------------------------------------------------------------------
# 2. GET /health
# ---------------------------------------------------------------------------

def test_health():
    """Health endpoint returns 200 and status ok."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


# ---------------------------------------------------------------------------
# 3. POST /portfolio_analytics — empty transactions
# ---------------------------------------------------------------------------

def test_portfolio_analytics_empty_transactions():
    """Empty transaction list returns a zero-valued analytics response."""
    response = client.post("/portfolio_analytics", json={"transactions": []})
    assert response.status_code == 200
    body = response.json()
    assert body["sharpe"] is None
    assert body["volatility"] is None
    assert body["monthly"] == {}
    assert body["annual"] == []


# ---------------------------------------------------------------------------
# 4. POST /portfolio_performance — empty transactions
# ---------------------------------------------------------------------------

def test_portfolio_performance_empty_transactions():
    """Empty transaction list returns empty series, drawdown, and twr."""
    response = client.post("/portfolio_performance", json={"transactions": []})
    assert response.status_code == 200
    body = response.json()
    assert body["series"] == []
    assert body["drawdown"] == []
    assert body["twr"] == []


# ---------------------------------------------------------------------------
# 5. _is_eur_ticker helper
# ---------------------------------------------------------------------------

def test_is_eur_ticker():
    """EUR-denominated tickers are correctly identified."""
    assert _is_eur_ticker("BMW.DE") is True
    assert _is_eur_ticker("AIR.PA") is True
    assert _is_eur_ticker("AAPL") is False
    assert _is_eur_ticker("BTC-EUR") is True


# ---------------------------------------------------------------------------
# 6. POST /portfolio_analytics — invalid body returns 422
# ---------------------------------------------------------------------------

def test_portfolio_analytics_rejects_bad_body():
    """A non-list value for transactions triggers a 422 Unprocessable Entity."""
    response = client.post("/portfolio_analytics", json={"transactions": "not-a-list"})
    assert response.status_code == 422
