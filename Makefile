.PHONY: run dev install clean cache exports help

run:
	uv run uvicorn api:app --port 8765

dev:
	uv run uvicorn api:app --reload --port 8765

install:
	uv sync

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
	@echo "  install   Install dependencies via uv"
	@echo "  clean     Remove __pycache__ and .pyc files"
	@echo "  cache     Clear yfinance price cache"
	@echo "  exports   List CSV export files"
