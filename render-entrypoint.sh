#!/usr/bin/env bash
set -euo pipefail

: "${PORT:=10000}"
: "${BACKEND_PORT:=8766}"
: "${PRICER_PORT:=8001}"

cleanup() {
  for pid in "${backend_pid:-}" "${pricer_pid:-}" "${nginx_pid:-}"; do
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
}

trap cleanup EXIT INT TERM

PORT="$BACKEND_PORT" /kapital >/tmp/backend.log 2>&1 &
backend_pid=$!

PORT="$PRICER_PORT" uv run uvicorn pricer.main:app --host 127.0.0.1 --port "$PRICER_PORT" >/tmp/pricer.log 2>&1 &
pricer_pid=$!

for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${BACKEND_PORT}/api/readyz" >/dev/null 2>&1 && \
     curl -fsS "http://127.0.0.1:${PRICER_PORT}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf
cat > /usr/share/nginx/html/runtime-config.js <<EOF
window.__KAPITAL_RUNTIME__ = {
  auth0Domain: "${VITE_AUTH0_DOMAIN:-}",
  auth0ClientId: "${VITE_AUTH0_CLIENT_ID:-}",
  auth0Audience: "${VITE_AUTH0_AUDIENCE:-}",
  auth0RedirectUri: "${VITE_AUTH0_REDIRECT_URI:-}",
};
EOF
nginx -g 'daemon off;' &
nginx_pid=$!

while true; do
  if ! kill -0 "$backend_pid" 2>/dev/null; then
    wait "$backend_pid"
    exit $?
  fi
  if ! kill -0 "$pricer_pid" 2>/dev/null; then
    wait "$pricer_pid"
    exit $?
  fi
  if ! kill -0 "$nginx_pid" 2>/dev/null; then
    wait "$nginx_pid"
    exit $?
  fi
  sleep 5
done
