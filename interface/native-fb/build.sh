#!/usr/bin/env bash
#
# build.sh — compila o cyberdeck-fb (renderizador de framebuffer) para aarch64,
# estático (sem dependências de libs no rootfs). Saída: build/cyberdeck-fb.
#
# Toolchain: aarch64-linux-gnu-gcc (Ubuntu: pacote gcc-aarch64-linux-gnu).
# Opcional: regenera a fonte se faltar (tools/gen-font.py + PSF de console).
#
set -eu
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CC="${CC:-aarch64-linux-gnu-gcc}"
OUT="$SELF/build/cyberdeck-fb"

command -v "$CC" >/dev/null || {
    echo "[build] cross-compiler ausente: $CC"
    echo "        instale: sudo apt-get install gcc-aarch64-linux-gnu"
    exit 1
}

# Fonte bitmap (gerada de uma fonte de console PSF). Versiona-se o .h; regenera se sumir.
if [ ! -f "$SELF/src/font8x16.h" ]; then
    echo "[build] gerando src/font8x16.h"
    python3 "$SELF/tools/gen-font.py" > "$SELF/src/font8x16.h"
fi

mkdir -p "$SELF/build"
echo "[build] compilando ($CC, static)"
"$CC" -O2 -static -Wall -Wno-format-truncation -I"$SELF/src" -o "$OUT" \
    "$SELF/src/main.c" "$SELF/src/fb.c" "$SELF/src/input.c" "$SELF/src/http.c" \
    "$SELF/src/ui.c" "$SELF/src/views.c" "$SELF/src/cjson/cJSON.c"
echo "[build] OK: $OUT"
file "$OUT"
