# Advanced Modular CI/CD Pipeline — Design Spec
**Date:** 2026-05-22  
**Status:** Approved  
**Scope:** GitHub Actions — no deployment stage (deferred)

---

## Problem Statement

The existing 3-workflow setup (`ci.yml`, `docker-image.yml`, `e2e.yml`) has critical gaps:
- No caching (Go modules, npm, uv, Docker layers)
- No linting (golangci-lint, ESLint)
- Python pytest exists in `pricer/tests/` but CI never runs it (issue #61)
- `docker-image.yml` uses `checkout@v6` (non-existent), builds one image for a 3-service stack
- No path filtering — every push runs all jobs regardless of what changed
- No single branch-protection gate job
- E2E has no dependency on CI passing

---

## Architecture

### Design Principle
Every service is a self-contained `workflow_call` reusable block. Orchestrators compose these blocks with path filters and concurrency controls. No block has an event trigger — they only respond to `workflow_call`. This means:
- Each block has one responsibility
- Blocks cannot accidentally trigger on pushes
- Orchestrators own all scheduling logic
- A single `summary` job in `ci.yml` is the only required branch protection rule

### File Map

```
.github/
├── workflows/
│   │
│   │  ── Reusable blocks ──────────────────────────────
│   ├── _go.yml              # golangci-lint + vet + test + build
│   ├── _python.yml          # uv sync + pyright + pytest
│   ├── _frontend.yml        # ESLint + typecheck + vitest + vite build
│   ├── _mobile.yml          # typecheck + expo-doctor
│   ├── _docker-service.yml  # build + push ONE image (parameterised)
│   ├── _e2e.yml             # Playwright against built client
│   │
│   │  ── Orchestrators ─────────────────────────────────
│   ├── ci.yml               # PR/push → blocks w/ path filters + summary gate
│   ├── docker.yml           # release/dispatch → _docker-service ×3 in parallel
│   └── release.yml          # tag push → ci → docker → e2e (sequential)
```

---

## Reusable Blocks

### `_go.yml`
**Trigger:** `workflow_call`  
**Inputs:** none (reads `backend/go.mod` for Go version)  
**Steps:**
1. `actions/checkout@v4`
2. `actions/setup-go@v5` with `go-version-file: backend/go.mod`
3. `actions/cache` keyed on `go-${{ hashFiles('**/go.sum') }}`
4. `golangci/golangci-lint-action@v6` — runs `.golangci.yml` if present, else defaults
5. `go vet ./...`
6. `go test ./... -race -count=1 -coverprofile=coverage.out`
7. `actions/upload-artifact` — coverage report
8. `go build ./cmd/api`

### `_python.yml`
**Trigger:** `workflow_call`  
**Inputs:** none  
**Steps:**
1. `actions/checkout@v4`
2. `astral-sh/setup-uv@v5`
3. `actions/cache` keyed on `uv-${{ hashFiles('uv.lock') }}`
4. `uv sync`
5. `uv run pyright pricer/main.py`
6. `uv run pytest pricer/tests/ -v --tb=short` ← **fixes issue #61**

### `_frontend.yml`
**Trigger:** `workflow_call`  
**Inputs:** none  
**Steps:**
1. `actions/checkout@v4`
2. `actions/setup-node@v4` (`node-version: "20"`) with npm cache
3. `npm ci` (working-directory: `client`)
4. `npm run typecheck`
5. `npx eslint src/ --max-warnings 0`
6. `npm test`
7. `npm run build`
8. `actions/upload-artifact` — dist bundle (used by `_e2e.yml`)

### `_mobile.yml`
**Trigger:** `workflow_call`  
**Inputs:** none  
**Steps:**
1. `actions/checkout@v4`
2. `actions/setup-node@v4` with npm cache (separate key from client)
3. `npm ci` (working-directory: `mobile`)
4. `npx tsc --noEmit` (working-directory: `mobile`)
5. `npx expo-doctor` — non-blocking (`continue-on-error: true`)

### `_docker-service.yml`
**Trigger:** `workflow_call`  
**Inputs:**
- `service` (string) — used as GHA cache scope
- `dockerfile` (string) — e.g. `Dockerfile.backend`
- `image-name` (string) — e.g. `ghcr.io/owner/repo/backend`

**Secrets:** `GITHUB_TOKEN` (inherited)  
**Steps:**
1. `actions/checkout@v4`
2. `docker/setup-buildx-action@v3`
3. `docker/login-action@v3` → ghcr.io
4. `docker/metadata-action@v5` → tags: `sha-<short>`, `latest` (on release), semver (on tag)
5. `docker/build-push-action@v6`
   - `cache-from: type=gha,scope=${{ inputs.service }}`
   - `cache-to: type=gha,scope=${{ inputs.service }},mode=max`
   - `push: true`

**Note:** `scope` per service prevents cache eviction across images. `mode=max` caches all intermediate layers.

### `_e2e.yml`
**Trigger:** `workflow_call`  
**Steps:**
1. `actions/checkout@v4`
2. `actions/setup-node@v4` with npm cache
3. `npm ci` (working-directory: `client`)
4. `npx playwright install chromium --with-deps`
5. `npm run test:e2e` (working-directory: `client`)
6. `actions/upload-artifact` — `playwright-report/` (always)
7. `actions/upload-artifact` — `test-results/` (on failure only)

---

## Orchestrators

### `ci.yml`
**Triggers:** `push` to `main`, `pull_request` to `main`  
**Concurrency:** `ci-${{ github.ref }}` — cancel-in-progress on PRs  
**Permissions:** `contents: read`

```
jobs:
  go:        uses: ./.github/workflows/_go.yml
             if: changed files match backend/** or go.work
  python:    uses: ./.github/workflows/_python.yml
             if: changed files match pricer/**
  frontend:  uses: ./.github/workflows/_frontend.yml
             if: changed files match client/**
  mobile:    uses: ./.github/workflows/_mobile.yml
             if: changed files match mobile/**
  summary:   runs-on: ubuntu-latest
             needs: [go, python, frontend, mobile]
             if: always()
             → fails if any needed job failed or was cancelled
             → this is the ONLY required check for branch protection
```

Path filtering via `dorny/paths-filter@v3` action — outputs booleans consumed by job `if:` conditions.

### `docker.yml`
**Triggers:** `workflow_dispatch`, `release` (types: published), `workflow_call`  
**Permissions:** `contents: read`, `packages: write`

Adding `workflow_call` lets `release.yml` call `docker.yml` directly rather than duplicating the matrix logic. A single workflow can respond to multiple trigger types simultaneously.

```
jobs:
  build:
    strategy:
      matrix:
        include:
          - service: backend
            dockerfile: Dockerfile.backend
            image: ghcr.io/${{ github.repository }}/backend
          - service: pricer
            dockerfile: Dockerfile.pricer
            image: ghcr.io/${{ github.repository }}/pricer
          - service: frontend
            dockerfile: Dockerfile.frontend
            image: ghcr.io/${{ github.repository }}/frontend
    uses: ./.github/workflows/_docker-service.yml
    with:
      service: ${{ matrix.service }}
      dockerfile: ${{ matrix.dockerfile }}
      image-name: ${{ matrix.image }}
    secrets: inherit
```

All 3 images build in parallel. Each gets its own GHA cache scope.

### `release.yml`
**Triggers:** `push` to tags matching `v*.*.*`  
**Jobs (sequential):**
1. `ci` — calls `_go.yml`, `_python.yml`, `_frontend.yml`, `_mobile.yml` (all, no path filter — full suite on release)
2. `docker` — needs `ci`, calls `docker.yml` via `workflow_call` (matrix ×3 runs inside docker.yml)
3. `e2e` — needs `docker`, calls `_e2e.yml`

---

## Caching Strategy

| Layer | Cache Key | Action |
|-------|-----------|--------|
| Go modules | `go-${{ hashFiles('**/go.sum') }}` | `actions/cache` |
| npm (client) | `npm-client-${{ hashFiles('client/package-lock.json') }}` | `setup-node` built-in |
| npm (mobile) | `npm-mobile-${{ hashFiles('mobile/package-lock.json') }}` | `setup-node` built-in |
| uv/Python | `uv-${{ hashFiles('uv.lock') }}` | `actions/cache` |
| Docker layers | GHA cache scoped per service | `build-push-action` |

---

## Branch Protection

Set **one** required status check: `summary` from `ci.yml`.

The `summary` job always runs (`if: always()`) and explicitly fails when any upstream job failed or was cancelled. This single gate covers all 4 service checks without needing to enumerate individual jobs in GitHub Settings — which would break every time a job is renamed.

---

## Issues Closed by This Pipeline

| Issue | Fix |
|-------|-----|
| #61 Python pricer: add pytest unit tests | `_python.yml` runs `pytest pricer/tests/` |
| #39 CI/CD pipeline (lint, test, build, docker push) | Full rewrite with all gaps filled |

---

## What Is Explicitly Out of Scope

- Deployment stage (SSH, Kubernetes, cloud) — deferred
- Mobile binary builds (EAS Build) — deferred  
- Performance/load testing — deferred
- Notification integrations (Slack, email) — deferred
