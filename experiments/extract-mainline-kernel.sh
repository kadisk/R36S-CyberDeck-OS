#!/usr/bin/env bash
#
# extract-mainline-kernel.sh — Fase 5. Extrai de uma imagem R36S mainline (Arch-R)
# o kernel, os DTBs/overlays, a config de boot e os módulos — SEM root (mtools p/ a
# FAT, debugfs p/ a ext4). Saída em artifacts/mainline/.
#
# Uso:
#   scripts/extract-mainline-kernel.sh [caminho-da-imagem .img ou .img.gz]
#   (padrão: artifacts/mainline/ArchR-R36S.aarch64-*-original.img[.gz])
#
set -eu
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SELF_DIR/.." && pwd)"
ML="$REPO_DIR/artifacts/mainline"
OUT_BOOT="$ML/boot"; OUT_DTB="$ML/dtb"; OUT_MODS="$ML/modules"; OUT_REP="$ML/reports"
mkdir -p "$OUT_BOOT" "$OUT_DTB" "$OUT_MODS" "$OUT_REP"

log(){ echo "[ml-extract] $*"; }
die(){ echo "[ml-extract][ERRO] $*" >&2; exit 1; }

IMG="${1:-}"
if [ -z "$IMG" ]; then
    IMG="$(ls "$ML"/ArchR-R36S*original.img 2>/dev/null | head -1)"
    [ -z "$IMG" ] && IMG="$(ls "$ML"/ArchR-R36S*original.img.gz 2>/dev/null | head -1)"
fi
[ -n "$IMG" ] && [ -f "$IMG" ] || die "imagem Arch-R não encontrada (passe o caminho)."

# Descomprime se .gz (mantém o .gz)
case "$IMG" in
  *.img.gz)
    RAW="${IMG%.gz}"
    [ -f "$RAW" ] || { log "descomprimindo $(basename "$IMG") (~5GB)"; gunzip -kc "$IMG" > "$RAW"; }
    IMG="$RAW" ;;
esac
log "imagem: $IMG"

# Layout
fdisk -l "$IMG" > "$OUT_REP/archr-partitions.txt" 2>&1 || true
p1_start="$(fdisk -l "$IMG" 2>/dev/null | awk -v i="${IMG}1" '$1==i{for(c=2;c<=NF;c++) if($c~/^[0-9]+$/){print $c;exit}}')"
read p2_start p2_sectors < <(fdisk -l "$IMG" 2>/dev/null | awk -v i="${IMG}2" '$1==i{n=0;for(c=2;c<=NF;c++) if($c~/^[0-9]+$/){a[++n]=$c}; print a[1], a[3]}')
[ -n "$p1_start" ] && [ -n "$p2_start" ] || die "não detectei p1/p2"
p1_off=$(( p1_start * 512 )); p2_off=$(( p2_start * 512 ))
log "p1(boot) off=$p1_off  p2(rootfs) off=$p2_off"

# ---- p1 FAT: kernel + DTBs + boot config (mtools) ----
export MTOOLS_SKIP_CHECK=1
log "listando a partição BOOT (p1)"
mdir -i "$IMG@@${p1_off}" -/ :: > "$OUT_REP/archr-boot-listing.txt" 2>&1 || true
# kernel
for k in Image Image.gz vmlinuz vmlinux; do
    mcopy -n -i "$IMG@@${p1_off}" "::/$k" "$OUT_BOOT/" 2>/dev/null && log "kernel: $k" || true
    mcopy -n -i "$IMG@@${p1_off}" "::/boot/$k" "$OUT_BOOT/" 2>/dev/null || true
done
# boot config
for f in boot.ini boot.ini.default extlinux.conf armbianEnv.txt uEnv.txt config.txt; do
    mcopy -n -i "$IMG@@${p1_off}" "::/$f" "$OUT_BOOT/" 2>/dev/null && log "config: $f" || true
done
mcopy -s -n -i "$IMG@@${p1_off}" "::/extlinux" "$OUT_BOOT/" 2>/dev/null || true
# DTBs e overlays (recursivo); foco no R36S + painel kd35t133
mcopy -s -n -i "$IMG@@${p1_off}" "::/dtb" "$OUT_DTB/" 2>/dev/null || true
mcopy -s -n -i "$IMG@@${p1_off}" "::/dtbs" "$OUT_DTB/" 2>/dev/null || true
mcopy -s -n -i "$IMG@@${p1_off}" "::/rockchip" "$OUT_DTB/" 2>/dev/null || true
{ echo "# DTBs/overlays na BOOT do Arch-R"; find "$OUT_DTB" -type f | sed "s#$OUT_DTB/##" | sort; } > "$OUT_REP/archr-dtb-list.txt"
log "DTBs extraídos: $(find "$OUT_DTB" -name '*.dtb' | wc -l) ; overlays: $(find "$OUT_DTB" -name '*.dtbo' | wc -l)"

# ---- p2 ext4: /lib/modules + versão do kernel (debugfs, read-only) ----
# debugfs precisa de um fs em offset 0 -> extrai a p2 p/ um arquivo (sem sudo).
P2="$ML/archr-p2.ext4"
if [ ! -f "$P2" ]; then
    log "extraindo p2 (ext4 rootfs) p/ debugfs (~4.6GB)"
    dd if="$IMG" of="$P2" bs=512 skip="$p2_start" count="$p2_sectors" status=none
fi
KVER="$(debugfs -R 'ls -l /lib/modules' "$P2" 2>/dev/null | awk '$NF ~ /^[0-9]+\./{print $NF}' | head -1)"
[ -n "$KVER" ] || KVER="$(debugfs -R 'ls /usr/lib/modules' "$P2" 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.' | head -1)"
log "versão do kernel mainline: ${KVER:-?}"
echo "${KVER:-desconhecido}" > "$OUT_REP/kernel-version.txt"

MODPATH="/lib/modules"
debugfs -R "ls /lib/modules" "$P2" >/dev/null 2>&1 || MODPATH="/usr/lib/modules"
log "copiando $MODPATH/$KVER (debugfs rdump)"
rm -rf "$OUT_MODS"; mkdir -p "$OUT_MODS"
debugfs -R "rdump $MODPATH/$KVER $OUT_MODS" "$P2" 2>/dev/null || log "AVISO: rdump dos módulos falhou"

# Pistas de boot/console do Arch-R p/ montar nosso boot.ini mainline
{
    echo "# Pistas de boot do Arch-R (Fase 5) — $(date -Iseconds)"
    echo "## kernel version"; cat "$OUT_REP/kernel-version.txt"
    echo "## boot config (bootargs/console/dtb):"
    for f in "$OUT_BOOT"/boot.ini "$OUT_BOOT"/extlinux/extlinux.conf "$OUT_BOOT"/armbianEnv.txt; do
        [ -f "$f" ] && { echo "--- $f"; cat "$f"; }
    done
    echo "## panfrost no kernel? (módulo ou built-in)"
    find "$OUT_MODS" -name 'panfrost*.ko*' 2>/dev/null | sed "s#$OUT_MODS/##" || echo "  (não achei módulo panfrost — pode ser built-in)"
} > "$OUT_REP/boot-clues.txt"

log "Concluído. Veja artifacts/mainline/reports/ (partições, DTBs, kernel-version, boot-clues)."
log "Kernel: $OUT_BOOT/Image | DTBs: $OUT_DTB | Módulos: $OUT_MODS (ver $KVER)"
