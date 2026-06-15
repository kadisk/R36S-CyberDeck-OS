#!/usr/bin/env bash
#
# create-test-sd-image.sh
# -----------------------
# Gera a IMAGEM .img de teste do R36S CyberDeck OS (Fase 2), montando:
#   [bootloader RK3326 copiado do ArkOS]  (idbloader+u-boot, sectors 64..32767)
#   p1 FAT32  BOOT    -> Image, uInitrd, rk3326-r35s-linux.dtb, boot.ini(teste)
#   p2 ext4   ROOTFS  -> rootfs mínimo próprio (busybox), root=UUID
#   p3 FAT32  DATA    -> opcional (--with-data)
#
# Tudo SEM root (truncate + sfdisk + mke2fs -d + mtools + dd em offsets).
# NÃO grava em /dev/sdX. Apenas produz o arquivo .img e um relatório.
# A imagem ArkOS é usada SOMENTE LEITURA (cópia da região de bootloader).
#
# Uso:
#   scripts/create-test-sd-image.sh [--with-data] [--no-bootloader]
#
set -eu
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF_DIR/phase2-config.sh"

log()  { echo "[sd-image] $*"; }
warn() { echo "[sd-image][AVISO] $*" >&2; }
die()  { echo "[sd-image][ERRO] $*" >&2; exit 1; }

WITH_DATA=0; COPY_BL=1
for a in "$@"; do
    case "$a" in
        --with-data) WITH_DATA=1 ;;
        --no-bootloader) COPY_BL=0 ;;
        *) die "argumento desconhecido: $a" ;;
    esac
done

mkdir -p "$OUT_DIR" "$REPORT_DIR" "$PART_DIR"

# ----------------------------------------------------------------------------
# 1. Construir rootfs + partições (chama os sub-scripts)
# ----------------------------------------------------------------------------
log "== 1/5 rootfs mínimo =="
bash "$SELF_DIR/create-minimal-rootfs.sh"
log "== 2/5 partição BOOT (FAT) =="
bash "$SELF_DIR/prepare-boot-partition.sh"
log "== 3/5 partição rootfs (ext4) =="
bash "$SELF_DIR/prepare-rootfs-partition.sh"

P1="$PART_DIR/p1.fat"
P2="$PART_DIR/p2.ext4"
[ -f "$P1" ] && [ -f "$P2" ] || die "partições não foram geradas"

# ----------------------------------------------------------------------------
# 2. Geometria (em setores de 512B)
# ----------------------------------------------------------------------------
p1_sectors=$(( P1_SIZE_MIB * 2048 ))
p2_sectors=$(( P2_SIZE_MIB * 2048 ))
p1_start=$P1_START_SECTOR
p2_start=$(( p1_start + p1_sectors ))
last_end=$(( p2_start + p2_sectors - 1 ))

p3_start=0; p3_sectors=0
if [ "$WITH_DATA" -eq 1 ]; then
    [ "$P3_SIZE_MIB" -gt 0 ] || P3_SIZE_MIB=256
    p3_sectors=$(( P3_SIZE_MIB * 2048 ))
    p3_start=$(( p2_start + p2_sectors ))
    last_end=$(( p3_start + p3_sectors - 1 ))
fi
total_sectors=$(( last_end + 1 + IMG_SLACK_SECTOR ))

log "== 4/5 montando imagem =="
log "  p1 BOOT  start=$p1_start sectors=$p1_sectors (${P1_SIZE_MIB}MiB)"
log "  p2 ROOT  start=$p2_start sectors=$p2_sectors (${P2_SIZE_MIB}MiB)"
[ "$WITH_DATA" -eq 1 ] && log "  p3 DATA  start=$p3_start sectors=$p3_sectors (${P3_SIZE_MIB}MiB)"
log "  total=$total_sectors setores ($(( total_sectors/2048 ))MiB)"

rm -f "$OUT_IMG"
truncate -s $(( total_sectors * SECTOR )) "$OUT_IMG"

# ----------------------------------------------------------------------------
# 3. Tabela de partições (MBR/dos), espelhando o esquema do ArkOS
# ----------------------------------------------------------------------------
{
    echo "label: dos"
    echo "unit: sectors"
    echo "start=$p1_start, size=$p1_sectors, type=c, bootable"
    echo "start=$p2_start, size=$p2_sectors, type=83"
    [ "$WITH_DATA" -eq 1 ] && echo "start=$p3_start, size=$p3_sectors, type=c"
} | sfdisk -q "$OUT_IMG" >/dev/null
log "  tabela de partições gravada (sfdisk)"

# ----------------------------------------------------------------------------
# 4. Região de bootloader RK3326 (idbloader + u-boot) — copiada do ArkOS
#    Sem isso, o BootROM do R36S não inicia. Não inclui o setor 0 (MBR é nosso).
# ----------------------------------------------------------------------------
if [ "$COPY_BL" -eq 1 ]; then
    if ARKOS_IMG="$(find_arkos_img)"; then
        bl_count=$(( p1_start - BL_START_SECTOR ))
        log "  copiando bootloader RK3326 do ArkOS (setores $BL_START_SECTOR..$((p1_start-1)))"
        dd if="$ARKOS_IMG" of="$OUT_IMG" bs=$SECTOR skip=$BL_START_SECTOR \
           seek=$BL_START_SECTOR count=$bl_count conv=notrunc status=none
    else
        warn "Imagem ArkOS não encontrada — imagem SEM bootloader (NÃO bootará no R36S)."
        warn "Forneça o .img em Backups/ArkOS/ ou use um cartão que já tenha U-Boot."
        COPY_BL=0
    fi
fi

# ----------------------------------------------------------------------------
# 5. Gravar as partições nos offsets
# ----------------------------------------------------------------------------
dd if="$P1" of="$OUT_IMG" bs=$SECTOR seek=$p1_start conv=notrunc status=none
dd if="$P2" of="$OUT_IMG" bs=$SECTOR seek=$p2_start conv=notrunc status=none
log "  partições gravadas na imagem"

# ----------------------------------------------------------------------------
# 6. Relatório
# ----------------------------------------------------------------------------
SHA="$(sha256sum "$OUT_IMG" | awk '{print $1}')"
REPORT="$REPORT_DIR/test-image.md"
{
    echo "# Imagem de teste — R36S CyberDeck OS (Fase 2)"
    echo
    echo "> Gerada por \`scripts/create-test-sd-image.sh\` em $(date -Iseconds)."
    echo
    echo "- Arquivo: \`$OUT_IMG\`"
    echo "- Tamanho: $(stat -c '%s bytes' "$OUT_IMG") ($(( total_sectors/2048 )) MiB)"
    echo "- sha256: \`$SHA\`"
    echo "- Bootloader RK3326 (do ArkOS): $([ "$COPY_BL" -eq 1 ] && echo 'incluído' || echo 'NÃO incluído')"
    echo "- rootfs UUID: \`$R36S_ROOTFS_UUID\` (casa com root=UUID do boot.ini)"
    echo
    echo "## Partições"
    echo '```'
    sfdisk -l "$OUT_IMG" 2>/dev/null
    echo '```'
    echo
    echo "## BOOT (p1) — conteúdo"
    echo '```'
    MTOOLS_SKIP_CHECK=1 mdir -i "$P1" -/ :: 2>/dev/null
    echo '```'
    echo
    echo "## Como gravar (NÃO executado automaticamente)"
    echo '```'
    echo "sudo dd if=$OUT_IMG of=/dev/sdX bs=4M status=progress conv=fsync"
    echo '```'
    echo "Ver \`scripts/print-flash-command.sh\` e \`docs/boot/sd-card-test-layout.md\`."
} > "$REPORT"

echo
log "IMAGEM PRONTA: $OUT_IMG"
log "Relatório: $REPORT"
log "Gravação sugerida (rode você, conferindo /dev/sdX com lsblk):"
echo "    sudo dd if=$OUT_IMG of=/dev/sdX bs=4M status=progress conv=fsync"
log "Este script NÃO gravou em nenhum dispositivo."
