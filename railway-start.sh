#!/bin/sh
set -e

attempts=0
until php artisan migrate --force; do
  attempts=$((attempts + 1))
  if [ "$attempts" -ge 12 ]; then
    echo "Migrate failed after $attempts attempts — giving up."
    exit 1
  fi
  echo "Migrate attempt $attempts failed (DB not ready?) — retrying in 5s..."
  sleep 5
done

mkdir -p storage/app/public
php artisan storage:link --no-interaction || true

echo "Starting API + WS on port ${PORT:-8080}."
exec node railway-proxy/server.js
