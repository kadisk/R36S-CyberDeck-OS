#!/usr/bin/env bash
#
# prepare-rootfs-partition.sh
# ---------------------------
# Cria a imagem da partição rootfs (ext4) do cartão de teste, em
# artifacts/test-images/build/parts/p2.ext4, populando-a a partir da árvore
# montada por create-minimal-rootfs.sh — SEM root, via `mke2fs -d`.
#
# A UUID é fixada (R36S_ROOTFS_UUID) para casar com root=UUID=... do boot.ini.
# Se houver estado de fakeroot (rootfs.fakeroot), o mke2fs roda sob fakeroot -i
# para preservar dono root:root e os nós de /dev.
#
set -eu
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/phase2-config.sh"

log()  { echo "[rootfs-part] $*"; }
die()  { echo "[rootfs-part][ERRO] $*" >&2; exit 1; }
has()  { command -v "$1" >/dev/null 2>&1; }

[ -d "$ROOTFS_DIR" ] || die "Árvore do rootfs ausente: $ROOTFS_DIR
     Rode antes: scripts/create-minimal-rootfs.sh"

mkdir -p "$PART_DIR"
P2="$PART_DIR/p2.ext4"
SIZE_MB="${P2_SIZE_MIB}"

log "Criando ext4 ${SIZE_MB}MiB (UUID=$R36S_ROOTFS_UUID): $P2"
rm -f "$P2"
truncate -s "${SIZE_MB}M" "$P2"

# mke2fs popula a partir do diretório (-d) sem montar.
MKE2FS=(mke2fs -F -q -t ext4 -L "$R36S_ROOTFS_LABEL" -U "$R36S_ROOTFS_UUID"
        -E root_owner=0:0 -d "$ROOTFS_DIR" "$P2")

if [ -f "$ROOTFS_STATE" ] && has fakeroot; then
    log "Usando estado fakeroot (preserva root:root e nós de /dev)."
    fakeroot -i "$ROOTFS_STATE" -- "${MKE2FS[@]}"
else
    log "Sem estado fakeroot — usando root_owner=0:0 (sem nós de /dev estáticos)."
    "${MKE2FS[@]}"
fi

log "Verificando filesystem (read-only):"
dumpe2fs -h "$P2" 2>/dev/null | grep -iE 'Filesystem volume name|Filesystem UUID|Block count' | sed 's/^/   /'
log "OK: $P2"
