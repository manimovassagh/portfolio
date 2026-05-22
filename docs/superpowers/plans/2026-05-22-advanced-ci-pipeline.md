# Advanced Modular CI/CD Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three flat workflow files with fully atomic reusable blocks — one file, one job — wired together by intelligent orchestrators with path filtering, caching, and a single branch-protection gate.

**Architecture:** Every CI concern is its own `workflow_call`-only file. Go gets 3 blocks (lint, test, build), Python gets 2 (lint, test), Frontend gets 3 (lint, test, build), Mobile gets 1, Docker gets 1 (parameterised), E2E gets 1. Orchestrators (`ci`, `docker`, `release`) compose these blocks like Lego — each block is independently callable and testable.

**Tech Stack:** GitHub Actions, `dorny/paths-filter@v3`, `golangci/golangci-lint-action@v6`, `astral-sh/setup-uv@v5`, `docker/build-push-action@v6`, `actionlint` (local validation)

---

## Completed

- [x] Task 1: actionlint v1.7.12 installed
- [x] Task 2: ESLint added to frontend (`client/package.json` + `eslint.config.js`), pushed

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `.github/workflows/_go-lint.yml` | golangci-lint + go vet |
| Create | `.github/workflows/_go-test.yml` | go test -race + coverage |
| Create | `.github/workflows/_go-build.yml` | go build |
| Create | `.github/workflows/_python-lint.yml` | pyright |
| Create | `.github/workflows/_python-test.yml` | pytest |
| Create | `.github/workflows/_frontend-lint.yml` | ESLint + tsc typecheck |
| Create | `.github/workflows/_frontend-test.yml` | vitest |
| Create | `.github/workflows/_frontend-build.yml` | vite build + upload dist |
| Create | `.github/workflows/_mobile-check.yml` | tsc + expo-doctor |
| Create | `.github/workflows/_docker-service.yml` | build + push one image |
| Create | `.github/workflows/_e2e.yml` | Playwright |
| Rewrite | `.github/workflows/ci.yml` | orchestrator: path filter + all blocks + summary gate |
| Create | `.github/workflows/docker.yml` | orchestrator: matrix × 3 Docker builds |
| Create | `.github/workflows/release.yml` | orchestrator: full suite → docker → e2e on tags |
| Delete | `.github/workflows/docker-image.yml` | superseded |
| Delete | `.github/workflows/e2e.yml` | superseded |

---

## Task 3: Create `_go-lint.yml`

**Files:** Create `.github/workflows/_go-lint.yml`

- [ ] **Step 1: Create the file**

```yaml
name: "Go — lint"

on:
  workflow_call:

jobs:
  go-lint:
    name: Go Lint
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version-file: backend/go.mod
          cache-dependency-path: backend/go.sum

      - name: golangci-lint
        uses: golangci/golangci-lint-action@v6
        with:
          working-directory: backend
          args: --timeout 5m

      - name: go vet
        run: go vet ./...
```

- [ ] **Step 2: Validate**

```bash
actionlint .github/workflows/_go-lint.yml
```

Expected: no output

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/_go-lint.yml
git commit -m "ci: add _go-lint.yml block (golangci-lint + vet)"
git push origin main
```

---

## Task 4: Create `_go-test.yml`

**Files:** Create `.github/workflows/_go-test.yml`

- [ ] **Step 1: Create the file**

```yaml
name: "Go — test"

on:
  workflow_call:

jobs:
  go-test:
    name: Go Test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version-file: backend/go.mod
          cache-dependency-path: backend/go.sum

      - name: go test
        run: go test ./... -race -count=1 -coverprofile=coverage.out

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: go-coverage
          path: backend/coverage.out
          retention-days: 7
```

- [ ] **Step 2: Validate**

```bash
actionlint .github/workflows/_go-test.yml
```

Expected: no output

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/_go-test.yml
git commit -m "ci: add _go-test.yml block (go test -race + coverage artifact)"
git push origin main
```

---

## Task 5: Create `_go-build.yml`

**Files:** Create `.github/workflows/_go-build.yml`

- [ ] **Step 1: Create the file**

```yaml
name: "Go — build"

on:
  workflow_call:

jobs:
  go-build:
    name: Go Build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-go@v5
        with:
          go-version-file: backend/go.mod
          cache-dependency-path: backend/go.sum

      - name: go build
        run: go build ./cmd/api
```

- [ ] **Step 2: Validate**

```bash
actionlint .github/workflows/_go-build.yml
```

Expected: no output

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/_go-build.yml
git commit -m "ci: add _go-build.yml block"
git push origin main
```

---

## Task 6: Create `_python-lint.yml`

**Files:** Create `.github/workflows/_python-lint.yml`

- [ ] **Step 1: Create the file**

```yaml
name: "Python — lint"

on:
  workflow_call:

jobs:
  python-lint:
    name: Python Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: astral-sh/setup-uv@v5
        with:
          enable-cache: true
          cache-dependency-glob: "uv.lock"

      - name: Install dependencies
        run: uv sync

      - name: Pyright
        run: uv run pyright pricer/main.py
```

- [ ] **Step 2: Validate**

```bash
actionlint .github/workflows/_python-lint.yml
```

Expected: no output

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/_python-lint.yml
git commit -m "ci: add _python-lint.yml block (pyright)"
git push origin main
```

---

## Task 7: Create `_python-test.yml`

**Files:** Create `.github/workflows/_python-test.yml`

- [ ] **Step 1: Create the file**

```yaml
name: "Python — test"

on:
  workflow_call:

jobs:
  python-test:
    name: Python Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: astral-sh/setup-uv@v5
        with:
          enable-cache: true
          cache-dependency-glob: "uv.lock"

      - name: Install dependencies
        run: uv sync

      - name: pytest
        run: uv run pytest pricer/tests/ -v --tb=short
```

- [ ] **Step 2: Validate**

```bash
actionlint .github/workflows/_python-test.yml
```

Expected: no output

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/_python-test.yml
git commit -m "ci: add _python-test.yml block (pytest)"
git push origin main
```

---

## Task 8: Create `_frontend-lint.yml`

**Files:** Create `.github/workflows/_frontend-lint.yml`

- [ ] **Step 1: Create the file**

```yaml
name: "Frontend — lint"

on:
  workflow_call:

jobs:
  frontend-lint:
    name: Frontend Lint
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: client
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: client/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: TypeScript typecheck
        run: npm run typecheck

      - name: ESLint
        run: npm run lint
```

- [ ] **Step 2: Validate**

```bash
actionlint .github/workflows/_frontend-lint.yml
```

Expected: no output

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/_frontend-lint.yml
git commit -m "ci: add _frontend-lint.yml block (ESLint + typecheck)"
git push origin main
```

---

## Task 9: Create `_frontend-test.yml`

**Files:** Create `.github/workflows/_frontend-test.yml`

- [ ] **Step 1: Create the file**

```yaml
name: "Frontend — test"

on:
  workflow_call:

jobs:
  frontend-test:
    name: Frontend Test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: client
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: client/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Vitest
        run: npm test
```

- [ ] **Step 2: Validate**

```bash
actionlint .github/workflows/_frontend-test.yml
```

Expected: no output

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/_frontend-test.yml
git commit -m "ci: add _frontend-test.yml block (vitest)"
git push origin main
```

---

## Task 10: Create `_frontend-build.yml`

**Files:** Create `.github/workflows/_frontend-build.yml`

- [ ] **Step 1: Create the file**

```yaml
name: "Frontend — build"

on:
  workflow_call:

jobs:
  frontend-build:
    name: Frontend Build
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: client
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: client/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Vite build
        run: npm run build

      - name: Upload dist
        uses: actions/upload-artifact@v4
        with:
          name: frontend-dist
          path: client/dist/
          retention-days: 1
```

- [ ] **Step 2: Validate**

```bash
actionlint .github/workflows/_frontend-build.yml
```

Expected: no output

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/_frontend-build.yml
git commit -m "ci: add _frontend-build.yml block (vite build + dist artifact)"
git push origin main
```

---

## Task 11: Create `_mobile-check.yml`

**Files:** Create `.github/workflows/_mobile-check.yml`

- [ ] **Step 1: Create the file**

```yaml
name: "Mobile — check"

on:
  workflow_call:

jobs:
  mobile-check:
    name: Mobile Check
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: mobile
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: mobile/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: TypeScript typecheck
        run: npx tsc --noEmit

      - name: Expo Doctor
        run: npx expo-doctor
        continue-on-error: true
```

- [ ] **Step 2: Validate**

```bash
actionlint .github/workflows/_mobile-check.yml
```

Expected: no output

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/_mobile-check.yml
git commit -m "ci: add _mobile-check.yml block (tsc + expo-doctor)"
git push origin main
```

---

## Task 12: Create `_docker-service.yml`

**Files:** Create `.github/workflows/_docker-service.yml`

Builds and pushes ONE Docker image. Receives `service` and `dockerfile` as inputs, constructs the GHCR image name internally (lowercased to satisfy GHCR requirements). GHA cache is scoped per service so backend/pricer/frontend layers never evict each other.

- [ ] **Step 1: Create the file**

```yaml
name: "Docker — build and push service image"

on:
  workflow_call:
    inputs:
      service:
        required: true
        type: string
        description: "Service name: backend | pricer | frontend"
      dockerfile:
        required: true
        type: string
        description: "Dockerfile path relative to repo root, e.g. Dockerfile.backend"

permissions:
  contents: read
  packages: write

jobs:
  build:
    name: "Build ${{ inputs.service }}"
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Lowercase image name
        id: image
        run: |
          echo "name=ghcr.io/${GITHUB_REPOSITORY,,}/${{ inputs.service }}" >> "$GITHUB_OUTPUT"

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ steps.image.outputs.name }}
          tags: |
            type=sha,prefix=sha-
            type=raw,value=latest,enable=${{ github.event_name == 'release' }}
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          file: ${{ inputs.dockerfile }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha,scope=${{ inputs.service }}
          cache-to: type=gha,scope=${{ inputs.service }},mode=max
```

- [ ] **Step 2: Validate**

```bash
actionlint .github/workflows/_docker-service.yml
```

Expected: no output

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/_docker-service.yml
git commit -m "ci: add _docker-service.yml block (parameterised build+push, scoped GHA cache)"
git push origin main
```

---

## Task 13: Create `_e2e.yml`

**Files:** Create `.github/workflows/_e2e.yml`

- [ ] **Step 1: Create the file**

```yaml
name: "E2E — Playwright"

on:
  workflow_call:

jobs:
  e2e:
    name: Playwright E2E
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: client
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: client/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: client/playwright-report/
          retention-days: 7

      - name: Upload failure screenshots
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-screenshots
          path: client/test-results/
          retention-days: 7
```

- [ ] **Step 2: Validate**

```bash
actionlint .github/workflows/_e2e.yml
```

Expected: no output

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/_e2e.yml
git commit -m "ci: add _e2e.yml block (Playwright + artifact upload)"
git push origin main
```

---

## Task 14: Rewrite `ci.yml` — main orchestrator

**Files:** Rewrite `.github/workflows/ci.yml`

Path filter detects which service changed. Each atomic block is called only when relevant. The `summary` job always runs — it's the single required branch-protection check.

- [ ] **Step 1: Overwrite `ci.yml` completely**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

permissions:
  contents: read

jobs:
  changes:
    name: Detect changed paths
    runs-on: ubuntu-latest
    outputs:
      backend: ${{ steps.filter.outputs.backend }}
      pricer: ${{ steps.filter.outputs.pricer }}
      frontend: ${{ steps.filter.outputs.frontend }}
      mobile: ${{ steps.filter.outputs.mobile }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            backend:
              - 'backend/**'
              - 'go.work'
              - 'go.work.sum'
            pricer:
              - 'pricer/**'
              - 'pyproject.toml'
              - 'uv.lock'
            frontend:
              - 'client/**'
            mobile:
              - 'mobile/**'

  # ── Go blocks ────────────────────────────────────────
  go-lint:
    needs: changes
    if: needs.changes.outputs.backend == 'true'
    uses: ./.github/workflows/_go-lint.yml

  go-test:
    needs: changes
    if: needs.changes.outputs.backend == 'true'
    uses: ./.github/workflows/_go-test.yml

  go-build:
    needs: [go-lint, go-test]
    if: needs.changes.outputs.backend == 'true'
    uses: ./.github/workflows/_go-build.yml

  # ── Python blocks ─────────────────────────────────────
  python-lint:
    needs: changes
    if: needs.changes.outputs.pricer == 'true'
    uses: ./.github/workflows/_python-lint.yml

  python-test:
    needs: changes
    if: needs.changes.outputs.pricer == 'true'
    uses: ./.github/workflows/_python-test.yml

  # ── Frontend blocks ───────────────────────────────────
  frontend-lint:
    needs: changes
    if: needs.changes.outputs.frontend == 'true'
    uses: ./.github/workflows/_frontend-lint.yml

  frontend-test:
    needs: changes
    if: needs.changes.outputs.frontend == 'true'
    uses: ./.github/workflows/_frontend-test.yml

  frontend-build:
    needs: [frontend-lint, frontend-test]
    if: needs.changes.outputs.frontend == 'true'
    uses: ./.github/workflows/_frontend-build.yml

  # ── Mobile block ──────────────────────────────────────
  mobile-check:
    needs: changes
    if: needs.changes.outputs.mobile == 'true'
    uses: ./.github/workflows/_mobile-check.yml

  # ── Gate ─────────────────────────────────────────────
  summary:
    name: CI Summary
    needs: [go-lint, go-test, go-build, python-lint, python-test, frontend-lint, frontend-test, frontend-build, mobile-check]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Check job results
        run: |
          echo "Results:"
          echo "  go-lint:        ${{ needs.go-lint.result }}"
          echo "  go-test:        ${{ needs.go-test.result }}"
          echo "  go-build:       ${{ needs.go-build.result }}"
          echo "  python-lint:    ${{ needs.python-lint.result }}"
          echo "  python-test:    ${{ needs.python-test.result }}"
          echo "  frontend-lint:  ${{ needs.frontend-lint.result }}"
          echo "  frontend-test:  ${{ needs.frontend-test.result }}"
          echo "  frontend-build: ${{ needs.frontend-build.result }}"
          echo "  mobile-check:   ${{ needs.mobile-check.result }}"
          if [[ "${{ contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') }}" == "true" ]]; then
            echo "❌ CI failed"
            exit 1
          fi
          echo "✅ CI passed"
```

- [ ] **Step 2: Validate**

```bash
actionlint .github/workflows/ci.yml
```

Expected: no output

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: rewrite ci.yml — atomic blocks, path filtering, summary gate"
git push origin main
```

---

## Task 15: Create `docker.yml` — Docker orchestrator

**Files:** Create `.github/workflows/docker.yml`

Matrix × 3 parallel builds. Accepts `workflow_call` so `release.yml` can invoke it.

- [ ] **Step 1: Create the file**

```yaml
name: Publish Docker images

on:
  workflow_call:
  workflow_dispatch:
  release:
    types: [published]

permissions:
  contents: read
  packages: write

jobs:
  build:
    name: "Build ${{ matrix.service }}"
    strategy:
      fail-fast: false
      matrix:
        include:
          - service: backend
            dockerfile: Dockerfile.backend
          - service: pricer
            dockerfile: Dockerfile.pricer
          - service: frontend
            dockerfile: Dockerfile.frontend
    uses: ./.github/workflows/_docker-service.yml
    with:
      service: ${{ matrix.service }}
      dockerfile: ${{ matrix.dockerfile }}
    secrets: inherit
```

- [ ] **Step 2: Validate**

```bash
actionlint .github/workflows/docker.yml
```

Expected: no output

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/docker.yml
git commit -m "ci: add docker.yml orchestrator (matrix × 3 parallel image builds)"
git push origin main
```

---

## Task 16: Create `release.yml` — release orchestrator

**Files:** Create `.github/workflows/release.yml`

On version tag push: all blocks in parallel → docker (gated) → e2e (gated). No path filtering — everything must pass on a release.

- [ ] **Step 1: Create the file**

```yaml
name: Release

on:
  push:
    tags:
      - "v*.*.*"

permissions:
  contents: read
  packages: write

jobs:
  go-lint:
    uses: ./.github/workflows/_go-lint.yml

  go-test:
    uses: ./.github/workflows/_go-test.yml

  go-build:
    needs: [go-lint, go-test]
    uses: ./.github/workflows/_go-build.yml

  python-lint:
    uses: ./.github/workflows/_python-lint.yml

  python-test:
    uses: ./.github/workflows/_python-test.yml

  frontend-lint:
    uses: ./.github/workflows/_frontend-lint.yml

  frontend-test:
    uses: ./.github/workflows/_frontend-test.yml

  frontend-build:
    needs: [frontend-lint, frontend-test]
    uses: ./.github/workflows/_frontend-build.yml

  mobile-check:
    uses: ./.github/workflows/_mobile-check.yml

  docker:
    needs: [go-build, python-lint, python-test, frontend-build, mobile-check]
    uses: ./.github/workflows/docker.yml
    secrets: inherit

  e2e:
    needs: docker
    uses: ./.github/workflows/_e2e.yml
```

- [ ] **Step 2: Validate**

```bash
actionlint .github/workflows/release.yml
```

Expected: no output

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add release.yml — full atomic suite → docker → e2e on version tags"
git push origin main
```

---

## Task 17: Delete old workflow files

**Files:**
- Delete `.github/workflows/docker-image.yml`
- Delete `.github/workflows/e2e.yml`

- [ ] **Step 1: Delete and commit**

```bash
git rm .github/workflows/docker-image.yml .github/workflows/e2e.yml
git commit -m "ci: remove stale docker-image.yml and e2e.yml (superseded by modular pipeline)"
git push origin main
```

---

## Task 18: Full validation pass

**Files:** none

- [ ] **Step 1: Run actionlint across all workflows**

```bash
actionlint .github/workflows/*.yml
```

Expected: no output

- [ ] **Step 2: Verify final file list**

```bash
ls .github/workflows/
```

Expected:
```
_docker-service.yml
_e2e.yml
_frontend-build.yml
_frontend-lint.yml
_frontend-test.yml
_go-build.yml
_go-lint.yml
_go-test.yml
_mobile-check.yml
_python-lint.yml
_python-test.yml
ci.yml
docker.yml
release.yml
```

- [ ] **Step 3: Final push**

```bash
git push origin main
```

Open GitHub Actions tab — CI workflow should trigger and show the `changes` job + `summary` green (all service jobs skipped by path filter since only workflow files changed).
