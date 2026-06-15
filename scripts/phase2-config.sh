#!/usr/bin/env bash
# phase2-config.sh — constantes compartilhadas da Fase 2 (boot mínimo).
# Sourced pelos demais scripts. Não executa nada sozinho.
# Tudo aqui é sobre a IMAGEM DE TESTE do CyberDeck — a imagem ArkOS é só leitura.

# --- Identidade da partição rootfs de teste (fixa p/ casar com o boot.ini) -----
# Gerada uma vez; mantida fixa para que board/r36s/boot/boot.ini e o mke2fs batam.
: "${R36S_ROOTFS_UUID:=c1be7dec-0de0-4a17-9f3a-7e5b00c0de36}"
: "${R36S_BOOT_LABEL:=BOOT}"
: "${R36S_ROOTFS_LABEL:=ROOTFS}"

# --- Geometria do cartão de teste (espelha o esquema validado do ArkOS) --------
SECTOR=512
: "${BL_START_SECTOR:=64}"      # idbloader/u-boot começam aqui (copiados do ArkOS)
: "${P1_START_SECTOR:=32768}"   # início da BOOT (igual ao ArkOS)
: "${P1_SIZE_MIB:=128}"         # BOOT FAT32 (Image+uInitrd+dtb+boot.ini cabem)
: "${P2_SIZE_MIB:=256}"         # rootfs ext4 mínimo (busybox é minúsculo)
: "${P3_SIZE_MIB:=0}"           # DATA opcional; 0 = não cria (use --with-data)
: "${IMG_SLACK_SECTOR:=2048}"   # folga ao final da imagem

# --- BusyBox aarch64 (Ubuntu ports, mesma versão do host) ----------------------
# Pode ser sobrescrito por env BUSYBOX_ARM64=/caminho/para/busybox (aarch64).
: "${BUSYBOX_DEB_URL:=http://ports.ubuntu.com/ubuntu-ports/pool/main/b/busybox/busybox-static_1.36.1-6ubuntu3.1_arm64.deb}"

# --- Caminhos do projeto -------------------------------------------------------
_p2_self="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$_p2_self/.." && pwd)"
WORKSPACE_DIR="$(cd "$REPO_DIR/.." && pwd)"

ARKOS_BOOT_SRC="$REPO_DIR/artifacts/arkos-reference"      # Image/uInitrd/dtb extraídos
ROOTFS_OVERLAY="$REPO_DIR/board/r36s/rootfs-overlay"      # conteúdo versionado do rootfs
TEST_BOOT_INI="$REPO_DIR/board/r36s/boot/boot.ini"        # boot.ini de teste (versionado)

OUT_DIR="$REPO_DIR/artifacts/test-images"
BUILD_DIR="$OUT_DIR/build"                                 # staging (ignorado no git)
ROOTFS_DIR="$BUILD_DIR/rootfs"                             # árvore do rootfs mínimo
ROOTFS_STATE="$BUILD_DIR/rootfs.fakeroot"                  # estado do fakeroot (perms/nodes)
BUSYBOX_CACHE="$BUILD_DIR/busybox-arm64"                  # binário aarch64 em cache
PART_DIR="$BUILD_DIR/parts"                                # p1.fat / p2.ext4
REPORT_DIR="$OUT_DIR/reports"                              # relatórios (versionados)
IMG_NAME="r36s-cyberdeck-minimal.img"
OUT_IMG="$OUT_DIR/$IMG_NAME"

# Fonte da imagem ArkOS (para copiar a região de bootloader, somente leitura)
find_arkos_img() {
    local d f
    for d in "$WORKSPACE_DIR/Backups/ArkOS" "$WORKSPACE_DIR/Backup/ArkOS"; do
        [ -d "$d" ] || continue
        f="$(find "$d" -maxdepth 1 -name '*.img' 2>/dev/null | sort | head -1)"
        [ -n "$f" ] && { echo "$f"; return 0; }
    done
    return 1
}
