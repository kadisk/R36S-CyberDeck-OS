#!/usr/bin/env bash
# sd-set-logo.sh — troca o LOGO de boot (welcome) num cartão JÁ gravado, sem regravar
# a imagem. Copia board/r36s/boot/logo.bmp para a BOOT FAT (logo.bmp + logo_kernel.bmp).
# PRECISA SUDO.  Uso: sudo scripts/sdcard/sd-set-logo.sh <nome-do-cartao | /dev/sdX>
set -eu
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF/sdcard-lib.sh"
REPO="$(cd "$SELF/../.." && pwd)"
LOGO="$REPO/board/r36s/boot/logo.bmp"

CARD="${1:-}"
[ -n "$CARD" ] || die "uso: sudo $0 <nome-do-cartao | /dev/sdX>"
[ "$(id -u)" -eq 0 ] || die "precisa de root: sudo $0 $CARD"
[ -f "$LOGO" ] || die "logo não encontrado: $LOGO (rode board/r36s/boot/make-logo.sh)"
sd_resolve_device "$CARD" || exit 1
DEV="$SD_DEV"; P1="${DEV}1"
[ -b "$P1" ] || die "partição BOOT $P1 não existe"

say "================== TROCAR LOGO DE BOOT (welcome) =================="
say "Cartão '$CARD' -> $DEV  (BOOT $P1)"
sd_require_writable "$DEV"

MNT="$(mktemp -d)"; trap 'mountpoint -q "$MNT" && umount "$MNT"; rmdir "$MNT" 2>/dev/null||true' EXIT
mount "$P1" "$MNT" || die "falha ao montar $P1"
[ -f "$MNT/boot.ini" ] || die "$P1 não parece a BOOT do R36S (sem boot.ini)"
for L in logo.bmp logo_kernel.bmp; do
    [ -f "$MNT/$L.arkos.bak" ] || { [ -f "$MNT/$L" ] && cp "$MNT/$L" "$MNT/$L.arkos.bak"; }
    cp "$LOGO" "$MNT/$L" && say "   $L atualizado"
done
sync
ok "Logo de boot trocado em '$SD_NAME' ($P1)."
say "RESULTADO: reinsira no R36S e ligue — o welcome deve aparecer no início do boot."
