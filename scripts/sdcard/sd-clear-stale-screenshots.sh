#!/usr/bin/env bash
# sd-clear-stale-screenshots.sh — remove APENAS os screenshots SOLTOS na raiz de
# /root/screenshots no cartão (nomes antigos por data, ex.: shot-20260427-194942.png),
# PRESERVANDO as pastas de versão v<ver>/shot-NNNN.png (esquema atual, correto).
#
# Resíduo de um agente PRÉ-fix de nomes sequenciais; o agente atual não os gera mais.
# Diferente de sd-clear-screenshots.sh, que apaga TODOS os PNG (inclusive os bons).
# Monta a rootfs (p2) em leitura/escrita. PRECISA SUDO.
#
# Uso:  sudo scripts/sdcard/sd-clear-stale-screenshots.sh <nome-do-cartao | /dev/sdX>
set -eu
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF/sdcard-lib.sh"

CARD="${1:-}"
[ -n "$CARD" ] || die "uso: sudo $0 <nome-do-cartao | /dev/sdX>"
[ "$(id -u)" -eq 0 ] || die "precisa de root (para montar/escrever): sudo $0 $CARD"

sd_resolve_device "$CARD" || exit 1
DEV="$SD_DEV"; P2="${DEV}2"
[ -b "$P2" ] || die "partição rootfs $P2 não existe"

sd_describe "$DEV"
NAME="${SD_NAME:-$CARD}"

say "============ LIMPAR SCREENSHOTS SOLTOS (por data) NA RAIZ ============"
say "Cartão '$CARD' -> $DEV  (rootfs $P2)"
sd_require_writable "$DEV"

MNT="$(mktemp -d)"; trap 'mountpoint -q "$MNT" && umount "$MNT"; rmdir "$MNT" 2>/dev/null||true' EXIT
mount "$P2" "$MNT" || die "falha ao montar $P2 (rw)"

DIR="$MNT/root/screenshots"
if [ ! -d "$DIR" ]; then
    ok "nada a limpar — '$NAME' não tem pasta de screenshots ($DIR)."
    exit 0
fi

# só os PNG SOLTOS na raiz (maxdepth 1) — pastas v*/ ficam intactas
COUNT="$(find "$DIR" -maxdepth 1 -type f -name 'shot-*.png' | wc -l)"
if [ "$COUNT" -eq 0 ]; then
    ok "nada a limpar — sem screenshots soltos na raiz de '$NAME'."
    exit 0
fi

say "Serão removidos $COUNT arquivo(s) solto(s) na raiz:"
find "$DIR" -maxdepth 1 -type f -name 'shot-*.png' -printf '   %f\n'
find "$DIR" -maxdepth 1 -type f -name 'shot-*.png' -delete
sync

KEPT="$(find "$DIR" -mindepth 2 -type f -name '*.png' | wc -l)"
ok "removidos $COUNT solto(s); preservados $KEPT print(s) em pastas de versão."
