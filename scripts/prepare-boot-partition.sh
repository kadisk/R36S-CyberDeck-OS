#!/usr/bin/env bash
#
# prepare-boot-partition.sh
# -------------------------
# Cria a imagem da partição BOOT (FAT32) do cartão de teste, em
# artifacts/test-images/build/parts/p1.fat, e copia para ela:
#   - Image                   (kernel ArkOS reutilizado)
#   - uInitrd                 (initramfs ArkOS reutilizado)
#   - rk3326-r35s-linux.dtb   (DTB ativo)
#   - boot.ini                (versão de TESTE: board/r36s/boot/boot.ini)
#
# Usa mkfs.vfat + mtools (mcopy) — SEM root, SEM montar. Não toca na imagem ArkOS.
#
set -eu
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/phase2-config.sh"

log()  { echo "[boot-part] $*"; }
die()  { echo "[boot-part][ERRO] $*" >&2; exit 1; }

K="$ARKOS_BOOT_SRC/kernel"
D="$ARKOS_BOOT_SRC/dtb"
IMAGE_BIN="$K/Image"
UINITRD="$K/uInitrd"
DTB="$D/rk3326-r35s-linux.dtb"

for f in "$IMAGE_BIN" "$UINITRD" "$DTB"; do
    [ -f "$f" ] || die "Artefato ausente: $f
     Rode antes: scripts/extract-arkos-boot-artifacts.sh"
done
[ -f "$TEST_BOOT_INI" ] || die "boot.ini de teste ausente: $TEST_BOOT_INI"

mkdir -p "$PART_DIR"
P1="$PART_DIR/p1.fat"
SIZE_KB=$(( P1_SIZE_MIB * 1024 ))

log "Criando FAT32 ${P1_SIZE_MIB}MiB: $P1"
rm -f "$P1"
mkfs.vfat -F 32 -n "$R36S_BOOT_LABEL" -C "$P1" "$SIZE_KB" >/dev/null

export MTOOLS_SKIP_CHECK=1
log "Copiando artefatos de boot para a BOOT..."
mcopy -i "$P1" "$IMAGE_BIN" ::/Image
mcopy -i "$P1" "$UINITRD"   ::/uInitrd
mcopy -i "$P1" "$DTB"       ::/rk3326-r35s-linux.dtb
mcopy -i "$P1" "$TEST_BOOT_INI" ::/boot.ini

log "Conteúdo da BOOT:"
mdir -i "$P1" -/ :: 2>/dev/null | sed 's/^/   /'
log "OK: $P1"
