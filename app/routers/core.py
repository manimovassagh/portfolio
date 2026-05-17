# pyright: reportGeneralTypeIssues=false
"""Core routes: SPA entry point, export listing, CSV upload."""
from __future__ import annotations

import os

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.deps import BASE_DIR, clear_cache
from portfolio import loader

router = APIRouter()
templates = Jinja2Templates(directory=BASE_DIR / "templates")

_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


@router.get("/", response_class=HTMLResponse)
def index(request: Request) -> HTMLResponse:
    return templates.TemplateResponse(request, "index.html")


@router.get("/api/exports")
def list_exports() -> dict:
    return {"exports": [p.name for p in loader.list_exports()]}


@router.post("/api/upload")
async def upload_export(file: UploadFile = File(...)) -> dict:
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only CSV files are accepted")
    safe_name = os.path.basename(file.filename)
    if not safe_name or ".." in safe_name:
        raise HTTPException(400, "Invalid filename")
    content = await file.read()
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(413, "File too large (max 10 MB)")
    loader.EXPORTS_DIR.mkdir(exist_ok=True)
    (loader.EXPORTS_DIR / safe_name).write_bytes(content)
    clear_cache()
    return {"filename": safe_name, "exports": [p.name for p in loader.list_exports()]}
