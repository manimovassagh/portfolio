.PHONY: run down stop logs certs dev frontend build-frontend start-backend start-backend-dev run-pricer run-go run-all docker docker-down docker-logs typecheck install clean cache exports help

.DEFAULT_GOAL := help

NPM          ?= npm
UV           ?= uv
APP_MODULE   ?= api:app
HOST         ?= 0.0.0.0
PORT         ?= 8765
PRICER_PORT  ?= 8001
GO_PORT      ?= 8766
VITE_PORT    ?= 5173
SSL_KEYFILE  ?= certs/key.pem
SSL_CERTFILE ?= certs/cert.pem

UVICORN_ARGS := $(APP_MODULE) --host $(HOST) --port $(PORT) --ssl-keyfile $(SSL_KEYFILE) --ssl-certfile $(SSL_CERTFILE)

# ── Orchestration ──────────────────────────────────────────────────────────────

run: certs
	@$(MAKE) -s stop
	@mkdir -p logs
	@echo "Starting pricer     → http://localhost:$(PRICER_PORT)"
	@$(UV) run uvicorn pricer.main:app --host 0.0.0.0 --port $(PRICER_PORT) \
		> logs/pricer.log 2>&1 &
	@echo "Starting Go backend → https://localhost:$(GO_PORT)"
	@(cd backend && go run ./cmd/api) \
		> logs/backend.log 2>&1 &
	@echo "Starting Vite       → http://localhost:$(VITE_PORT)"
	@(cd client && $(NPM) run dev --silent) \
		> logs/vite.log 2>&1 &
	@echo ""
	@echo "All services running.  Tail logs with: make logs"
	@echo "Stop everything with:  make stop"

down stop:
	@echo "Stopping all services..."
	@-kill $$(lsof -tiTCP:$(PRICER_PORT) -sTCP:LISTEN 2>/dev/null) 2>/dev/null; true
	@-kill $$(lsof -tiTCP:$(GO_PORT)     -sTCP:LISTEN 2>/dev/null) 2>/dev/null; true
	@-kill $$(lsof -tiTCP:$(VITE_PORT)   -sTCP:LISTEN 2>/dev/null) 2>/dev/null; true
	@echo "Done."

logs:
	@tail -f logs/pricer.log logs/backend.log logs/vite.log 2>/dev/null \
		|| echo "No logs found — run 'make run' first."

# ── TLS certificates ───────────────────────────────────────────────────────────

certs:
	@if [ ! -f "$(SSL_CERTFILE)" ] || [ ! -f "$(SSL_KEYFILE)" ]; then \
		echo "Generating self-signed TLS certificate in certs/"; \
		mkdir -p certs; \
		openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
			-keyout "$(SSL_KEYFILE)" \
			-out    "$(SSL_CERTFILE)" \
			-subj "/CN=localhost" \
			-addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
			2>/dev/null; \
		echo "Certificate created: $(SSL_CERTFILE)"; \
	else \
		echo "TLS certificate already exists: $(SSL_CERTFILE)"; \
	fi

# ── Individual service targets ─────────────────────────────────────────────────

run-pricer:
	$(UV) run uvicorn pricer.main:app --host 0.0.0.0 --port $(PRICER_PORT)

run-go:
	cd backend && go run ./cmd/api

# Blocking foreground mode (Ctrl-C kills all)
run-all:
	@trap 'kill 0' INT; \
	$(MAKE) run-pricer & \
	$(MAKE) run-go & \
	cd client && $(NPM) run dev

# ── Frontend ───────────────────────────────────────────────────────────────────

frontend build-frontend:
	cd client && $(NPM) run build

# ── Legacy Python backend targets (uvicorn) ────────────────────────────────────

dev: certs build-frontend start-backend-dev

start-backend:
	$(UV) run uvicorn $(UVICORN_ARGS)

start-backend-dev:
	$(UV) run uvicorn $(UVICORN_ARGS) --reload

# ── Docker ─────────────────────────────────────────────────────────────────────

docker: certs
	docker compose up --build

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

# ── Utilities ──────────────────────────────────────────────────────────────────

typecheck:
	cd client && $(NPM) run typecheck

install:
	$(UV) sync
	cd client && $(NPM) install

clean:
	@find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null; \
	find . -name "*.pyc" -delete 2>/dev/null; \
	rm -rf .gocache/ client/dist/ static/dist/ client/playwright-report/ client/test-results/ logs/ 2>/dev/null; \
	echo "Cleaned."

cache:
	@rm -rf cache/
	@curl -s -X POST http://localhost:$(PRICER_PORT)/cache/clear >/dev/null 2>&1 && \
		echo "Live pricer cache cleared." || true
	@echo "Disk cache cleared."

exports:
	@ls -lh exports/ 2>/dev/null || echo "No exports/ directory found."

# ── Help ───────────────────────────────────────────────────────────────────────

help:
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "  run          Start pricer + Go backend + Vite dev server (background)"
	@echo "  stop         Stop all services  (alias: make down)"
	@echo "  down         Stop all services  (alias: make stop)"
	@echo "  logs         Tail live logs from all three services"
	@echo ""
	@echo "  certs        Generate self-signed HTTPS certs if missing"
	@echo "  run-pricer   Start pricer only (foreground)"
	@echo "  run-go       Start Go backend only (foreground)"
	@echo "  run-all      Start all three in foreground (Ctrl-C stops all)"
	@echo ""
	@echo "  build-frontend  Build React/Vite for production"
	@echo "  typecheck    TypeScript type-check"
	@echo "  install      Install backend and frontend dependencies"
	@echo "  clean        Remove __pycache__ and .pyc files"
	@echo "  cache        Clear yfinance price cache"
	@echo "  exports      List CSV export files"
	@echo ""
	@echo "  docker       Build and start Docker Compose stack"
	@echo "  docker-down  Stop Docker Compose stack"
	@echo "  docker-logs  Follow Docker Compose logs"
	@echo ""
	@echo "Overrides: GO_PORT=8766 PRICER_PORT=8001 VITE_PORT=5173"
	@echo ""
