#!/usr/bin/env bash
#
# extract-arkos-boot-artifacts.sh
# -------------------------------
# Copia, de forma CONTROLADA e somente leitura, os artefatos de boot da imagem
# ArkOS para artifacts/arkos-reference/. Não modifica a imagem.
#
# Requer que a imagem esteja montada read-only (mnt/arkos/boot e mnt/arkos/rootfs)
# via scripts/mount-arkos-readonly.sh. Se não estiver, tenta usar mtools sobre a
# partição BOOT diretamente.
#
# Copia:
#   - kernel (Image / zImage / vmlinuz / *.dtb's irmãos)
#   - initrd / uInitrd
#   - DTBs (*.dtb)
#   - boot configs (boot.ini, extlinux.conf, config.txt, *.scr)
#
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

BOOT_MNT="$REPO_DIR/mnt/arkos/boot"
DEST="$REPO_DIR/artifacts/arkos-reference"
DEST_BOOT="$DEST/boot"
DEST_DTB="$DEST/dtb"
DEST_KERNEL="$DEST/kernel"

log()  { echo "[extract] $*"; }
warn() { echo "[extract][AVISO] $*" >&2; }
die()  { echo "[extract][ERRO] $*" >&2; exit 1; }

mkdir -p "$DEST_BOOT" "$DEST_DTB" "$DEST_KERNEL"

if ! mountpoint -q "$BOOT_MNT"; then
    die "Partição BOOT não montada em $BOOT_MNT.
     Rode antes:  sudo scripts/mount-arkos-readonly.sh"
fi

copy_ro() {
    # copia preservando, marca destino como read-only para não confundir depois
    local src="$1" dst="$2"
    cp -a --no-preserve=ownership "$src" "$dst" 2>/dev/null \
        && log "copiado: $(basename "$src")" \
        || warn "falhou copiar: $src"
}

log "Origem (read-only): $BOOT_MNT"

# Configs de boot e o conteúdo "raso" da BOOT
for f in boot.ini extlinux.conf config.txt boot.scr boot.cmd uEnv.txt; do
    [ -e "$BOOT_MNT/$f" ] && copy_ro "$BOOT_MNT/$f" "$DEST_BOOT/"
done
# extlinux/ subdir
[ -d "$BOOT_MNT/extlinux" ] && cp -a "$BOOT_MNT/extlinux" "$DEST_BOOT/" && log "copiado: extlinux/"

# Kernel
for k in Image zImage vmlinuz vmlinuz-* Image.gz; do
    for hit in "$BOOT_MNT"/$k; do
        [ -e "$hit" ] && copy_ro "$hit" "$DEST_KERNEL/"
    done
done

# initrd / uInitrd
for i in uInitrd initrd.img initrd.img-* initramfs*; do
    for hit in "$BOOT_MNT"/$i; do
        [ -e "$hit" ] && copy_ro "$hit" "$DEST_KERNEL/"
    done
done

# DTBs
found_dtb=0
while IFS= read -r -d '' dtb; do
    copy_ro "$dtb" "$DEST_DTB/"
    found_dtb=1
done < <(find "$BOOT_MNT" -maxdepth 3 -name '*.dtb' -print0 2>/dev/null)
[ "$found_dtb" -eq 0 ] && warn "Nenhum .dtb encontrado em $BOOT_MNT"

# Inventário do que foi copiado
{
    echo "# Artefatos de boot extraídos — $(date -Iseconds)"
    echo "# Origem read-only: $BOOT_MNT"
    echo
    find "$DEST_BOOT" "$DEST_DTB" "$DEST_KERNEL" -type f -printf '%P\t%s bytes\n' 2>/dev/null | sort
} > "$DEST/reports/extracted-artifacts.txt"

log "Inventário: $DEST/reports/extracted-artifacts.txt"
log "Concluído. Imagem ArkOS não foi modificada."
