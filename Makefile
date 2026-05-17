.PHONY: run dev frontend typecheck install clean cache exports help

run: frontend
	uv run uvicorn api:app --host 0.0.0.0 --port 8765

dev: frontend
	uv run uvicorn api:app --host 0.0.0.0 --reload --port 8765

frontend:
	npm run build

typecheck:
	npm run typecheck

install:
	uv sync
	npm install

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
	@echo "  run       Start server (production, port 8765)"
	@echo "  dev       Start server with auto-reload (development)"
	@echo "  frontend  Build React/Vite frontend"
	@echo "  typecheck Type-check TypeScript frontend"
	@echo "  install   Install backend and frontend dependencies"
	@echo "  clean     Remove __pycache__ and .pyc files"
	@echo "  cache     Clear yfinance price cache"
	@echo "  exports   List CSV export files"
