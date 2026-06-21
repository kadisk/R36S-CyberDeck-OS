#!/usr/bin/env bash
#
# inject-wifi-modules.sh
# ----------------------
# Injeta a árvore de módulos do kernel BSP 4.4.189 na partição rootfs (p2) de uma
# imagem JÁ GRAVÁVEL do CyberDeck, sem refazer o rootfs (sem qemu/debootstrap).
# Habilita o reconhecimento do dongle Wi-Fi USB RTL8188FTV (8188fu, 0bda:f179)
# e demais drivers .ko que o rootfs Debian não tinha.
#
# Idempotente: re-injeta por cima. Depois é só regravar a imagem no cartão.
#
# Uso:  sudo scripts/inject-wifi-modules.sh [caminho/para.img]
#       (padrão: artifacts/test-images/r36s-cyberdeck-x11.img)
#
set -eu
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF_DIR/phase2-config.sh"

KVER="${KVER:-4.4.189}"
IMG="${1:-$OUT_DIR/r36s-cyberdeck-x11.img}"
MODSRC="$REPO_DIR/artifacts/arkos-reference/modules/$KVER"

log() { echo "[wifi] $*"; }
die() { echo "[wifi][ERRO] $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Precisa de root. Use: sudo $0 ${1:-}"
[ -f "$IMG" ]    || die "imagem não encontrada: $IMG"
[ -d "$MODSRC" ] || die "módulos $KVER ausentes: $MODSRC
     Rode antes: sudo scripts/extract-arkos-modules.sh"

# offset da p2 (rootfs) da NOSSA imagem em setores
p2s="$(fdisk -l "$IMG" 2>/dev/null | awk -v i="${IMG}2" '$1==i{for(c=2;c<=NF;c++) if($c~/^[0-9]+$/){print $c;exit}}')"
[ -n "$p2s" ] || die "p2 não detectada em $IMG"

MNT="$(mktemp -d)"
cleanup() { mountpoint -q "$MNT" && umount "$MNT" 2>/dev/null || true; rmdir "$MNT" 2>/dev/null || true; }
trap cleanup EXIT

log "montando p2 (rw) de $(basename "$IMG")"
mount -o rw,loop,offset=$((p2s*512)) "$IMG" "$MNT"

log "copiando módulos $KVER ($(du -sh "$MODSRC"|cut -f1)) -> /lib/modules"
install -d "$MNT/lib/modules"
rm -rf "$MNT/lib/modules/$KVER"
cp -a "$MODSRC" "$MNT/lib/modules/$KVER"

log "depmod (gera modules.dep/alias para autoload por udev)"
depmod -b "$MNT" "$KVER"

# Força o 8188fu (autocontido, sem firmware avulso) p/ o RTL8188FTV;
# evita o rtl8188fu, que pede rtlwifi/rtl8188fufw.bin separado.
printf 'blacklist rtl8188fu\n' > "$MNT/etc/modprobe.d/cyberdeck-wifi.conf"
printf '8188fu\n'             > "$MNT/etc/modules-load.d/cyberdeck-wifi.conf"

sync
log "OK. Confirmação do alias do dongle:"
grep -i 'f179' "$MNT/lib/modules/$KVER/modules.alias" | sed 's/^/   /' || true
log "Agora regrave a imagem no cartão:  sudo scripts/sdcard/sd-update.sh <cartao> x11"
