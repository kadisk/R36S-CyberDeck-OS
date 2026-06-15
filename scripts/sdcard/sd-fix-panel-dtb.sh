#!/usr/bin/env bash
# sd-fix-panel-dtb.sh — força o PAINEL que funciona no seu R36S substituindo TODOS os
# rk3326-r35s-linux.dtb da partição BOOT (root + ScreenFiles/Panel*/) pelo DTB do
# ArkOS que JÁ funciona (artifacts/arkos-reference/dtb/rk3326-r35s-linux.dtb, painel
# elida,kd35t133). Útil p/ imagens ArkOS MultiPanel que "nem acendem" (painel default
# errado). PRECISA SUDO. Não regrava a imagem.
#
# Uso: sudo scripts/sdcard/sd-fix-panel-dtb.sh <nome-do-cartao | /dev/sdX>
set -eu
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF/sdcard-lib.sh"
REPO="$(cd "$SELF/../.." && pwd)"
DTB="$REPO/artifacts/arkos-reference/dtb/rk3326-r35s-linux.dtb"

CARD="${1:-}"
[ -n "$CARD" ] || die "uso: sudo $0 <nome-do-cartao | /dev/sdX>"
[ "$(id -u)" -eq 0 ] || die "precisa de root: sudo $0 $CARD"
[ -f "$DTB" ] || die "DTB que funciona não encontrado: $DTB (extraia do seu ArkOS)"
sd_resolve_device "$CARD" || exit 1
DEV="$SD_DEV"; P1="${DEV}1"
[ -b "$P1" ] || die "partição BOOT $P1 não existe"

say "================= FORÇAR PAINEL QUE FUNCIONA (DTB) ================"
say "Substitui todo rk3326-r35s-linux.dtb na BOOT pelo seu (elida,kd35t133, $(stat -c %s "$DTB")B / $(sha256sum "$DTB"|cut -c1-12))"
say "Cartão '$CARD' -> $DEV"
sd_require_writable "$DEV"

MNT="$(mktemp -d)"; trap 'mountpoint -q "$MNT" && umount "$MNT"; rmdir "$MNT" 2>/dev/null||true' EXIT
mount "$P1" "$MNT" || die "falha ao montar $P1"
[ -f "$MNT/boot.ini" ] || die "$P1 não parece a BOOT do ArkOS (sem boot.ini)"

n=0
while IFS= read -r -d '' f; do
    [ -f "$f.our.bak" ] || cp "$f" "$f.our.bak" 2>/dev/null || true
    cp "$DTB" "$f" && n=$((n+1)) && say "   substituído: ${f#$MNT/}"
done < <(find "$MNT" -name 'rk3326-r35s-linux.dtb' -print0 2>/dev/null)
sync
ok "$n DTB(s) substituído(s) pelo seu painel em $P1 ('$SD_NAME')."
say "RESULTADO: reinsira no R36S e ligue NORMALMENTE (sem segurar botão)."
say "Se a tela acender com imagem -> seu painel está forçado e funciona nesta imagem."
