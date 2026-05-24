FROM node:26-slim AS frontend-builder
WORKDIR /app
COPY client/package.json client/package-lock.json client/
RUN cd client && npm ci
COPY client/ client/
ARG VITE_PUBLIC_DEMO=false
ARG VITE_AUTH0_DOMAIN=
ARG VITE_AUTH0_CLIENT_ID=
ARG VITE_AUTH0_AUDIENCE=
ARG VITE_AUTH0_REDIRECT_URI=
ENV VITE_PUBLIC_DEMO=${VITE_PUBLIC_DEMO}
ENV VITE_AUTH0_DOMAIN=${VITE_AUTH0_DOMAIN}
ENV VITE_AUTH0_CLIENT_ID=${VITE_AUTH0_CLIENT_ID}
ENV VITE_AUTH0_AUDIENCE=${VITE_AUTH0_AUDIENCE}
ENV VITE_AUTH0_REDIRECT_URI=${VITE_AUTH0_REDIRECT_URI}
RUN cd client && npm run build

FROM golang:1.26-alpine AS backend-builder
WORKDIR /app
COPY backend/go.mod backend/go.sum ./backend/
RUN cd backend && go mod download
COPY backend/ ./backend/
RUN cd backend && CGO_ENABLED=0 go build -o /kapital ./cmd/api

FROM ghcr.io/astral-sh/uv:0.7.9 AS uv-binary

FROM python:3.13-slim
WORKDIR /app

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      bash \
      ca-certificates \
      curl \
      gettext-base \
      nginx \
    && rm -rf /var/lib/apt/lists/*

COPY --from=uv-binary /uv /usr/local/bin/uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY pricer/ ./pricer/
COPY --from=backend-builder /kapital /kapital
COPY --from=frontend-builder /app/client/dist /usr/share/nginx/html
RUN mkdir -p /app/exports
COPY exports/sample-portfolio.csv /app/exports/sample-portfolio.csv
COPY render-nginx.conf.template /etc/nginx/templates/default.conf.template
COPY render-entrypoint.sh /app/render-entrypoint.sh

RUN chmod +x /app/render-entrypoint.sh

EXPOSE 10000
ENV PORT=10000 \
    BACKEND_PORT=8766 \
    PRICER_PORT=8001 \
    EXPORTS_DIR=/app/exports

CMD ["/app/render-entrypoint.sh"]
