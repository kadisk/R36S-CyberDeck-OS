#!/usr/bin/env bash
#
# create-minimal-rootfs.sh
# ------------------------
# Monta a árvore de um rootfs MÍNIMO aarch64 para o R36S (Fase 2), em
# artifacts/test-images/build/rootfs/, a partir de:
#   - BusyBox aarch64 (static)  -> /bin/busybox + symlinks de todos os applets
#   - board/r36s/rootfs-overlay/ -> /etc/{inittab,fstab,issue,os-release}, rcS
#
# NÃO precisa de root: re-executa sob fakeroot (se disponível) para deixar os
# arquivos como root:root e criar /dev/{console,null,tty}. O estado do fakeroot
# é salvo em rootfs.fakeroot para o mke2fs (prepare-rootfs-partition.sh) reusar.
#
# Sem WPE/Cage/Weston/Node/ES/RetroArch — só shell de debug.
#
set -eu
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/phase2-config.sh"

log()  { echo "[rootfs] $*"; }
die()  { echo "[rootfs][ERRO] $*" >&2; exit 1; }
has()  { command -v "$1" >/dev/null 2>&1; }

# ----------------------------------------------------------------------------
# Re-exec sob fakeroot (uma vez), para perms root:root e nós de /dev.
# ----------------------------------------------------------------------------
if [ -z "${UNDER_FAKEROOT:-}" ]; then
    mkdir -p "$BUILD_DIR" "$REPORT_DIR"
    if has fakeroot; then
        log "Re-executando sob fakeroot (root:root + nós de /dev)."
        exec fakeroot -s "$ROOTFS_STATE" -- env UNDER_FAKEROOT=1 bash "$0" "$@"
    else
        log "AVISO: fakeroot ausente — arquivos ficarão com seu uid e sem nós de"
        log "       /dev. O rootfs ainda deve bootar (devtmpfs cria /dev). Siga."
        export UNDER_FAKEROOT=0
    fi
fi

# ----------------------------------------------------------------------------
# 1. Obter BusyBox aarch64
# ----------------------------------------------------------------------------
get_busybox() {
    if [ -n "${BUSYBOX_ARM64:-}" ]; then
        [ -f "$BUSYBOX_ARM64" ] || die "BUSYBOX_ARM64 não existe: $BUSYBOX_ARM64"
        cp -f "$BUSYBOX_ARM64" "$BUSYBOX_CACHE"
    elif [ -f "$BUSYBOX_CACHE" ]; then
        log "BusyBox em cache: $BUSYBOX_CACHE"
    else
        has dpkg-deb || die "dpkg-deb necessário p/ extrair o BusyBox arm64"
        local tmp; tmp="$(mktemp -d)"
        log "Baixando BusyBox aarch64: $BUSYBOX_DEB_URL"
        if   has curl; then curl -fsSL -o "$tmp/bb.deb" "$BUSYBOX_DEB_URL"
        elif has wget; then wget -qO "$tmp/bb.deb" "$BUSYBOX_DEB_URL"
        else die "curl/wget ausentes e sem BUSYBOX_ARM64; forneça o binário."; fi
        dpkg-deb -x "$tmp/bb.deb" "$tmp/out"
        local bb; bb="$(find "$tmp/out" -type f -name busybox | head -1)"
        [ -n "$bb" ] || die "busybox não encontrado no .deb"
        cp -f "$bb" "$BUSYBOX_CACHE"; rm -rf "$tmp"
    fi
    chmod +x "$BUSYBOX_CACHE"
    file "$BUSYBOX_CACHE" | grep -q 'ARM aarch64' \
        || die "BusyBox em cache NÃO é aarch64: $(file "$BUSYBOX_CACHE")"
    log "BusyBox aarch64 OK: $(file -b "$BUSYBOX_CACHE" | cut -d, -f1-2)"
}

# Applets do busybox (via qemu-aarch64-static; ou binfmt; ou fallback fixo).
busybox_applets() {
    if has qemu-aarch64-static; then
        qemu-aarch64-static "$BUSYBOX_CACHE" --list 2>/dev/null
    elif [ -e /proc/sys/fs/binfmt_misc/qemu-aarch64 ]; then
        "$BUSYBOX_CACHE" --list 2>/dev/null
    fi
}

# ----------------------------------------------------------------------------
# 2. Montar a árvore
# ----------------------------------------------------------------------------
build_tree() {
    rm -rf "$ROOTFS_DIR"
    mkdir -p "$ROOTFS_DIR"/{bin,sbin,usr/bin,usr/sbin,etc/init.d,proc,sys,dev/pts,run,tmp,root,mnt}
    chmod 1777 "$ROOTFS_DIR/tmp"

    install -m 0755 "$BUSYBOX_CACHE" "$ROOTFS_DIR/bin/busybox"
    local applets a n=0
    applets="$(busybox_applets)"
    if [ -n "$applets" ]; then
        for a in $applets; do
            [ "$a" = "busybox" ] && continue
            ln -sf /bin/busybox "$ROOTFS_DIR/bin/$a"; n=$((n+1))
        done
        log "Symlinks de applets: $n"
    else
        for a in sh ls cat mount umount mkdir echo uname date grep head dmesg \
                 ln cp mv rm ps cut sleep reboot poweroff init getty login vi; do
            ln -sf /bin/busybox "$ROOTFS_DIR/bin/$a"
        done
        log "Sem lista de applets (qemu?); symlinks essenciais criados."
    fi
    ln -sf /bin/busybox "$ROOTFS_DIR/sbin/init"
    ln -sf bin/busybox  "$ROOTFS_DIR/init"

    if [ -d "$ROOTFS_OVERLAY" ]; then
        cp -a "$ROOTFS_OVERLAY/." "$ROOTFS_DIR/"
        log "Overlay aplicado de board/r36s/rootfs-overlay/"
    fi
    chmod 0755 "$ROOTFS_DIR"/etc/init.d/* 2>/dev/null || true

    mknod -m 600 "$ROOTFS_DIR/dev/console" c 5 1 2>/dev/null || true
    mknod -m 666 "$ROOTFS_DIR/dev/null"    c 1 3 2>/dev/null || true
    mknod -m 666 "$ROOTFS_DIR/dev/tty"     c 5 0 2>/dev/null || true
    mknod -m 622 "$ROOTFS_DIR/dev/tty1"    c 4 1 2>/dev/null || true

    chown -R 0:0 "$ROOTFS_DIR" 2>/dev/null || true
}

# ----------------------------------------------------------------------------
mkdir -p "$BUILD_DIR" "$REPORT_DIR"
get_busybox
build_tree

{
    echo "# Rootfs mínimo (Fase 2) — $(date -Iseconds)"
    echo "# BusyBox: $(file -b "$BUSYBOX_CACHE")"
    echo "# fakeroot: ${UNDER_FAKEROOT}"
    echo "# Árvore: $ROOTFS_DIR"
    echo
    echo "## Conteúdo (2 níveis)"
    ( cd "$ROOTFS_DIR" && find . -maxdepth 2 ! -path './bin/*' | sort )
    echo "  (+ $(ls "$ROOTFS_DIR/bin" | wc -l) entradas em /bin — applets busybox)"
    echo
    echo "## Nós de /dev"
    ls -l "$ROOTFS_DIR/dev" 2>/dev/null
    echo
    echo "## Tamanho"
    du -sh "$ROOTFS_DIR" 2>/dev/null
} > "$REPORT_DIR/minimal-rootfs.txt"

[ "${UNDER_FAKEROOT}" = "1" ] && log "Estado fakeroot salvo: $ROOTFS_STATE"
log "Rootfs pronto: $ROOTFS_DIR"
log "Relatório: $REPORT_DIR/minimal-rootfs.txt"
