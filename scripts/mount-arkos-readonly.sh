#!/usr/bin/env bash
#
# mount-arkos-readonly.sh
# -----------------------
# Monta a imagem ArkOS em loop SOMENTE LEITURA, para inspeção de hardware.
# A imagem NUNCA é modificada (loop -r + mount -o ro,noload).
#
# Monta:
#   p1 (FAT  BOOT)    -> mnt/arkos/boot
#   p2 (ext4 rootfs)  -> mnt/arkos/rootfs
#   p3 (exFAT roms)   -> ignorada por padrão (não relevante para o CyberDeck)
#
# Uso:
#   sudo scripts/mount-arkos-readonly.sh [mount]    # monta (padrão)
#   sudo scripts/mount-arkos-readonly.sh umount     # desmonta + remove loop
#
set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE_DIR="$(cd "$REPO_DIR/.." && pwd)"

MNT_BASE="$REPO_DIR/mnt/arkos"
BOOT_MNT="$MNT_BASE/boot"
ROOT_MNT="$MNT_BASE/rootfs"
LOOP_RECORD="$MNT_BASE/.loopdev"

log()  { echo "[mount-ro] $*"; }
die()  { echo "[mount-ro][ERRO] $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Precisa de root. Use: sudo $0 ${1:-mount}"

find_image() {
    local d f
    for d in "$WORKSPACE_DIR/Backups/ArkOS" "$WORKSPACE_DIR/Backup/ArkOS"; do
        [ -d "$d" ] || continue
        f="$(find "$d" -maxdepth 1 -name '*.img' 2>/dev/null | sort | head -1)"
        [ -n "$f" ] && { echo "$f"; return; }
    done
    die "Imagem .img (descomprimida) não encontrada em Backup(s)/ArkOS/."
}

do_umount() {
    log "Desmontando..."
    mountpoint -q "$BOOT_MNT" && umount "$BOOT_MNT" && log "boot desmontado"  || true
    mountpoint -q "$ROOT_MNT" && umount "$ROOT_MNT" && log "rootfs desmontado" || true
    if [ -f "$LOOP_RECORD" ]; then
        local loopdev; loopdev="$(cat "$LOOP_RECORD")"
        if [ -n "$loopdev" ] && losetup "$loopdev" >/dev/null 2>&1; then
            losetup -d "$loopdev" && log "loop $loopdev removido"
        fi
        rm -f "$LOOP_RECORD"
    fi
    log "Cleanup concluído."
}

do_mount() {
    local image; image="$(find_image)"
    log "Imagem: $image"
    mkdir -p "$BOOT_MNT" "$ROOT_MNT"

    # loop somente leitura (-r) com varredura de partições (-P)
    local loopdev
    loopdev="$(losetup --show -f -r -P "$image")" || die "losetup falhou"
    echo "$loopdev" > "$LOOP_RECORD"
    log "loop read-only: $loopdev"

    # Aguarda os nós de partição
    sleep 1
    [ -b "${loopdev}p1" ] || die "${loopdev}p1 não apareceu"

    mount -o ro              "${loopdev}p1" "$BOOT_MNT"  && log "p1 (BOOT)  -> $BOOT_MNT"
    # ext4: noload evita replay de journal (preserva read-only de verdade)
    mount -o ro,noload       "${loopdev}p2" "$ROOT_MNT"  && log "p2 (rootfs)-> $ROOT_MNT"

    log "Montado SOMENTE LEITURA. Para desmontar:"
    log "  sudo $0 umount"
}

case "${1:-mount}" in
    mount)  do_mount ;;
    umount|unmount) do_umount ;;
    *) die "Ação inválida: ${1:-}. Use 'mount' ou 'umount'." ;;
esac
