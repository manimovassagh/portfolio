from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, Query

from .prices import fetch_prices

logger = logging.getLogger(__name__)
app = FastAPI(title="pricer", docs_url=None, redoc_url=None)


@app.get("/prices")
def get_prices(isins: str = Query(..., description="Comma-separated ISIN list")) -> dict[str, float]:
    isin_list = [i.strip() for i in isins.split(",") if i.strip()]
    try:
        return fetch_prices(isin_list)
    except Exception as exc:
        logger.exception("fetch_prices failed: %s", exc)
        raise HTTPException(status_code=503, detail="price fetch failed") from exc


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
