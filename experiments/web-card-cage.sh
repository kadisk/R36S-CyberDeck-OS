#!/usr/bin/env bash
#
# web-card-cage.sh — instala 'cage' (compositor Wayland kiosk) DIRETO no cartão
# web já gravado (chroot via qemu), troca o blob Mali p/ a variante WAYLAND-gbm e
# instala o launcher/serviço atuais. Evita rebuildar/regravar os ~2 GB.
#
# PRECISA DE ROOT + qemu-aarch64-static (binfmt) + rede.
#
# Uso:
#   sudo scripts/web-card-cage.sh /dev/sdX
#
set -eu
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SELF_DIR/.." && pwd)"

log() { echo "[web-cage] $*"; }
die() { echo "[web-cage][ERRO] $*" >&2; exit 1; }
has() { command -v "$1" >/dev/null 2>&1; }

[ "$(id -u)" -eq 0 ] || die "Precisa de root. Use: sudo $0 /dev/sdX"
DEV="${1:-}"; [ -n "$DEV" ] || die "Uso: sudo $0 /dev/sdX"
P2="${DEV}2"; [ -b "$P2" ] || die "rootfs não existe: $P2 (gravou a imagem web em $DEV?)"
QEMU="$(command -v qemu-aarch64-static)" || die "qemu-aarch64-static ausente"

MNT="$REPO_DIR/mnt/webcard"; mkdir -p "$MNT"
cleanup() { for m in proc sys dev/pts dev; do mountpoint -q "$MNT/$m" 2>/dev/null && umount "$MNT/$m" 2>/dev/null||true; done; mountpoint -q "$MNT" && umount "$MNT" 2>/dev/null||true; }
trap cleanup EXIT
mount "$P2" "$MNT" || die "mount $P2 falhou"
[ -f "$MNT/etc/os-release" ] || die "$P2 não parece o rootfs"
log "rootfs do cartão montado: $MNT"

# 1) cage via chroot (qemu)
if [ ! -x "$MNT/usr/bin/cage" ]; then
    log "instalando 'cage' no cartão (chroot/qemu) — baixa wlroots etc."
    cp "$QEMU" "$MNT/usr/bin/"
    cp -f /etc/resolv.conf "$MNT/etc/resolv.conf" 2>/dev/null || true
    mount -t proc  none "$MNT/proc"; mount -t sysfs none "$MNT/sys"
    mount --bind /dev "$MNT/dev"; mount --bind /dev/pts "$MNT/dev/pts"
    chroot "$MNT" /bin/sh -c 'export DEBIAN_FRONTEND=noninteractive; apt-get update && apt-get install -y --no-install-recommends cage seatd' \
        || { cleanup; die "apt install cage falhou (rede?)"; }
    cleanup; mount "$P2" "$MNT"
else
    log "'cage' já instalado no cartão"
fi

# 2) Mali -> variante WAYLAND-gbm (necessária p/ Wayland-EGL do cog/cage)
WL="$REPO_DIR/artifacts/arkos-reference/mali/libmali-bifrost-g31-rxp0-wayland-gbm.so"
if [ -f "$WL" ]; then
    install -D -m0644 "$WL" "$MNT/opt/mali/libmali.so"
    ( cd "$MNT/opt/mali"
      for sl in libEGL.so.1 libEGL.so libGLESv2.so.2 libGLESv2.so libgbm.so.1 libgbm.so libGLESv1_CM.so.1; do ln -sf libmali.so "$sl"; done )
    echo "/opt/mali" > "$MNT/etc/ld.so.conf.d/00-mali.conf"
    log "Mali trocado p/ variante WAYLAND-gbm em /opt/mali"
else
    log "AVISO: variante wayland-gbm do Mali não encontrada em artifacts/.../mali/"
fi

# 3) launcher + serviço atuais
install -D -m0755 "$REPO_DIR/runtime/scripts/start-cyberdeck-cog.sh" "$MNT/usr/local/bin/start-cyberdeck-cog.sh"
install -D -m0644 "$REPO_DIR/runtime/services/cyberdeck-cog.service" "$MNT/etc/systemd/system/cyberdeck-cog.service"
ln -sf /etc/systemd/system/cyberdeck-cog.service "$MNT/etc/systemd/system/multi-user.target.wants/cyberdeck-cog.service" 2>/dev/null || true
log "launcher (cage+wl) + serviço atualizados"

sync
log "OK. Reinsira no R36S e ligue. Depois leia BOOT:/cyberdeck-cog.log no PC."
