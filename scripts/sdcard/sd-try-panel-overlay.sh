#!/usr/bin/env bash
# sd-try-panel-overlay.sh — define qual overlay de painel o Arch-R usa, copiando
# /overlays/<nome>.dtbo -> /overlays/mipi-panel.dtbo na BOOT do cartão. PRECISA SUDO.
# Use para TESTAR painéis no cartão Arch-R já gravado (reinicie e veja a tela).
#
# Uso:
#   sudo scripts/sdcard/sd-try-panel-overlay.sh <cartao>                 # lista candidatos R36S
#   sudo scripts/sdcard/sd-try-panel-overlay.sh <cartao> <overlay>       # aplica o overlay
set -eu
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF/sdcard-lib.sh"

CARD="${1:-}"; OV="${2:-}"
[ -n "$CARD" ] || die "uso: sudo $0 <cartao> [<overlay>]"
[ "$(id -u)" -eq 0 ] || die "precisa de root: sudo $0 $*"
sd_resolve_device "$CARD" || exit 1
DEV="$SD_DEV"; P1="${DEV}1"
[ -b "$P1" ] || die "partição BOOT $P1 não existe"

MNT="$(mktemp -d)"; trap 'mountpoint -q "$MNT" && umount "$MNT"; rmdir "$MNT" 2>/dev/null||true' EXIT
mount "$P1" "$MNT" || die "falha ao montar $P1"
[ -d "$MNT/overlays" ] || die "$P1 não tem /overlays (é a BOOT do Arch-R?)"

if [ -z "$OV" ]; then
    say "============= CANDIDATOS DE PAINEL R36S (overlays) ============="
    say "(timing do BSP que funciona: vertical=480,17,5,13 — priorize quem bate)"
    for f in "$MNT"/overlays/R36S-*.dtbo "$MNT"/overlays/R36XX-*.dtbo "$MNT"/overlays/RG36S-*.dtbo; do
        [ -f "$f" ] || continue
        case "$f" in *_JP*|*_SR*) continue;; esac   # mostra só os base (sem variantes de joypad)
        d="$(dtc -I dtb -O dts "$f" 2>/dev/null | grep -o 'clock=[0-9]* horizontal=640,[0-9,]* vertical=480,[0-9,]* default=1' | head -1)"
        n="$(basename "$f" .dtbo)"
        mark=""; echo "$d" | grep -q 'vertical=480,17,5,13' && mark="  <== casa o BSP"
        printf '  %-40s %s%s\n' "$n" "$d" "$mark"
    done
    echo
    say "Aplique um com:  sudo $0 $CARD R36S-V12_2023-08-18_Panel_0"
    exit 0
fi

SRC="$MNT/overlays/${OV}.dtbo"; [ -f "$SRC" ] || SRC="$MNT/overlays/${OV}"
[ -f "$SRC" ] || die "overlay '$OV' não existe em /overlays. Rode sem o 2º argumento p/ listar."
cp "$SRC" "$MNT/overlays/mipi-panel.dtbo"; sync
ok "overlay '$(basename "$SRC")' aplicado como mipi-panel.dtbo em $P1 ('$SD_NAME')."
say "RESULTADO: reinsira no R36S e ligue. Se a tela do Arch-R aparecer, ESSE é o painel."
say "Se preto, tente outro: sudo $0 $CARD <outro-overlay>"
