# TODO

## Active: Go Backend Migration

### Specs
- [Design](superpowers/specs/2026-05-21-go-backend-migration-design.md) — Go/Gin + Python pricer microservice + Zod frontend

### Plans
- [Plan A](superpowers/plans/2026-05-21-plan-a-pricer-microservice.md) — Extract Python pricer as standalone FastAPI microservice
- [Plan B](superpowers/plans/2026-05-21-plan-b-go-backend.md) — Go backend: all routes, TDD, one commit per route
- [Plan C](superpowers/plans/2026-05-21-plan-c-zod-frontend.md) — Zod schema validation on all frontend API responses

### Progress
- [ ] Plan A: Python pricer microservice
- [ ] Plan B: Go backend
  - [ ] Task 1: Scaffold (go mod init, gin, config, middleware, Makefile)
  - [ ] Task 2: Domain model types
  - [ ] Task 3: CSV loader
  - [ ] Task 4: SQLite DB layer
  - [ ] Task 5: Pricer HTTP client
  - [ ] Task 6: Holdings service
  - [ ] Task 7: Holdings handler
  - [ ] Task 8: Portfolio overview handler
  - [ ] Task 9: Watchlist handler
  - [ ] Task 10: Core handler
  - [ ] Task 11: Root Makefile + docker-compose
  - [ ] Task 12: Remove old Python backend
  - Note: analytics endpoint (allocation breakdown, performance chart) is deferred to a follow-up plan — it depends on holdings service being stable first
- [ ] Plan C: Zod frontend validation
