#!/usr/bin/env bash
#
# extract-arkos-mali.sh — extrai o blob Mali (EGL/GLES/GBM) do rootfs ArkOS para
# artifacts/arkos-reference/mali/. É o provedor de EGL/GLES da Mali-G31 que casa
# com a KMD do kernel 4.4 — necessário p/ o cog/WPE (Fase 4b).
#
# A imagem ArkOS é montada SOMENTE LEITURA. PRECISA DE ROOT (loop mount).
#
set -eu
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF_DIR/../scripts/phase2-config.sh"

log() { echo "[mali] $*"; }
die() { echo "[mali][ERRO] $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Precisa de root. Use: sudo $0"
ARKOS="$(find_arkos_img)" || die "imagem ArkOS não encontrada"

DEST="$REPO_DIR/artifacts/arkos-reference/mali"
MNT="$REPO_DIR/mnt/arkos-root"
mkdir -p "$DEST" "$MNT"

# p2 (rootfs) offset
p2s="$(fdisk -l "$ARKOS" 2>/dev/null | awk -v i="${ARKOS}2" '$1==i{for(c=2;c<=NF;c++) if($c~/^[0-9]+$/){print $c;exit}}')"
[ -n "$p2s" ] || die "não detectei a p2 do ArkOS"
OFF=$(( p2s * 512 ))

LOOP="$(losetup --show -f -r -o "$OFF" "$ARKOS")" || die "losetup falhou"
trap 'umount "$MNT" 2>/dev/null||true; losetup -d "$LOOP" 2>/dev/null||true' EXIT
mount -o ro,noload "$LOOP" "$MNT" || die "mount ro falhou"
log "ArkOS rootfs montado (ro): $MNT"

# Acha libMali.so* e os symlinks de EGL/GLES/GBM que apontam p/ ele.
found=0
while IFS= read -r -d '' f; do
    cp -a "$f" "$DEST/" && log "copiado: $(basename "$f")" && found=1
done < <(find "$MNT" \( -name 'libMali*.so*' -o -name 'libmali*.so*' \) -print0 2>/dev/null)
[ "$found" = 1 ] || die "libMali não encontrado no rootfs ArkOS"

# Symlinks/loaders EGL/GLES/GBM (registram quais nomes o WPE espera)
{
    echo "# Symlinks EGL/GLES/GBM no rootfs ArkOS (apontam p/ libMali) — referência"
    find "$MNT" \( -name 'libEGL.so*' -o -name 'libGLESv2.so*' -o -name 'libGLESv1*' \
        -o -name 'libgbm.so*' -o -name 'libGLES_CM*' \) -printf '%p -> ' -exec readlink {} \; 2>/dev/null
} > "$DEST/egl-gles-symlinks.txt"

log "Extraído em: $DEST"
log "Próximo: rode (sudo) scripts/build-web-rootfs.sh (Fase 4b usa /opt/mali)."
