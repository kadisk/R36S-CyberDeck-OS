#!/usr/bin/env bash
#
# build-mainline-rootfs.sh — Fase 5. Monta a imagem final: BOOT do Arch-R (U-Boot +
# kernel 6.12 + DTB + overlays + auto-detecção de painel, INTACTO) + nosso rootfs
# Debian arm64 com **Mesa Panfrost** (GBM/EGL/GLES modernos) + cog/cage + cyberdeck-ui
# + os módulos 6.12.79. Sem blob Mali.
#
# Resultado: GBM do Mesa tem gbm_bo_get_offset -> cog/cage renderiza a UI (resolve o
# bloqueio da Fase 4). O root é a p2 (boot.scr do Arch-R usa /dev/mmcblkXp2).
#
# ⚠️ PRECISA DE ROOT (debootstrap/chroot/mke2fs). PESADO (qemu): ~30-45 min.
#
# Pré-requisitos: scripts/extract-mainline-kernel.sh já rodado (artifacts/mainline/).
#
# Uso:  sudo scripts/build-mainline-rootfs.sh
#
set -eu
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF_DIR/phase2-config.sh"

log(){ echo "[ml-rootfs] $*"; }
die(){ echo "[ml-rootfs][ERRO] $*" >&2; exit 1; }
has(){ command -v "$1" >/dev/null 2>&1; }

[ "$(id -u)" -eq 0 ] || die "Precisa de root. Use: sudo $0"
has qemu-aarch64-static || die "qemu-aarch64-static ausente"
QEMU="$(command -v qemu-aarch64-static)"

ML="$REPO_DIR/artifacts/mainline"
ARCHR_IMG="$(ls "$ML"/ArchR-R36S*original.img 2>/dev/null | head -1)"
[ -f "$ARCHR_IMG" ] || die "imagem Arch-R (.img descomprimida) não está em $ML — rode extract-mainline-kernel.sh"
MODS="$ML/modules/6.12.79"
[ -d "$MODS" ] || die "módulos 6.12.79 ausentes ($MODS)"
KVER=6.12.79

SUITE=bookworm
MIRROR=http://deb.debian.org/debian
RF="$BUILD_DIR/ml-rootfs"
P2_MIB="${P2_MIB:-3072}"
OUT="$OUT_DIR/r36s-cyberdeck-mainline.img"
# Mesa Panfrost + Wayland kiosk + WPE
PKGS="cog cage seatd \
      libgl1-mesa-dri libegl-mesa0 libgbm1 libegl1 libgles2 \
      mesa-utils fonts-dejavu-core ca-certificates"

DEBOOTSTRAP="$(command -v debootstrap || true)"
[ -z "$DEBOOTSTRAP" ] && [ -x /tmp/dbs/out/usr/sbin/debootstrap ] && \
    DEBOOTSTRAP=/tmp/dbs/out/usr/sbin/debootstrap && export DEBOOTSTRAP_DIR=/tmp/dbs/out/usr/share/debootstrap
[ -n "$DEBOOTSTRAP" ] || die "debootstrap ausente"

mkdir -p "$BUILD_DIR" "$OUT_DIR" "$PART_DIR"
cleanup(){ for m in proc sys dev/pts dev; do mountpoint -q "$RF/$m" 2>/dev/null && umount "$RF/$m" 2>/dev/null||true; done; }
trap cleanup EXIT
cleanup

# ---------------------------------------------------------------------------
# 1. Base Debian arm64
# ---------------------------------------------------------------------------
if [ ! -f "$RF/.ml-base-ok" ]; then
    log "debootstrap Debian $SUITE arm64 (base) — pode demorar"
    rm -rf "$RF"
    "$DEBOOTSTRAP" --arch=arm64 --foreign --variant=minbase \
        --include=dbus,systemd-sysv,udev,kmod "$SUITE" "$RF" "$MIRROR"
    cp "$QEMU" "$RF/usr/bin/"
    env -u DEBOOTSTRAP_DIR chroot "$RF" /debootstrap/debootstrap --second-stage
    touch "$RF/.ml-base-ok"
else
    log "base já existe — pulando debootstrap"
fi
cp "$QEMU" "$RF/usr/bin/" 2>/dev/null || true

# ---------------------------------------------------------------------------
# 2. Módulos do kernel 6.12.79 + UI + launcher + serviço + fstab
# ---------------------------------------------------------------------------
log "copiando módulos $KVER ($(du -sh "$MODS"|cut -f1))"
install -d "$RF/usr/lib/modules"
cp -a "$MODS" "$RF/usr/lib/modules/$KVER"

install -d "$RF/usr/share/cyberdeck-ui"
cp -a "$REPO_DIR/cyberdeck-ui/public" "$RF/usr/share/cyberdeck-ui/"
install -D -m0755 "$REPO_DIR/runtime/scripts/start-cyberdeck-cog.sh" "$RF/usr/local/bin/start-cyberdeck-cog.sh"
install -D -m0644 "$REPO_DIR/runtime/services/cyberdeck-cog.service" "$RF/etc/systemd/system/cyberdeck-cog.service"

# root é a p2; monta rw via fstab (não há initrd, kernel monta direto)
cat > "$RF/etc/fstab" <<EOF
LABEL=ARCHR_ROOT  /  ext4  defaults,noatime  0 1
EOF
cat > "$RF/etc/os-release" <<EOF
NAME="R36S CyberDeck OS"
ID=r36s-cyberdeck-os
VERSION="0.5-mainline-panfrost"
PRETTY_NAME="R36S CyberDeck OS (mainline 6.12 + Panfrost)"
EOF
echo "r36s-cyberdeck" > "$RF/etc/hostname"
# garante autoload do Panfrost (GPU) — Mesa precisa do /dev/dri/renderD128
install -d "$RF/etc/modules-load.d"
echo panfrost > "$RF/etc/modules-load.d/panfrost.conf"

# ---------------------------------------------------------------------------
# 3. Pacotes (Mesa Panfrost + cog/cage) + autologin + serviço + depmod
# ---------------------------------------------------------------------------
cp -f /etc/resolv.conf "$RF/etc/resolv.conf" 2>/dev/null || true
cat > "$RF/root/setup-ml.sh" <<EOF
#!/bin/sh
set -e
export DEBIAN_FRONTEND=noninteractive
echo "deb $MIRROR $SUITE main" > /etc/apt/sources.list
echo "deb $MIRROR ${SUITE}-updates main" >> /etc/apt/sources.list
apt-get update
apt-get install -y --no-install-recommends $PKGS
# autologin no tty1 (debug; o serviço cog assume a tela via cage)
mkdir -p /etc/systemd/system/getty@tty1.service.d
printf '[Service]\nExecStart=\nExecStart=-/sbin/agetty --autologin root --noclear %%I \$TERM\n' \
    > /etc/systemd/system/getty@tty1.service.d/autologin.conf
systemctl enable cyberdeck-cog.service
echo "root:cyberdeck" | chpasswd
depmod $KVER || true
ldconfig
apt-get clean
EOF
chmod +x "$RF/root/setup-ml.sh"

mount -t proc none "$RF/proc"; mount -t sysfs none "$RF/sys"
mount --bind /dev "$RF/dev"; mount --bind /dev/pts "$RF/dev/pts"
log "instalando Mesa Panfrost + cog/cage (chroot/qemu — LENTO)"
chroot "$RF" /root/setup-ml.sh || { cleanup; die "setup-ml falhou (rede/pacote?)"; }
cleanup
rm -f "$RF/root/setup-ml.sh"
log "rootfs mainline pronto: $(du -sh "$RF"|cut -f1)"

# ---------------------------------------------------------------------------
# 4. ext4 da p2 (rótulo ARCHR_ROOT) + montagem da imagem (BOOT do Arch-R + nossa p2)
# ---------------------------------------------------------------------------
P2="$PART_DIR/ml-p2.ext4"
log "mke2fs ext4 ${P2_MIB}MiB (label ARCHR_ROOT) a partir do rootfs"
rm -f "$P2"; truncate -s "${P2_MIB}M" "$P2"
mke2fs -F -q -t ext4 -L ARCHR_ROOT -d "$RF" "$P2"

archr_p2_start="$(fdisk -l "$ARCHR_IMG" 2>/dev/null | awk -v i="${ARCHR_IMG}2" '$1==i{for(c=2;c<=NF;c++) if($c~/^[0-9]+$/){print $c;exit}}')"
[ -n "$archr_p2_start" ] || die "não detectei p2 do Arch-R"
log "clonando boot do Arch-R: setores 0..$((archr_p2_start-1)) ($((archr_p2_start/2048))MiB)"
tot=$(( archr_p2_start + P2_MIB*2048 + IMG_SLACK_SECTOR ))
rm -f "$OUT"; truncate -s $(( tot*512 )) "$OUT"
dd if="$ARCHR_IMG" of="$OUT" bs=512 count="$archr_p2_start" conv=notrunc status=none
dd if="$P2" of="$OUT" bs=512 seek="$archr_p2_start" conv=notrunc status=none
chown "$(stat -c '%U:%G' "$REPO_DIR")" "$OUT" 2>/dev/null || true

SHA="$(sha256sum "$OUT" | awk '{print $1}')"
{
    echo "# Imagem mainline (Fase 5) — $(date -Iseconds)"
    echo "- $OUT"
    echo "- sha256: $SHA  | tamanho: $(stat -c %s "$OUT") bytes"
    echo "- BOOT: clonado do Arch-R (U-Boot+kernel 6.12.79+DTB+overlays+auto-painel)"
    echo "- ROOTFS (p2): Debian + Mesa Panfrost + cog/cage + cyberdeck-ui + módulos $KVER"
} > "$REPORT_DIR/mainline-image.md"

log "IMAGEM PRONTA: $OUT"
log "sha256: $SHA"
log "Grave (confira lsblk):  sudo dd if=$OUT of=/dev/sdX bs=4M status=progress conv=fsync"
log "No boot: o cog deve renderizar a UI (log em BOOT/var: /var/log/cyberdeck-cog.log)."
