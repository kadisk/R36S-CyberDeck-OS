#!/usr/bin/env bash
# Cross-compila cyberdeck-agent (aarch64 estático). Sem sudo.
set -euo pipefail
cd "$(dirname "$0")"
CC=${CC:-aarch64-linux-gnu-gcc}
"$CC" -O2 -static -o cyberdeck-agent src/main.c
aarch64-linux-gnu-strip cyberdeck-agent 2>/dev/null || true
echo "[ok] cyberdeck-agent -> $(pwd)/cyberdeck-agent"
file cyberdeck-agent
