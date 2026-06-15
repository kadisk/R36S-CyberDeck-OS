#!/usr/bin/env bash
# make-logo.sh — gera o logo de boot (welcome) no formato que o U-Boot do R36S espera:
# BMP 640x480, 24-bit, sem compressão (BMP v3, header 54B) — idêntico ao logo.bmp do ArkOS.
# Fonte: welcome.png (4:3, escala exata p/ 640x480). Sem sudo.
set -euo pipefail
cd "$(dirname "$0")"
SRC="${1:-welcome.png}"
[ -f "$SRC" ] || { echo "fonte não encontrada: $SRC" >&2; exit 1; }
convert "$SRC" -resize 640x480 -background black -gravity center \
    -extent 640x480 -alpha off -type TrueColor BMP3:logo.bmp
echo "[ok] logo.bmp gerado de $SRC"
file logo.bmp
