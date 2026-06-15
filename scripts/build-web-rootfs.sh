#!/usr/bin/env bash
#
# build-web-rootfs.sh — Fase 4 (runtime web): monta um rootfs Debian arm64 com
# cog (WPE WebKit) para rodar a CyberDeck UI (HTML/JS) em kiosk no R36S.
#
# ⚠️ PRECISA DE ROOT (debootstrap cria nós de dispositivo e faz chroot).
# ⚠️ PESADO: baixa centenas de MB e usa qemu-aarch64-static (emulação lenta).
#
# Etapas:
#   4a  Debian bookworm arm64 mínimo (debootstrap 2 estágios) + autologin no tty1.
#   4b  cog + wpewebkit + EGL/GLES (o blob Mali vem do ArkOS via
#       scripts/extract-arkos-mali.sh — rode antes; ver docs/web-ui/phase4-wpe-plan.md).
#   4c  instala a cyberdeck-ui + serviço que lança o cog em kiosk.
#
# Saída: $BUILD_DIR/web-rootfs/  (depois empacote com --package p/ gerar a .img)
#
# Uso:
#   sudo scripts/build-web-rootfs.sh           # monta o rootfs Debian + cog + UI
#   sudo scripts/build-web-rootfs.sh --package # + gera a imagem (clone do boot ArkOS)
#
set -eu
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF_DIR/phase2-config.sh"

log()  { echo "[web-rootfs] $*"; }
die()  { echo "[web-rootfs][ERRO] $*" >&2; exit 1; }
has()  { command -v "$1" >/dev/null 2>&1; }

[ "$(id -u)" -eq 0 ] || die "Precisa de root. Use: sudo $0 $*"
has qemu-aarch64-static || die "qemu-aarch64-static ausente (pacote qemu-user-static)."

SUITE=bookworm
MIRROR=http://deb.debian.org/debian
WEB_ROOTFS="$BUILD_DIR/web-rootfs"
QEMU="$(command -v qemu-aarch64-static)"
MALI_SRC="$REPO_DIR/artifacts/arkos-reference/mali"
# 'cog' já puxa wpewebkit + WPEBackend-fdo como dependências; não fixamos sonames.
PKGS="cog libegl1 libgles2 libgbm1 fonts-dejavu-core ca-certificates"

# debootstrap: usa o do sistema ou o extraído em /tmp/dbs/out
DEBOOTSTRAP="$(command -v debootstrap || true)"
[ -z "$DEBOOTSTRAP" ] && [ -x /tmp/dbs/out/usr/sbin/debootstrap ] && \
    DEBOOTSTRAP="/tmp/dbs/out/usr/sbin/debootstrap" && \
    export DEBOOTSTRAP_DIR=/tmp/dbs/out/usr/share/debootstrap
[ -n "$DEBOOTSTRAP" ] || die "debootstrap ausente. sudo apt-get install debootstrap"

mkdir -p "$BUILD_DIR"

# ---------------------------------------------------------------------------
# 4a — base Debian arm64 (2 estágios)
# ---------------------------------------------------------------------------
if [ ! -e "$WEB_ROOTFS/etc/os-release" ]; then
    log "debootstrap estágio 1 (Debian $SUITE arm64) — pode demorar"
    "$DEBOOTSTRAP" --arch=arm64 --foreign --variant=minbase \
        --include=dbus,systemd-sysv,udev "$SUITE" "$WEB_ROOTFS" "$MIRROR"
    cp "$QEMU" "$WEB_ROOTFS/usr/bin/"
    log "debootstrap estágio 2 (sob qemu)"
    chroot "$WEB_ROOTFS" /debootstrap/debootstrap --second-stage
else
    log "rootfs base já existe — pulando debootstrap"
fi

# ---------------------------------------------------------------------------
# 4b/4c — cog + UI + serviço, dentro do chroot (emulado)
# ---------------------------------------------------------------------------
# UI e scripts pro rootfs
install -d "$WEB_ROOTFS/usr/share/cyberdeck-ui"
cp -a "$REPO_DIR/cyberdeck-ui/public" "$WEB_ROOTFS/usr/share/cyberdeck-ui/"
install -D -m0755 "$REPO_DIR/runtime/scripts/start-cyberdeck-cog.sh" \
    "$WEB_ROOTFS/usr/local/bin/start-cyberdeck-cog.sh"
install -D -m0644 "$REPO_DIR/runtime/services/cyberdeck-cog.service" \
    "$WEB_ROOTFS/etc/systemd/system/cyberdeck-cog.service"

# Blob Mali do ArkOS (EGL/GLES), se já extraído
if [ -d "$MALI_SRC" ] && ls "$MALI_SRC"/libMali* >/dev/null 2>&1; then
    install -d "$WEB_ROOTFS/opt/mali"
    cp -a "$MALI_SRC"/. "$WEB_ROOTFS/opt/mali/"
    echo "/opt/mali" > "$WEB_ROOTFS/etc/ld.so.conf.d/00-mali.conf"
    log "libMali do ArkOS copiado p/ /opt/mali (provedor EGL/GLES)"
else
    log "AVISO: libMali do ArkOS ausente — rode scripts/extract-arkos-mali.sh antes."
    log "       Sem ele, o cog não terá EGL/GLES acelerado (Fase 4b incompleta)."
fi

cat > "$WEB_ROOTFS/root/setup-cog.sh" <<EOF
#!/bin/sh
set -e
export DEBIAN_FRONTEND=noninteractive
echo "deb $MIRROR $SUITE main" > /etc/apt/sources.list
echo "deb $MIRROR ${SUITE}-updates main" >> /etc/apt/sources.list
apt-get update
apt-get install -y --no-install-recommends $PKGS
ldconfig
# autologin no tty1 (p/ ver o boot; o serviço cog assume a tela)
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf <<X
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin root --noclear %I \$TERM
X
systemctl enable cyberdeck-cog.service
echo "root:cyberdeck" | chpasswd
apt-get clean
EOF
chmod +x "$WEB_ROOTFS/root/setup-cog.sh"

log "instalando cog/wpewebkit dentro do chroot (qemu — LENTO)"
cp "$QEMU" "$WEB_ROOTFS/usr/bin/" 2>/dev/null || true
mount -t proc none "$WEB_ROOTFS/proc" 2>/dev/null || true
chroot "$WEB_ROOTFS" /root/setup-cog.sh || die "setup-cog falhou (rede? pacote?)"
umount "$WEB_ROOTFS/proc" 2>/dev/null || true
rm -f "$WEB_ROOTFS/root/setup-cog.sh"

log "rootfs web pronto: $WEB_ROOTFS"
log "tamanho: $(du -sh "$WEB_ROOTFS" | cut -f1)"

# ---------------------------------------------------------------------------
# Empacotamento opcional -> imagem (clone do boot ArkOS, p2 maior, rootfs Debian)
# ---------------------------------------------------------------------------
if [ "${1:-}" = "--package" ]; then
    log "empacotando imagem (rootfs Debian na p2 do ArkOS)"
    WEB_P2_MIB="${WEB_P2_MIB:-2048}"
    P2="$PART_DIR/web-p2.ext4"; mkdir -p "$PART_DIR"
    rm -f "$P2"; truncate -s "${WEB_P2_MIB}M" "$P2"
    mke2fs -F -q -t ext4 -L CYBERDECK -U "$R36S_ROOTFS_UUID" -d "$WEB_ROOTFS" "$P2"
    ARKOS="$(find_arkos_img)" || die "ArkOS img não encontrada p/ clonar o boot"
    p2s="$(fdisk -l "$ARKOS" 2>/dev/null | awk -v i="${ARKOS}2" '$1==i{for(c=2;c<=NF;c++) if($c~/^[0-9]+$/){print $c;exit}}')"
    OUT="$OUT_DIR/r36s-cyberdeck-web.img"
    tot=$(( p2s + WEB_P2_MIB*2048 + IMG_SLACK_SECTOR ))
    rm -f "$OUT"; truncate -s $(( tot*512 )) "$OUT"
    dd if="$ARKOS" of="$OUT" bs=512 count="$p2s" conv=notrunc status=none
    MTOOLS_SKIP_CHECK=1 mdel  -i "$OUT@@$((32768*512))" ::/boot.ini 2>/dev/null || true
    MTOOLS_SKIP_CHECK=1 mcopy -i "$OUT@@$((32768*512))" "$TEST_BOOT_INI" ::/boot.ini
    dd if="$P2" of="$OUT" bs=512 seek="$p2s" conv=notrunc status=none
    chown "$(stat -c '%U:%G' "$REPO_DIR")" "$OUT" 2>/dev/null || true
    log "IMAGEM WEB: $OUT  (sha256 $(sha256sum "$OUT" | awk '{print $1}'))"
fi
log "Concluído."
