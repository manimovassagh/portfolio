# Advanced Modular CI/CD Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three flat workflow files with nine focused, reusable blocks wired together by intelligent orchestrators — with path filtering, caching, linting, pytest, and a single branch-protection gate.

**Architecture:** Six `workflow_call`-only reusable blocks (`_go`, `_python`, `_frontend`, `_mobile`, `_docker-service`, `_e2e`) are composed by three orchestrators (`ci`, `docker`, `release`). The `ci` orchestrator detects which service changed and only runs the relevant block; a `summary` job always runs and is the sole required branch-protection check.

**Tech Stack:** GitHub Actions, `dorny/paths-filter@v3`, `golangci/golangci-lint-action@v6`, `astral-sh/setup-uv@v5`, `docker/build-push-action@v6`, `actionlint` (local validation)

---

## File Map

| Action | Path |
|--------|------|
| Create | `.github/workflows/_go.yml` |
| Create | `.github/workflows/_python.yml` |
| Create | `.github/workflows/_frontend.yml` |
| Create | `.github/workflows/_mobile.yml` |
| Create | `.github/workflows/_docker-service.yml` |
| Create | `.github/workflows/_e2e.yml` |
| Rewrite | `.github/workflows/ci.yml` |
| Create | `.github/workflows/docker.yml` |
| Create | `.github/workflows/release.yml` |
| Delete | `.github/workflows/docker-image.yml` |
| Delete | `.github/workflows/e2e.yml` |
| Modify | `client/package.json` — add `lint` script |

---

## Task 1: Install actionlint (local workflow validator)

**Files:** none (local tooling only)

- [ ] **Step 1: Install actionlint**

```bash
brew install actionlint
```

If Homebrew not available:
```bash
go install github.com/rhysd/actionlint/cmd/actionlint@latest
```

- [ ] **Step 2: Confirm it works**

```bash
actionlint --version
```

Expected: prints version string like `actionlint 1.7.x`

---

## Task 2: Add ESLint lint script to frontend

**Files:**
- Modify: `client/package.json`

The existing `ci.yml` never lints the frontend. This task adds the `lint` npm script used by `_frontend.yml`. Modern Vite React TS projects include `eslint.config.js` already — we only need to expose the script.

- [ ] **Step 1: Check if ESLint is already installed**

```bash
grep '"eslint"' client/package.json
```

If output is empty, run:
```bash
cd client && npm install --save-dev eslint @eslint/js globals typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh
```

- [ ] **Step 2: Check if `eslint.config.js` exists**

```bash
ls client/eslint.config.js 2>/dev/null && echo "exists" || echo "missing"
```

If missing, create `client/eslint.config.js`:

```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
)
```

- [ ] **Step 3: Add `lint` script to `client/package.json`**

In the `"scripts"` block, add:
```json
"lint": "eslint src/ --max-warnings 0"
```

Full scripts block after edit:
```json
"scripts": {
  "dev": "vite --host 127.0.0.1 --port 5173",
  "build": "vite build",
  "typecheck": "tsc --noEmit",
  "lint": "eslint src/ --max-warnings 0",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

- [ ] **Step 4: Verify lint runs locally**

```bash
cd client && npm run lint
```

Expected: exits 0 (or fix any pre-existing warnings if it fails).

- [ ] **Step 5: Commit**

```bash
git add client/package.json client/eslint.config.js
git commit -m "feat(frontend): add eslint lint script for CI"
```

---

## Task 3: Create `_go.yml` — reusable Go block

**Files:**
- Create: `.github/workflows/_go.yml`

- [ ] **Step 1: Create the file**

```yaml
name: "Go — lint, test, build"

on:
  workflow_call:

jobs:
  go:
    name: Go
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

      - name: go test
        run: go test ./... -race -count=1 -coverprofile=coverage.out

      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: go-coverage
          path: backend/coverage.out
          retention-days: 7

      - name: go build
        run: go build ./cmd/api
```

- [ ] **Step 2: Validate with actionlint**

```bash
actionlint .github/workflows/_go.yml
```

Expected: no output (clean)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/_go.yml
git commit -m "ci: add reusable _go.yml block (lint, test, build)"
```

---

## Task 4: Create `_python.yml` — reusable Python block

**Files:**
- Create: `.github/workflows/_python.yml`

- [ ] **Step 1: Create the file**

```yaml
name: "Python — type-check, test"

on:
  workflow_call:

jobs:
  python:
    name: Python
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

      - name: pytest
        run: uv run pytest pricer/tests/ -v --tb=short
```

- [ ] **Step 2: Validate with actionlint**

```bash
actionlint .github/workflows/_python.yml
```

Expected: no output (clean)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/_python.yml
git commit -m "ci: add reusable _python.yml block (pyright + pytest)"
```

---

## Task 5: Create `_frontend.yml` — reusable Frontend block

**Files:**
- Create: `.github/workflows/_frontend.yml`

- [ ] **Step 1: Create the file**

```yaml
name: "Frontend — lint, typecheck, test, build"

on:
  workflow_call:

jobs:
  frontend:
    name: Frontend
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

      - name: Vitest
        run: npm test

      - name: Vite build
        run: npm run build

      - name: Upload dist
        uses: actions/upload-artifact@v4
        with:
          name: frontend-dist
          path: client/dist/
          retention-days: 1
```

- [ ] **Step 2: Validate with actionlint**

```bash
actionlint .github/workflows/_frontend.yml
```

Expected: no output (clean)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/_frontend.yml
git commit -m "ci: add reusable _frontend.yml block (lint, typecheck, vitest, build)"
```

---

## Task 6: Create `_mobile.yml` — reusable Mobile block

**Files:**
- Create: `.github/workflows/_mobile.yml`

- [ ] **Step 1: Create the file**

```yaml
name: "Mobile — typecheck"

on:
  workflow_call:

jobs:
  mobile:
    name: Mobile
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

- [ ] **Step 2: Validate with actionlint**

```bash
actionlint .github/workflows/_mobile.yml
```

Expected: no output (clean)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/_mobile.yml
git commit -m "ci: add reusable _mobile.yml block (typecheck + expo-doctor)"
```

---

## Task 7: Create `_docker-service.yml` — reusable Docker block

**Files:**
- Create: `.github/workflows/_docker-service.yml`

This block builds and pushes **one** Docker image. It receives the service name and dockerfile path as inputs and constructs the GHCR image path internally — avoiding the need to pass `github.repository` through the matrix.

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

- [ ] **Step 2: Validate with actionlint**

```bash
actionlint .github/workflows/_docker-service.yml
```

Expected: no output (clean)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/_docker-service.yml
git commit -m "ci: add reusable _docker-service.yml block (build + push with GHA layer cache)"
```

---

## Task 8: Create `_e2e.yml` — reusable Playwright block

**Files:**
- Create: `.github/workflows/_e2e.yml`

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

- [ ] **Step 2: Validate with actionlint**

```bash
actionlint .github/workflows/_e2e.yml
```

Expected: no output (clean)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/_e2e.yml
git commit -m "ci: add reusable _e2e.yml block (Playwright + artifact upload)"
```

---

## Task 9: Rewrite `ci.yml` — main orchestrator with path filtering + summary gate

**Files:**
- Rewrite: `.github/workflows/ci.yml`

This is the orchestrator that runs on every push/PR. A `changes` job detects which service files changed, and each service job only runs if its files were touched. The `summary` job always runs and is the single required branch-protection check.

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

  go:
    needs: changes
    if: needs.changes.outputs.backend == 'true'
    uses: ./.github/workflows/_go.yml

  python:
    needs: changes
    if: needs.changes.outputs.pricer == 'true'
    uses: ./.github/workflows/_python.yml

  frontend:
    needs: changes
    if: needs.changes.outputs.frontend == 'true'
    uses: ./.github/workflows/_frontend.yml

  mobile:
    needs: changes
    if: needs.changes.outputs.mobile == 'true'
    uses: ./.github/workflows/_mobile.yml

  summary:
    name: CI Summary
    needs: [go, python, frontend, mobile]
    if: always()
    runs-on: ubuntu-latest
    steps:
      - name: Check job results
        run: |
          echo "Results:"
          echo "  go:       ${{ needs.go.result }}"
          echo "  python:   ${{ needs.python.result }}"
          echo "  frontend: ${{ needs.frontend.result }}"
          echo "  mobile:   ${{ needs.mobile.result }}"
          if [[ "${{ contains(needs.*.result, 'failure') || contains(needs.*.result, 'cancelled') }}" == "true" ]]; then
            echo "❌ CI failed — one or more jobs failed or were cancelled"
            exit 1
          fi
          echo "✅ CI passed (jobs succeeded or skipped by path filter)"
```

- [ ] **Step 2: Validate with actionlint**

```bash
actionlint .github/workflows/ci.yml
```

Expected: no output (clean)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: rewrite ci.yml with path filtering, reusable blocks, and summary gate"
```

---

## Task 10: Create `docker.yml` — Docker orchestrator (matrix × 3)

**Files:**
- Create: `.github/workflows/docker.yml`

Builds all three service images in parallel using matrix strategy. Accepts `workflow_call` so `release.yml` can invoke it without duplicating the matrix.

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

- [ ] **Step 2: Validate with actionlint**

```bash
actionlint .github/workflows/docker.yml
```

Expected: no output (clean)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/docker.yml
git commit -m "ci: add docker.yml orchestrator — parallel matrix build for all 3 services"
```

---

## Task 11: Create `release.yml` — release orchestrator

**Files:**
- Create: `.github/workflows/release.yml`

Triggered on `v*.*.*` tags. Runs full CI suite (no path filter — everything must pass on release), then Docker builds, then E2E — sequentially gated.

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
  go:
    uses: ./.github/workflows/_go.yml

  python:
    uses: ./.github/workflows/_python.yml

  frontend:
    uses: ./.github/workflows/_frontend.yml

  mobile:
    uses: ./.github/workflows/_mobile.yml

  docker:
    needs: [go, python, frontend, mobile]
    uses: ./.github/workflows/docker.yml
    secrets: inherit

  e2e:
    needs: docker
    uses: ./.github/workflows/_e2e.yml
```

- [ ] **Step 2: Validate with actionlint**

```bash
actionlint .github/workflows/release.yml
```

Expected: no output (clean)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add release.yml — full suite → docker → e2e on version tags"
```

---

## Task 12: Delete old workflow files

**Files:**
- Delete: `.github/workflows/docker-image.yml` (replaced by `docker.yml`)
- Delete: `.github/workflows/e2e.yml` (replaced by `_e2e.yml` + `ci.yml`)

- [ ] **Step 1: Delete stale files**

```bash
git rm .github/workflows/docker-image.yml
git rm .github/workflows/e2e.yml
```

- [ ] **Step 2: Commit**

```bash
git commit -m "ci: remove stale docker-image.yml and e2e.yml (superseded by modular pipeline)"
```

---

## Task 13: Full validation pass

**Files:** none

- [ ] **Step 1: Run actionlint across all workflows**

```bash
actionlint .github/workflows/*.yml
```

Expected: no output. If errors appear, fix them before proceeding.

- [ ] **Step 2: Verify file list is correct**

```bash
ls .github/workflows/
```

Expected output:
```
_docker-service.yml
_e2e.yml
_frontend.yml
_go.yml
_mobile.yml
_python.yml
ci.yml
docker.yml
release.yml
```

No other `.yml` files should be present.

- [ ] **Step 3: Push to GitHub and watch CI run**

```bash
git push origin main
```

Then open the Actions tab on GitHub. The `CI` workflow should appear. Since no service files changed in the commit, all four service jobs will be skipped by the path filter, and `summary` should show green.

- [ ] **Step 4: Set branch protection rule in GitHub**

Go to **Settings → Branches → Add rule** for `main`:
- Require status checks: **`CI Summary`** (from `ci.yml`)
- Check "Require branches to be up to date"

This is the only rule needed — `summary` covers all four services.

- [ ] **Step 5: Trigger a test PR to verify path filtering**

Make a trivial change to `backend/` on a new branch:
```bash
git checkout -b test/ci-path-filter
echo "// test" >> backend/cmd/api/main.go
git add backend/cmd/api/main.go
git commit -m "test: trigger go path filter"
git push origin test/ci-path-filter
```

Open a PR. Expected: only the `go` job runs. `python`, `frontend`, `mobile` are skipped. `summary` passes.

After verifying, close the PR without merging:
```bash
git checkout main
git branch -d test/ci-path-filter
git push origin --delete test/ci-path-filter
```

---

## Self-Review Checklist

- [x] `_go.yml` covers issue #61 indirectly (linting) — `_python.yml` covers it directly (pytest)
- [x] `_docker-service.yml` lowercases the GHCR image name before use
- [x] `docker.yml` uses `fail-fast: false` so a pricer build failure doesn't cancel the backend build
- [x] `release.yml` runs all blocks unconditionally (no path filter) — correct for release gate
- [x] `summary` uses `if: always()` — runs even if upstream jobs are skipped by path filter
- [x] Old `docker-image.yml` (which used non-existent `checkout@v6`) is deleted
- [x] Old `e2e.yml` is deleted — E2E is now a block called by `release.yml` only (not on every PR)
- [x] All `uses:` calls reference `actions/checkout@v4` (not v5/v6)
