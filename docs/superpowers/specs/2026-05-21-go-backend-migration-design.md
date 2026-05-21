# Go Backend Migration Design

**Date:** 2026-05-21
**Status:** Approved

## Overview

Migrate the portfolio dashboard backend from Python/FastAPI to Go/Gin, while keeping Python as a dedicated price-fetching microservice (since yfinance has no mature Go equivalent). The React frontend stays, with Zod validation added once all routes are migrated. Migration is incremental — one route at a time, one commit per route, app stays working throughout.

---

## Architecture

```
┌─────────────────────────────────────────┐
│              React + TypeScript         │
│              + Zod (added last)         │
└────────────────────┬────────────────────┘
                     │ HTTPS
┌────────────────────▼────────────────────┐
│           Go / Gin  (port 8765)         │
│  cmd/api/main.go  ← entry point         │
│  internal/handler/  ← thin HTTP layer   │
│  internal/service/  ← all business logic│
│  internal/db/       ← SQLite queries    │
│  internal/pricer/   ← calls Python      │
│  internal/model/    ← shared types      │
│  internal/config/   ← env/config        │
│  internal/middleware/ ← CORS, logging   │
└──────────┬──────────────────────────────┘
           │ HTTP  /prices?isins=...
┌──────────▼──────────────────────────────┐
│      Python Pricer  (port 8001)         │
│  pricer/main.py    ← FastAPI, 1 route   │
│  pricer/prices.py  ← yfinance logic     │
└─────────────────────────────────────────┘
           │
      SQLite portfolio.db (shared, read-only from Go)
```

---

## Repository Structure

```
portfolio/                        (monorepo, same repo)
├── backend/
│   ├── cmd/
│   │   └── api/
│   │       └── main.go           # wires config, db, routes
│   ├── internal/
│   │   ├── config/
│   │   │   └── config.go         # env vars: PORT, DB_PATH, PRICER_URL
│   │   ├── db/
│   │   │   ├── db.go             # open connection, WAL mode
│   │   │   └── queries.go        # typed SQL helpers
│   │   ├── model/
│   │   │   └── types.go          # Holding, Transaction, WatchlistItem, etc.
│   │   ├── pricer/
│   │   │   └── client.go         # GET pricer /prices, returns map[string]float64
│   │   ├── service/
│   │   │   ├── holdings.go       # cost basis, P&L, weight calc
│   │   │   ├── portfolio.go      # overview aggregation
│   │   │   ├── analytics.go      # allocation breakdown, performance
│   │   │   └── watchlist.go      # CRUD against SQLite watchlist table
│   │   ├── handler/
│   │   │   ├── holdings.go       # GET /api/holdings
│   │   │   ├── portfolio.go      # GET /api/portfolio
│   │   │   ├── analytics.go      # GET /api/analytics
│   │   │   ├── watchlist.go      # GET/POST/DELETE /api/watchlist
│   │   │   ├── market.go         # GET /api/market/quote, /api/market/news
│   │   │   └── core.go           # GET /api/health, /api/exports
│   │   └── middleware/
│   │       └── middleware.go     # CORS, request logging, panic recovery
│   ├── go.mod
│   ├── go.sum
│   └── Makefile                  # build, run, test, lint targets
├── pricer/
│   ├── main.py                   # FastAPI app, single /prices route
│   └── prices.py                 # current prices.py, unchanged
├── src/                          # React frontend, unchanged until Zod step
├── Makefile                      # root orchestrator
├── docker-compose.yml            # 3 services: go, pricer, vite/nginx
└── pyproject.toml                # pricer only (stripped)
```

---

## Migration Order

Each step = working app + committed code.

| Step | What | Commit message |
|------|------|----------------|
| 1 | Extract Python pricer microservice | `feat: extract pricer as standalone FastAPI microservice` |
| 2 | Scaffold Go module, Gin, Makefile, middleware | `feat: scaffold go backend with gin and middleware` |
| 3 | Go `core.go` — health + exports | `feat(go): health and exports endpoints` |
| 4 | Go `holdings.go` — holdings list + asset detail | `feat(go): holdings and asset detail endpoints` |
| 5 | Go `portfolio.go` — overview/dashboard data | `feat(go): portfolio overview endpoint` |
| 6 | Go `analytics.go` — allocation + performance | `feat(go): analytics endpoints` |
| 7 | Go `watchlist.go` — watchlist CRUD | `feat(go): watchlist endpoints` |
| 8 | Go `market.go` — quote + news (calls pricer) | `feat(go): market quote and news endpoints` |
| 9 | Remove Python `app/` and `portfolio/` | `chore: remove python backend` |
| 10 | Add Zod to React frontend | `feat(frontend): zod validation on all api responses` |

---

## Key Technical Decisions

### Go Framework: Gin
- Maps cleanly to current FastAPI router pattern via `router.Group()`
- ~80k GitHub stars, largest Go web framework community
- Standard `net/http` compatible

### Database: SQLite (keep existing)
- `mattn/go-sqlite3` driver, WAL mode enabled for concurrent reads
- Go opens DB read-only; Python pricer never touches it
- Same `portfolio.db` file, no migration needed

### Pricer Communication: HTTP/JSON
- Go calls `GET http://pricer:8001/prices?isins=ISIN1,ISIN2`
- Pricer returns `{"IE00B4L5Y983": 121.35, ...}`
- 10s timeout, cached at Go service layer (60s TTL, same as current)

### Config
- All via environment variables, no config files
- `PORT`, `DB_PATH`, `PRICER_URL`, `TLS_CERT`, `TLS_KEY`

### Error Handling
- Services return `(value, error)` — Go idiomatic
- Handlers translate errors to HTTP status codes
- No panics in handlers; middleware recovers and logs

### Makefile Targets (backend/)
```makefile
make build    # go build ./cmd/api
make run      # go run ./cmd/api
make test     # go test ./...
make lint     # golangci-lint run
make tidy     # go mod tidy
```

### Makefile Targets (root)
```makefile
make run      # pricer + go backend + vite dev server
make build    # go build + vite production build
make docker   # docker-compose up --build
```

### Frontend: Zod (step 10)
- Added after all Go routes are live
- Each API response type in `src/types.ts` gets a matching Zod schema
- `src/api.ts` parses every response through its schema before returning
- Runtime type errors surface immediately in dev, not as silent `null` values

---

## Docker Compose (3 services)

```yaml
services:
  pricer:
    build: ./pricer
    ports: ["8001:8001"]

  api:
    build: ./backend
    ports: ["8765:8765"]
    depends_on: [pricer]
    environment:
      PRICER_URL: http://pricer:8001

  frontend:         # dev: vite  |  prod: nginx serving static/dist
    build: .
    ports: ["5173:5173"]
```

---

## What Does NOT Change

- `portfolio.db` — same file, same schema
- `exports/` CSV format — Go reads same format as Python
- `src/` React components — zero changes until Zod step
- All existing API response shapes — Go returns identical JSON
- TLS certs — Go serves HTTPS same as current uvicorn setup
