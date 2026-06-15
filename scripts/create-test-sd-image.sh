#!/usr/bin/env bash
#
# create-test-sd-image.sh
# -----------------------
# Gera a IMAGEM .img de teste do R36S CyberDeck OS (Fase 2).
#
# MODO PADRÃO (--clone, recomendado): clona a região de boot do ArkOS que JÁ
# funciona (MBR + bootloader + a própria partição BOOT FAT do ArkOS, com Image/
# uInitrd/dtb) e troca SÓ o que é nosso:
#   - boot.ini  -> nossa versão (root=UUID do CyberDeck, console=tty1, sem quiet)
#   - rootfs    -> nossa p2 ext4 (busybox), gravada onde fica a p2 do ArkOS
# Assim o MBR e o U-Boot são byte-a-byte os que bootam o ArkOS (descobrimos que um
# MBR diferente, feito por sfdisk, impedia o boot — tela apagada).
#
# MODO --fresh: monta MBR/FAT do zero (sfdisk + mkfs.vfat) — mantido p/ referência;
# NÃO bootou no R36S (MBR incompatível). Use só para experimentos.
#
# Tudo SEM root. NÃO grava em /dev/sdX. A imagem ArkOS é SOMENTE LEITURA.
#
# Uso:
#   scripts/create-test-sd-image.sh [--clone|--fresh] [--with-data]
#
set -eu
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF_DIR/phase2-config.sh"

log()  { echo "[sd-image] $*"; }
warn() { echo "[sd-image][AVISO] $*" >&2; }
die()  { echo "[sd-image][ERRO] $*" >&2; exit 1; }

MODE=clone; WITH_DATA=0
for a in "$@"; do
    case "$a" in
        --clone) MODE=clone ;;
        --fresh) MODE=fresh ;;
        --with-data) WITH_DATA=1 ;;
        *) die "argumento desconhecido: $a" ;;
    esac
done

mkdir -p "$OUT_DIR" "$REPORT_DIR" "$PART_DIR"

# ----------------------------------------------------------------------------
# 1. Construir rootfs + partição ext4 (comum aos dois modos)
# ----------------------------------------------------------------------------
log "== rootfs mínimo =="
bash "$SELF_DIR/create-minimal-rootfs.sh"
log "== partição rootfs (ext4) =="
bash "$SELF_DIR/prepare-rootfs-partition.sh"
P2="$PART_DIR/p2.ext4"
[ -f "$P2" ] || die "p2.ext4 não foi gerada"
p2_sectors=$(( P2_SIZE_MIB * 2048 ))

# ============================================================================
# MODO CLONE — reaproveita MBR + bootloader + FAT do ArkOS
# ============================================================================
build_clone() {
    local ARKOS; ARKOS="$(find_arkos_img)" \
        || die "Imagem ArkOS não encontrada em Backups/ArkOS/ (necessária no modo clone)."
    log "ArkOS (somente leitura): $ARKOS"

    # Descobre o início da p2 do ArkOS (= fim da região BOOT a clonar).
    local arkos_p2_start
    arkos_p2_start="$(fdisk -l "$ARKOS" 2>/dev/null \
        | awk -v i="${ARKOS}2" '$1==i {for(c=2;c<=NF;c++) if($c ~ /^[0-9]+$/){print $c; exit}}')"
    [ -n "$arkos_p2_start" ] || die "não detectei o início da p2 do ArkOS"
    local arkos_p1_start
    arkos_p1_start="$(fdisk -l "$ARKOS" 2>/dev/null \
        | awk -v i="${ARKOS}1" '$1==i {for(c=2;c<=NF;c++) if($c ~ /^[0-9]+$/){print $c; exit}}')"
    log "ArkOS: p1 inicia em $arkos_p1_start, p2 em $arkos_p2_start"

    local total_sectors=$(( arkos_p2_start + p2_sectors + IMG_SLACK_SECTOR ))
    rm -f "$OUT_IMG"
    truncate -s $(( total_sectors * SECTOR )) "$OUT_IMG"

    # (a) Clona MBR + bootloader + partição BOOT do ArkOS (setores 0..p2_start-1).
    log "clonando boot do ArkOS: setores 0..$((arkos_p2_start-1)) ($(( arkos_p2_start/2048 ))MiB)"
    dd if="$ARKOS" of="$OUT_IMG" bs=$SECTOR count=$arkos_p2_start conv=notrunc status=none

    # (b) Troca o boot.ini na FAT clonada pela nossa versão.
    local p1_off=$(( arkos_p1_start * SECTOR ))
    export MTOOLS_SKIP_CHECK=1
    mdel  -i "$OUT_IMG@@${p1_off}" ::/boot.ini 2>/dev/null || true
    mcopy -i "$OUT_IMG@@${p1_off}" "$TEST_BOOT_INI" ::/boot.ini
    log "boot.ini do CyberDeck instalado na BOOT (offset $p1_off)"
    # Garante kernel/dtb/uInitrd presentes (já vêm do ArkOS; recopia por segurança).
    mcopy -n -i "$OUT_IMG@@${p1_off}" "$ARKOS_BOOT_SRC/kernel/Image"            ::/Image 2>/dev/null || true
    mcopy -n -i "$OUT_IMG@@${p1_off}" "$ARKOS_BOOT_SRC/kernel/uInitrd"          ::/uInitrd 2>/dev/null || true
    mcopy -n -i "$OUT_IMG@@${p1_off}" "$ARKOS_BOOT_SRC/dtb/rk3326-r35s-linux.dtb" ::/rk3326-r35s-linux.dtb 2>/dev/null || true

    # (c) Grava nossa rootfs ext4 onde fica a p2 do ArkOS (UUID casa com root=UUID).
    log "gravando rootfs ext4 em setor $arkos_p2_start (p2 do ArkOS)"
    dd if="$P2" of="$OUT_IMG" bs=$SECTOR seek=$arkos_p2_start conv=notrunc status=none

    CLONE_P2_START="$arkos_p2_start"
    BOOT_DESC="MBR+bootloader+FAT clonados do ArkOS (byte-a-byte); boot.ini e rootfs trocados"
    log "NOTA: o MBR clonado do ArkOS declara p2/p3 grandes; a imagem .img é menor"
    log "      (só cobre nossa rootfs). No cartão de 64GB isso é normal."
}

# ============================================================================
# MODO FRESH — monta MBR/FAT do zero (referência; não bootou)
# ============================================================================
build_fresh() {
    log "== partição BOOT (FAT) =="
    bash "$SELF_DIR/prepare-boot-partition.sh"
    local P1="$PART_DIR/p1.fat"
    [ -f "$P1" ] || die "p1.fat não foi gerada"

    local p1_sectors=$(( P1_SIZE_MIB * 2048 ))
    local p1_start=$P1_START_SECTOR
    local p2_start=$(( p1_start + p1_sectors ))
    local last_end=$(( p2_start + p2_sectors - 1 ))
    local total_sectors=$(( last_end + 1 + IMG_SLACK_SECTOR ))

    rm -f "$OUT_IMG"; truncate -s $(( total_sectors * SECTOR )) "$OUT_IMG"
    { echo "label: dos"; echo "unit: sectors"
      echo "start=$p1_start, size=$p1_sectors, type=c, bootable"
      echo "start=$p2_start, size=$p2_sectors, type=83"
    } | sfdisk -q "$OUT_IMG" >/dev/null

    local ARKOS; if ARKOS="$(find_arkos_img)"; then
        dd if="$ARKOS" of="$OUT_IMG" bs=$SECTOR skip=$BL_START_SECTOR \
           seek=$BL_START_SECTOR count=$(( p1_start - BL_START_SECTOR )) conv=notrunc status=none
    else warn "sem ArkOS: imagem fresh SEM bootloader"; fi
    dd if="$P1" of="$OUT_IMG" bs=$SECTOR seek=$p1_start conv=notrunc status=none
    dd if="$P2" of="$OUT_IMG" bs=$SECTOR seek=$p2_start conv=notrunc status=none
    CLONE_P2_START="$p2_start"
    BOOT_DESC="MBR/FAT criados do zero (sfdisk+mkfs.vfat) + bootloader copiado — NÃO bootou no R36S"
}

case "$MODE" in
    clone) log "== modo CLONE (recomendado) =="; build_clone ;;
    fresh) log "== modo FRESH (referência) ==";   build_fresh ;;
esac

# ----------------------------------------------------------------------------
# Relatório
# ----------------------------------------------------------------------------
SHA="$(sha256sum "$OUT_IMG" | awk '{print $1}')"
REPORT="$REPORT_DIR/test-image.md"
{
    echo "# Imagem de teste — R36S CyberDeck OS (Fase 2)"
    echo
    echo "> Gerada por \`scripts/create-test-sd-image.sh --$MODE\` em $(date -Iseconds)."
    echo
    echo "- Arquivo: \`$OUT_IMG\`"
    echo "- Tamanho: $(stat -c '%s bytes' "$OUT_IMG")"
    echo "- sha256: \`$SHA\`"
    echo "- Estratégia de boot: $BOOT_DESC"
    echo "- rootfs UUID: \`$R36S_ROOTFS_UUID\` (casa com root=UUID do boot.ini)"
    echo "- rootfs gravada no setor: $CLONE_P2_START"
    echo
    echo "## Partições (MBR)"
    echo '```'
    sfdisk -l "$OUT_IMG" 2>&1 | grep -vE '^$'
    echo '```'
    echo
    echo "## Como gravar (NÃO executado automaticamente)"
    echo '```'
    echo "sudo dd if=$OUT_IMG of=/dev/sdX bs=4M status=progress conv=fsync"
    echo '```'
} > "$REPORT"

echo
log "IMAGEM PRONTA ($MODE): $OUT_IMG"
log "sha256: $SHA"
log "Relatório: $REPORT"
log "Grave você (conferindo /dev/sdX com lsblk):"
echo "    sudo dd if=$OUT_IMG of=/dev/sdX bs=4M status=progress conv=fsync"
log "Este script NÃO gravou em nenhum dispositivo."
