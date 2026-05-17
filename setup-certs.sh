#!/bin/sh
# Generates mkcert-trusted TLS certs for localhost.
# Run once before `docker compose up`.
#
# Requires mkcert: brew install mkcert

set -e
command -v mkcert >/dev/null 2>&1 || { echo "Install mkcert first: brew install mkcert"; exit 1; }

mkcert -install
mkdir -p certs
cd certs
mkcert localhost 127.0.0.1 ::1
mv localhost+2.pem     cert.pem
mv localhost+2-key.pem key.pem
echo "Done. Run: docker compose up --build"
