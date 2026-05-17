# Stage 1: build the React frontend
FROM node:20-slim AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.ts tailwind.config.js postcss.config.js tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: Python runtime
FROM python:3.12-slim
WORKDIR /app

# Install uv
RUN pip install uv --no-cache-dir

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY api.py ./
COPY app ./app
COPY portfolio ./portfolio
COPY exports/sample-portfolio.csv ./exports/sample-portfolio.csv
COPY --from=frontend /app/static ./static

CMD uv run uvicorn api:app --host 0.0.0.0 --port ${PORT:-8000}
