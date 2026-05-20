.PHONY: run dev stop certs frontend build-frontend start-backend start-backend-dev docker docker-down docker-logs typecheck install clean cache exports help

.DEFAULT_GOAL := help

NPM ?= npm
UV ?= uv
APP_MODULE ?= api:app
HOST ?= 0.0.0.0
PORT ?= 8765
SSL_KEYFILE ?= certs/key.pem
SSL_CERTFILE ?= certs/cert.pem

UVICORN_ARGS := $(APP_MODULE) --host $(HOST) --port $(PORT) --ssl-keyfile $(SSL_KEYFILE) --ssl-certfile $(SSL_CERTFILE)

run: stop certs build-frontend start-backend

dev: stop certs build-frontend start-backend-dev

stop:
	@pids="$$(lsof -tiTCP:$(PORT) -sTCP:LISTEN 2>/dev/null | tr '\n' ' ')"; \
	if [ -n "$$pids" ]; then \
		echo "Stopping processes listening on port $(PORT): $$pids"; \
		kill $$pids; \
		for _ in 1 2 3 4 5; do \
			sleep 0.2; \
			remaining="$$(lsof -tiTCP:$(PORT) -sTCP:LISTEN 2>/dev/null | tr '\n' ' ')"; \
			[ -z "$$remaining" ] && break; \
		done; \
		remaining="$$(lsof -tiTCP:$(PORT) -sTCP:LISTEN 2>/dev/null | tr '\n' ' ')"; \
		if [ -n "$$remaining" ]; then \
			echo "Port $(PORT) is still in use: $$remaining"; \
			exit 1; \
		fi; \
	else \
		echo "No process listening on port $(PORT)."; \
	fi

certs:
	@if [ ! -f "$(SSL_CERTFILE)" ] || [ ! -f "$(SSL_KEYFILE)" ]; then \
		echo "Generating local self-signed TLS certificate in certs/"; \
		mkdir -p certs; \
		openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
			-keyout "$(SSL_KEYFILE)" \
			-out "$(SSL_CERTFILE)" \
			-subj "/CN=localhost" \
			-addext "subjectAltName=DNS:localhost,IP:127.0.0.1"; \
	else \
		echo "Using existing TLS certificate: $(SSL_CERTFILE)"; \
	fi

frontend: build-frontend

build-frontend:
	$(NPM) run build

start-backend:
	$(UV) run uvicorn $(UVICORN_ARGS)

start-backend-dev:
	$(UV) run uvicorn $(UVICORN_ARGS) --reload

docker: certs
	docker compose up --build

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

typecheck:
	$(NPM) run typecheck

install:
	$(UV) sync
	$(NPM) install

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null; \
	find . -name "*.pyc" -delete 2>/dev/null; \
	echo "Cleaned."

cache:
	rm -rf cache/
	echo "Price cache cleared."

exports:
	@ls -lh exports/ 2>/dev/null || echo "No exports/ directory found."

help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "  run                Stop PORT, build frontend, start backend"
	@echo "  dev                Stop PORT, build frontend, start backend with reload"
	@echo "  stop               Stop processes listening on PORT (default: 8765)"
	@echo "  certs              Generate local self-signed HTTPS certs if missing"
	@echo "  docker             Generate certs and run Docker Compose"
	@echo "  docker-down        Stop Docker Compose"
	@echo "  docker-logs        Follow Docker Compose logs"
	@echo "  frontend           Alias for build-frontend"
	@echo "  build-frontend     Build React/Vite frontend"
	@echo "  start-backend      Start FastAPI backend only"
	@echo "  start-backend-dev  Start FastAPI backend only with reload"
	@echo "  typecheck          Type-check TypeScript frontend"
	@echo "  install            Install backend and frontend dependencies"
	@echo "  clean              Remove __pycache__ and .pyc files"
	@echo "  cache              Clear yfinance price cache"
	@echo "  exports            List CSV export files"
	@echo ""
	@echo "Overrides: PORT=8765 HOST=0.0.0.0 APP_MODULE=api:app"
