#!/usr/bin/env bash
# Cross-compila cyberdeck-input (aarch64 estático). Sem sudo.
set -euo pipefail
cd "$(dirname "$0")"
CC=${CC:-aarch64-linux-gnu-gcc}
"$CC" -O2 -static -Wall -o cyberdeck-input src/main.c
aarch64-linux-gnu-strip cyberdeck-input 2>/dev/null || true
echo "[ok] cyberdeck-input -> $(pwd)/cyberdeck-input"
file cyberdeck-input
