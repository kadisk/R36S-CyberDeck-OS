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
has() { command -v "$1" >/dev/null 2>&1; }

# Padrões de nomes a extrair (boot configs / kernel / initrd / dtbs)
BOOT_CFG=(boot.ini boot.ini.default extlinux.conf config.txt boot.scr boot.cmd uEnv.txt)
KERNELS=(Image zImage Image.gz vmlinuz)
INITRDS=(uInitrd initrd.img initramfs)

# ----------------------------------------------------------------------------
# MODO A — partição BOOT montada read-only (precisa sudo mount-arkos-readonly.sh)
# ----------------------------------------------------------------------------
extract_from_mount() {
    log "Origem (read-only, montada): $BOOT_MNT"
    local f hit
    for f in "${BOOT_CFG[@]}"; do
        [ -e "$BOOT_MNT/$f" ] && cp -a --no-preserve=ownership "$BOOT_MNT/$f" "$DEST_BOOT/" && log "copiado: $f"
    done
    [ -d "$BOOT_MNT/extlinux" ] && cp -a "$BOOT_MNT/extlinux" "$DEST_BOOT/" && log "copiado: extlinux/"
    for f in "${KERNELS[@]}" "${INITRDS[@]}"; do
        for hit in "$BOOT_MNT"/$f*; do
            [ -e "$hit" ] && cp -a --no-preserve=ownership "$hit" "$DEST_KERNEL/" && log "copiado: $(basename "$hit")"
        done
    done
    while IFS= read -r -d '' dtb; do
        cp -a --no-preserve=ownership "$dtb" "$DEST_DTB/" && log "copiado: $(basename "$dtb")"
    done < <(find "$BOOT_MNT" -maxdepth 3 -name '*.dtb' -print0 2>/dev/null)
}

# ----------------------------------------------------------------------------
# MODO B — mtools (mcopy) direto sobre a p1 FAT, SEM montar e SEM sudo
# ----------------------------------------------------------------------------
extract_with_mtools() {
    local img off f
    img="$(find_image)" || die "imagem não encontrada"
    off="$(boot_offset "$img")" || die "offset da p1 não detectado"
    export MTOOLS_SKIP_CHECK=1
    log "Origem (read-only, mtools): $img @@${off}"

    # boot configs
    for f in "${BOOT_CFG[@]}"; do
        mcopy -n -i "${img}@@${off}" "::/$f" "$DEST_BOOT/" 2>/dev/null && log "copiado: $f"
    done
    # kernel + initrd
    for f in "${KERNELS[@]}" "${INITRDS[@]}"; do
        mcopy -n -i "${img}@@${off}" "::/$f" "$DEST_KERNEL/" 2>/dev/null && log "copiado: $f"
    done
    # dtbs (lista a raiz e copia cada *.dtb)
    while read -r dtb; do
        [ -n "$dtb" ] || continue
        mcopy -n -i "${img}@@${off}" "::/$dtb" "$DEST_DTB/" 2>/dev/null && log "copiado: $dtb"
    done < <(mdir -i "${img}@@${off}" -b ::/ 2>/dev/null | sed 's#^::/##' | grep -iE '\.dtb$')
}

find_image() {
    local d f
    for d in "$REPO_DIR/../Backups/ArkOS" "$REPO_DIR/../Backup/ArkOS"; do
        [ -d "$d" ] || continue
        f="$(find "$d" -maxdepth 1 -name '*.img' 2>/dev/null | sort | head -1)"
        [ -n "$f" ] && { echo "$f"; return 0; }
    done
    return 1
}

boot_offset() {
    # offset (bytes) da 1ª partição = início_setores * 512
    local img="$1" start
    start="$(fdisk -l "$img" 2>/dev/null | awk -v i="${img}1" '$1==i {print $2; exit} $1==i && $2=="*" {print $3; exit}')"
    # fallback: trata coluna "Boot" (*) deslocando
    [ -z "$start" ] && start="$(fdisk -l "$img" 2>/dev/null | awk -v i="${img}1" '$1==i {for(c=2;c<=NF;c++) if($c ~ /^[0-9]+$/){print $c; exit}}')"
    [ -n "$start" ] || return 1
    echo $(( start * 512 ))
}

# ----------------------------------------------------------------------------
# Seleção de modo
# ----------------------------------------------------------------------------
if mountpoint -q "$BOOT_MNT" 2>/dev/null; then
    extract_from_mount
elif has mcopy && has mdir; then
    extract_with_mtools
else
    die "Sem partição BOOT montada e sem mtools.
     Opção 1: sudo scripts/mount-arkos-readonly.sh
     Opção 2: sudo apt-get install mtools  (extrai sem montar)"
fi

[ -n "$(find "$DEST_DTB" -name '*.dtb' 2>/dev/null)" ] || warn "Nenhum .dtb extraído."

# Inventário do que foi copiado
{
    echo "# Artefatos de boot extraídos — $(date -Iseconds)"
    echo
    find "$DEST_BOOT" "$DEST_DTB" "$DEST_KERNEL" -type f ! -name '.gitkeep' -printf '%p\t%s bytes\n' 2>/dev/null | sort
} > "$DEST/reports/extracted-artifacts.txt"

log "Inventário: $DEST/reports/extracted-artifacts.txt"
log "Concluído. Imagem ArkOS não foi modificada."
