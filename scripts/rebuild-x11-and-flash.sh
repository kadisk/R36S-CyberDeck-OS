#!/usr/bin/env bash
#
# rebuild-x11-and-flash.sh — LIMPA, RECRIA do zero e GRAVA no cartão a imagem X11
# do CyberDeck (rootfs Debian + boot/kernel BSP do ArkOS + módulos 4.4.189 que
# habilitam o Wi-Fi via dongle USB, ex.: RTL8188FTV/8188fu = 0bda:f179).
#
# Sequência (cada passo é um script próprio):
#   1) clean            — apaga staging do build + .img antigo
#   2) extract-arkos-modules.sh   — só se a árvore de módulos não existir
#   3) build-x11-rootfs.sh        — recria rootfs + monta a imagem (LENTO ~30-60min)
#   4) sd-image.sh add x11        — (re)registra o apelido da imagem
#   5) sdcard/sd-update.sh        — grava no cartão (dd; APAGA o cartão todo)
#
# PRECISA SUDO (build/qemu + montar + gravar).
#
# Uso:   sudo scripts/rebuild-x11-and-flash.sh <cartao>
#        FAST=1 sudo scripts/rebuild-x11-and-flash.sh <cartao>   # mantém a base
#                                  debootstrap (não refaz do zero; bem mais rápido)
#
set -eu
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF_DIR/phase2-config.sh"

log() { echo; echo "==================== [rebuild] $* ===================="; }
die() { echo "[rebuild][ERRO] $*" >&2; exit 1; }

CARD="${1:-}"
[ -n "$CARD" ]            || die "uso: sudo $0 <cartao>   (ex.: sandisk-extreme-64gb-1)"
[ "$(id -u)" -eq 0 ]     || die "precisa de root: sudo $0 $CARD"
command -v qemu-aarch64-static >/dev/null || die "qemu-aarch64-static ausente (apt install qemu-user-static)"

KVER=4.4.189
X11_IMG="$OUT_DIR/r36s-cyberdeck-x11.img"
MODSRC="$REPO_DIR/artifacts/arkos-reference/modules/$KVER"

# ---------------------------------------------------------------- 1) CLEAN
log "1/5 LIMPAR build antigo"
rm -f  "$X11_IMG"
rm -rf "$PART_DIR"
if [ "${FAST:-0}" = "1" ]; then
    echo "FAST=1 -> mantendo a base debootstrap em $BUILD_DIR/x11-rootfs"
else
    rm -rf "$BUILD_DIR/x11-rootfs"
    echo "removido staging completo (rootfs será refeito do zero)"
fi

# ---------------------------------------------------------------- 2) MÓDULOS
log "2/5 MÓDULOS do kernel $KVER (Wi-Fi dongle)"
if [ -d "$MODSRC" ]; then
    echo "já presente: $MODSRC ($(find "$MODSRC" -name '*.ko' | wc -l) módulos)"
else
    echo "ausente -> extraindo do ArkOS"
    "$SELF_DIR/extract-arkos-modules.sh"
fi

# ---------------------------------------------------------------- 3) BUILD
log "3/5 BUILD da imagem X11 (LENTO ~30-60min sob qemu)"
"$SELF_DIR/build-x11-rootfs.sh"
[ -f "$X11_IMG" ] || die "build terminou mas a imagem não apareceu: $X11_IMG"

# ---------------------------------------------------------------- 4) REGISTRAR
log "4/5 REGISTRAR apelido 'x11' -> $X11_IMG"
"$SELF_DIR/sdcard/sd-image.sh" add x11 "$X11_IMG"

# ---------------------------------------------------------------- 5) GRAVAR
log "5/5 GRAVAR no cartão '$CARD' (dd — apaga o cartão inteiro)"
"$SELF_DIR/sdcard/sd-update.sh" "$CARD" x11

log "CONCLUÍDO — imagem nova gravada em '$CARD'. Insira no R36S."
echo "Pós-boot: pluga o dongle no OTG e confira 'ip link' (deve aparecer wlan0)."
