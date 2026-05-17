# pyright: reportGeneralTypeIssues=false
"""FastAPI entry point.

Thin bootstrapper — all routes live in app/routers/.
Run with:  uv run uvicorn api:app --reload --port 8765
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.deps import BASE_DIR
from app.routers import analytics, core, portfolio, watchlist
from portfolio import db

app = FastAPI(title="Trade Republic Portfolio")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")
db.init(BASE_DIR / "portfolio.db")

app.include_router(core.router)
app.include_router(portfolio.router)
app.include_router(analytics.router)
app.include_router(watchlist.router)
