# Plan A: Python Pricer Microservice

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the yfinance price-fetching logic into a standalone FastAPI microservice at `pricer/` that exposes a single `GET /prices?isins=...` endpoint, leaving the existing Python app untouched.

**Architecture:** The pricer is a thin FastAPI wrapper around the existing `prices.py` module. It runs on port 8001. The existing app keeps working unchanged — this is purely additive.

**Tech Stack:** Python 3.12, FastAPI, uvicorn, yfinance (all already installed)

---

### Task 1: Create pricer directory and copy prices module

**Files:**
- Create: `pricer/__init__.py`
- Create: `pricer/prices.py` (copy of `portfolio/prices.py`)
- Create: `pricer/main.py`

- [ ] **Step 1: Create pricer directory**

```bash
mkdir -p pricer
touch pricer/__init__.py
```

- [ ] **Step 2: Copy prices.py into pricer**

```bash
cp portfolio/prices.py pricer/prices.py
```

- [ ] **Step 3: Create `pricer/main.py`**

```python
from __future__ import annotations

from fastapi import FastAPI, Query
from fastapi.responses import JSONResponse

from .prices import fetch_prices

app = FastAPI(title="pricer", docs_url=None, redoc_url=None)


@app.get("/prices")
def get_prices(isins: str = Query(..., description="Comma-separated ISIN list")) -> dict[str, float]:
    isin_list = [i.strip() for i in isins.split(",") if i.strip()]
    return fetch_prices(isin_list)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 4: Test it manually**

```bash
cd /path/to/portfolio
uv run uvicorn pricer.main:app --port 8001 &
sleep 3
curl "http://localhost:8001/prices?isins=IE00BK5BQT80,BTC"
# Expected: {"IE00BK5BQT80": 159.76, "BTC": 66423.0}
curl "http://localhost:8001/health"
# Expected: {"status": "ok"}
pkill -f "uvicorn pricer"
```

- [ ] **Step 5: Commit**

```bash
git add pricer/
git commit -m "feat: extract pricer as standalone FastAPI microservice"
```

---

### Task 2: Add pricer to root Makefile

**Files:**
- Modify: `Makefile`

- [ ] **Step 1: Read current Makefile targets**

```bash
cat Makefile
```

- [ ] **Step 2: Add pricer target**

Add this to the Makefile (adjust indentation to match existing style — must be tabs not spaces):

```makefile
run-pricer:
	uv run uvicorn pricer.main:app --host 0.0.0.0 --port 8001

run-all: run-pricer run
```

- [ ] **Step 3: Test**

```bash
make run-pricer &
sleep 3
curl "http://localhost:8001/health"
# Expected: {"status": "ok"}
pkill -f "uvicorn pricer"
```

- [ ] **Step 4: Commit**

```bash
git add Makefile
git commit -m "feat: add pricer makefile targets"
```
