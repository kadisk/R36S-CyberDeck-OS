#!/usr/bin/env bash
# sd-clear-screenshots.sh — APAGA os screenshots do CyberDeck (/root/screenshots/*.png)
# de um cartão, pelo NOME. Monta a rootfs (p2) em leitura/escrita e remove só os PNGs
# dessa pasta (nada além disso). Útil antes de gerar prints novos, p/ não misturar antigos.
# PRECISA SUDO.  Uso: sudo scripts/sdcard/sd-clear-screenshots.sh <nome-do-cartao | /dev/sdX>
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

say "================= LIMPAR SCREENSHOTS DO CARTÃO ================="
say "Cartão '$CARD' -> $DEV  (rootfs $P2)"
sd_require_writable "$DEV"

MNT="$(mktemp -d)"; trap 'mountpoint -q "$MNT" && umount "$MNT"; rmdir "$MNT" 2>/dev/null||true' EXIT
mount "$P2" "$MNT" || die "falha ao montar $P2 (rw)"

DIR="$MNT/root/screenshots"
if [ ! -d "$DIR" ]; then
    ok "nada a limpar — '$NAME' não tem pasta de screenshots ($DIR)."
    exit 0
fi

COUNT="$(find "$DIR" -type f -name '*.png' | wc -l)"
if [ "$COUNT" -eq 0 ]; then
    ok "nada a limpar — pasta vazia em '$NAME' ($DIR)."
    exit 0
fi

# remove os .png em /root/screenshots e subpastas de versão (e limpa pastas vazias)
find "$DIR" -type f -name '*.png' -delete
find "$DIR" -mindepth 1 -type d -empty -delete 2>/dev/null || true
sync

REST="$(find "$DIR" -type f -name '*.png' | wc -l)"
ok "$COUNT screenshot(s) apagados de '$NAME' (restam: $REST)."
say "RESULTADO: sucesso — agora os prints novos do aparelho virão limpos."
