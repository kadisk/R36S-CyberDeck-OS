#!/usr/bin/env bash
# sd-apply-panel-dtb.sh — instala o DTB do painel (elida,kd35t133) na partição BOOT
# de um cartão AUTORIZADO (substitui /dtbs/rk3326-gameconsole-r36s.dtb). PRECISA SUDO.
# Não regrava a imagem. Faz backup do DTB original (uma vez).
#
# Uso: sudo scripts/sdcard/sd-apply-panel-dtb.sh <nome-do-cartao | /dev/sdX>
set -eu
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF/sdcard-lib.sh"
REPO="$(cd "$SELF/../.." && pwd)"
DTB="$REPO/artifacts/mainline/custom-dtb/rk3326-gameconsole-r36s.dtb"

CARD="${1:-}"
[ -n "$CARD" ] || die "uso: sudo $0 <nome-do-cartao | /dev/sdX>"
[ "$(id -u)" -eq 0 ] || die "precisa de root: sudo $0 $CARD"
[ -f "$DTB" ] || die "DTB do painel não encontrado: $DTB  (rode: experiments/build-panel-dtb.sh)"
sd_resolve_device "$CARD" || exit 1
DEV="$SD_DEV"

say "==================== APLICAR DTB DE PAINEL ====================="
say "AÇÃO: instalar DTB com painel elida,kd35t133 na BOOT do cartão"
say "Cartão '$CARD' -> $DEV"
sd_require_writable "$DEV"

P1="${DEV}1"; [ -b "$P1" ] || die "partição BOOT $P1 não existe"
MNT="$(mktemp -d)"; trap 'mountpoint -q "$MNT" && umount "$MNT"; rmdir "$MNT" 2>/dev/null||true' EXIT
mount "$P1" "$MNT" || die "falha ao montar $P1"
[ -d "$MNT/dtbs" ] || die "$P1 não tem /dtbs (não é a BOOT mainline do Arch-R)"

TGT="$MNT/dtbs/rk3326-gameconsole-r36s.dtb"
if [ -f "$TGT" ] && [ ! -f "$TGT.orig" ]; then cp "$TGT" "$TGT.orig"; ok "backup do DTB base em /dtbs/rk3326-gameconsole-r36s.dtb.orig"; fi
cp "$DTB" "$TGT"; sync
ok "DTB de painel (elida,kd35t133) instalado em $P1 ('$SD_NAME')."
say "RESULTADO: sucesso — reinsira no R36S e ligue. Se a tela acender com imagem,"
say "           o painel está OK; senão tentamos outro caminho (overlay do Arch-R)."
