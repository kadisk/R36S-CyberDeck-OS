#!/usr/bin/env bash
#
# patch-web-card.sh — aplica o launcher/serviço do cog mais recentes num cartão
# JÁ GRAVADO com a imagem web, sem precisar rebuildar/regravar os ~2 GB.
# Útil p/ iterar rápido a Fase 4 (EGL/Mali/cog).
#
# A p2 do cartão é o rootfs Debian (no offset da p2 do ArkOS).
#
# Uso:
#   sudo scripts/patch-web-card.sh /dev/sdX
#
set -eu
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SELF_DIR/.." && pwd)"

log() { echo "[patch-web] $*"; }
die() { echo "[patch-web][ERRO] $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Precisa de root. Use: sudo $0 /dev/sdX"
DEV="${1:-}"; [ -n "$DEV" ] || die "Uso: sudo $0 /dev/sdX"
P2="${DEV}2"; [ -b "$P2" ] || die "Partição rootfs não existe: $P2 (gravou a imagem web em $DEV?)"

MNT="$REPO_DIR/mnt/webcard"; mkdir -p "$MNT"
trap 'umount "$MNT" 2>/dev/null || true' EXIT
mount "$P2" "$MNT" || die "mount $P2 falhou"
[ -f "$MNT/etc/os-release" ] || die "$P2 não parece o rootfs (sem /etc/os-release)"
log "rootfs montado: $MNT ($(grep -m1 PRETTY_NAME "$MNT/etc/os-release" | cut -d= -f2-))"

install -D -m0755 "$REPO_DIR/runtime/scripts/start-cyberdeck-cog.sh" \
    "$MNT/usr/local/bin/start-cyberdeck-cog.sh"
install -D -m0644 "$REPO_DIR/runtime/services/cyberdeck-cog.service" \
    "$MNT/etc/systemd/system/cyberdeck-cog.service"
log "launcher + serviço atualizados no cartão."

# Garante o serviço habilitado (symlink no multi-user.target.wants).
ln -sf /etc/systemd/system/cyberdeck-cog.service \
    "$MNT/etc/systemd/system/multi-user.target.wants/cyberdeck-cog.service" 2>/dev/null || true

sync
log "OK. Reinsira no R36S e ligue. Após o teste, leia BOOT:/cyberdeck-cog.log no PC."
