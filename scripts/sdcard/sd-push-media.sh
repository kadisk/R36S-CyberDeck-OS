#!/usr/bin/env bash
# sd-push-media.sh — copia mídia (áudio/vídeo) para /root/media num cartão já gravado,
# sem regravar a imagem. Monta a rootfs (p2) e copia os arquivos. PRECISA SUDO.
# É o que alimenta a tela de TESTE A/V do CyberDeck OS com os arquivos do usuário.
#
# Uso: sudo scripts/sdcard/sd-push-media.sh <nome-do-cartao | /dev/sdX> [dir-origem]
#   dir-origem (default) = assets/av-samples/  (samples gerados por gen-av-samples.sh)
set -eu
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF/sdcard-lib.sh"
REPO="$(cd "$SELF/../.." && pwd)"

CARD="${1:-}"
SRC="${2:-$REPO/assets/av-samples}"
[ -n "$CARD" ] || die "uso: sudo $0 <nome-do-cartao | /dev/sdX> [dir-origem]"
[ "$(id -u)" -eq 0 ] || die "precisa de root: sudo $0 $CARD"
[ -d "$SRC" ] || die "diretório de origem não existe: $SRC"

sd_resolve_device "$CARD" || exit 1
DEV="$SD_DEV"; P2="${DEV}2"
[ -b "$P2" ] || die "partição rootfs $P2 não existe"

say "================= COPIAR MÍDIA P/ O CARTÃO ================="
say "Cartão '$CARD' -> $DEV  (rootfs $P2)   origem: $SRC"
sd_require_writable "$DEV"

MNT="$(mktemp -d)"; trap 'mountpoint -q "$MNT" && umount "$MNT"; rmdir "$MNT" 2>/dev/null||true' EXIT
mount "$P2" "$MNT" || die "falha ao montar $P2"
DST="$MNT/root/media"; mkdir -p "$DST"
cp -av "$SRC"/. "$DST"/ >/dev/null
sync
ok "mídia copiada p/ '$SD_NAME' (/root/media): $(find "$SRC" -type f | wc -l) arquivos."
say "RESULTADO: reinsira no R36S; abra TESTE A/V (menu FN) p/ tocar."
