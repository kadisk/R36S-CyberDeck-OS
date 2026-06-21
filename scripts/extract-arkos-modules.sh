#!/usr/bin/env bash
#
# extract-arkos-modules.sh
# ------------------------
# Extrai a árvore de módulos do kernel BSP (/lib/modules/4.4.189) da imagem ArkOS
# para artifacts/arkos-reference/modules/ — para que o build do rootfs Debian
# (que NÃO tem /lib/modules da 4.4) possa instalá-la e, assim, reconhecer
# dongles USB (Wi-Fi RTL8188FTV/8188fu = 0bda:f179, etc.) e demais drivers .ko.
#
# A árvore NÃO é versionada (ver .gitignore); regenere quando trocar de ArkOS.
# A imagem ArkOS é aberta SOMENTE LEITURA e nunca é modificada.
#
# Uso:  sudo scripts/extract-arkos-modules.sh
#
set -eu
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF_DIR/phase2-config.sh"

KVER="${KVER:-4.4.189}"
DST="$REPO_DIR/artifacts/arkos-reference/modules"

log() { echo "[mods] $*"; }
die() { echo "[mods][ERRO] $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Precisa de root. Use: sudo $0"

ARKOS="$(find_arkos_img)" || die "imagem ArkOS não encontrada (Backups/ArkOS)"
log "ArkOS: $ARKOS"

# offset da p2 (rootfs ext4) em setores
p2s="$(fdisk -l "$ARKOS" 2>/dev/null | awk -v i="${ARKOS}2" '$1==i{for(c=2;c<=NF;c++) if($c~/^[0-9]+$/){print $c;exit}}')"
[ -n "$p2s" ] || die "p2 do ArkOS não detectada"

MNT="$(mktemp -d)"
cleanup() { mountpoint -q "$MNT" && umount "$MNT" 2>/dev/null || true; rmdir "$MNT" 2>/dev/null || true; }
trap cleanup EXIT

log "montando p2 (ro,noload) em $MNT"
mount -o ro,noload,loop,offset=$((p2s*512)) "$ARKOS" "$MNT"

SRC="$MNT/lib/modules/$KVER"
[ -d "$SRC" ] || die "árvore $KVER ausente no ArkOS: $SRC"

mkdir -p "$DST"
rm -rf "${DST:?}/$KVER"
log "copiando $KVER ($(du -sh "$SRC"|cut -f1))"
cp -a "$SRC" "$DST/$KVER"

# dono do repo (rodamos sob sudo)
chown -R "$(stat -c '%U:%G' "$REPO_DIR")" "$DST" 2>/dev/null || true

log "OK: $DST/$KVER ($(find "$DST/$KVER" -name '*.ko'|wc -l) módulos)"
log "alias do RTL8188FTV (0bda:f179):"
grep -i 'f179' "$DST/$KVER/modules.alias" | sed 's/^/   /' || true
