#!/usr/bin/env bash
# build.sh — instala deps e gera o bundle file://-safe em dist/ (rodado no HOST).
set -eu
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  if [ -f package-lock.json ]; then npm ci; else npm install; fi
fi
npm run build
echo "[web-react] dist/ gerado:"
ls -la dist/
