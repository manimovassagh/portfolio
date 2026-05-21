from __future__ import annotations

from fastapi import FastAPI, Query

from .prices import fetch_prices

app = FastAPI(title="pricer", docs_url=None, redoc_url=None)


@app.get("/prices")
def get_prices(isins: str = Query(..., description="Comma-separated ISIN list")) -> dict[str, float]:
    isin_list = [i.strip() for i in isins.split(",") if i.strip()]
    return fetch_prices(isin_list)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
