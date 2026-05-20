# pyright: reportGeneralTypeIssues=false
"""FastAPI entry point.

Thin bootstrapper — all routes live in app/routers/.
Run with:  make run
"""
from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
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


@app.get("/{full_path:path}", response_class=FileResponse)
def spa_fallback(full_path: str) -> FileResponse:
    """Serve the React app for client-side routes such as /tax or /analytics."""
    if full_path.startswith("api/"):
        raise HTTPException(404, "Not found")
    return FileResponse(BASE_DIR / "static" / "dist" / "index.html")
