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

# Optional HTTP Basic Auth — set AUTH_USER and AUTH_PASS to enable.
if [ -n "$AUTH_USER" ] && [ -n "$AUTH_PASS" ]; then
  hashed=$(openssl passwd -apr1 "$AUTH_PASS")
  printf '%s:%s\n' "$AUTH_USER" "$hashed" > /etc/nginx/.htpasswd
  printf 'auth_basic "Kapital";\nauth_basic_user_file /etc/nginx/.htpasswd;\n' \
    > /etc/nginx/auth.conf
  echo "Basic auth enabled for user: $AUTH_USER"
else
  printf '# auth disabled\n' > /etc/nginx/auth.conf
fi

exec "$@"
