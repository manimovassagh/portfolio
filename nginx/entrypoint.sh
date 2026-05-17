#!/bin/sh
# Use mounted mkcert certs if present, otherwise generate a self-signed fallback.
if [ ! -f /etc/nginx/ssl/cert.pem ] || [ ! -f /etc/nginx/ssl/key.pem ]; then
  echo "No certs mounted — generating self-signed cert for localhost..."
  mkdir -p /etc/nginx/ssl
  openssl req -x509 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/key.pem \
    -out    /etc/nginx/ssl/cert.pem \
    -days 365 -nodes \
    -subj '/CN=localhost' \
    -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1' 2>/dev/null
  echo "Self-signed cert generated (browser will warn — run setup-certs.sh for a trusted cert)."
fi
exec "$@"
