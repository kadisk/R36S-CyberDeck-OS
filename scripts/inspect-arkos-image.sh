#!/usr/bin/env bash
#
# inspect-arkos-image.sh
# -----------------------
# Inspeciona, em modo SOMENTE LEITURA, a imagem de referência ArkOS do R36S
# e gera relatórios de hardware/boot em artifacts/arkos-reference/reports/.
#
# A imagem ArkOS NUNCA é modificada. Este script só lê.
# Não requer sudo para o layout de partições (usa `fdisk -l` sobre o arquivo).
# A extração de arquivos da partição BOOT usa mtools (mdir/mcopy) se disponível;
# caso contrário, sugere o uso de scripts/mount-arkos-readonly.sh (com sudo).
#
# Uso:
#   scripts/inspect-arkos-image.sh [caminho-da-imagem]
#
# Se nenhum caminho for passado, procura automaticamente em:
#   Backup/ArkOS/ , Backups/ArkOS/  (.img e .img.gz)
#
set -u

# ----------------------------------------------------------------------------
# Localização de diretórios (independente de onde o script é chamado)
# ----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE_DIR="$(cd "$REPO_DIR/.." && pwd)"

REPORT_DIR="$REPO_DIR/artifacts/arkos-reference/reports"
SECTOR_SIZE=512

mkdir -p "$REPORT_DIR"

log()  { echo "[inspect] $*"; }
warn() { echo "[inspect][AVISO] $*" >&2; }
die()  { echo "[inspect][ERRO] $*" >&2; exit 1; }
has()  { command -v "$1" >/dev/null 2>&1; }

# ----------------------------------------------------------------------------
# 1. Localizar a imagem ArkOS
# ----------------------------------------------------------------------------
find_image() {
    local explicit="${1:-}"
    if [ -n "$explicit" ]; then
        [ -f "$explicit" ] || die "Imagem informada não existe: $explicit"
        echo "$explicit"; return
    fi
    local candidates=(
        "$WORKSPACE_DIR/Backups/ArkOS"
        "$WORKSPACE_DIR/Backup/ArkOS"
        "$REPO_DIR/../Backups/ArkOS"
        "$REPO_DIR/../Backup/ArkOS"
    )
    local d f
    # Prioriza .img (descomprimido) sobre .img.gz
    for d in "${candidates[@]}"; do
        [ -d "$d" ] || continue
        f="$(find "$d" -maxdepth 1 -name '*.img' 2>/dev/null | sort | head -1)"
        [ -n "$f" ] && { echo "$f"; return; }
    done
    for d in "${candidates[@]}"; do
        [ -d "$d" ] || continue
        f="$(find "$d" -maxdepth 1 -name '*.img.gz' 2>/dev/null | sort | head -1)"
        [ -n "$f" ] && { echo "$f"; return; }
    done
    die "Nenhuma imagem ArkOS encontrada em Backup(s)/ArkOS/. Passe o caminho como argumento."
}

IMAGE="$(find_image "${1:-}")"
log "Imagem ArkOS: $IMAGE"

IS_GZ=0
case "$IMAGE" in
    *.img.gz) IS_GZ=1 ;;
esac

# ----------------------------------------------------------------------------
# 2. Layout de partições  ->  partition-layout.txt
# ----------------------------------------------------------------------------
PART_REPORT="$REPORT_DIR/partition-layout.txt"

if [ "$IS_GZ" -eq 1 ]; then
    warn "Imagem está comprimida (.img.gz). fdisk não lê .gz diretamente."
    warn "Descomprima primeiro (gunzip -k) ou aponte para o .img."
    {
        echo "Imagem comprimida: $IMAGE"
        echo "Tamanho (.gz): $(stat -c '%s bytes' "$IMAGE" 2>/dev/null)"
        echo "Para inspecionar partições, descomprima: gunzip -k '$IMAGE'"
    } > "$PART_REPORT"
else
    log "Gerando layout de partições -> $PART_REPORT"
    {
        echo "# Layout de partições — gerado em $(date -Iseconds)"
        echo "# Fonte: $IMAGE  (somente leitura)"
        echo
        fdisk -l "$IMAGE" 2>&1
    } > "$PART_REPORT"
fi
log "Relatório de partições: $PART_REPORT"

# ----------------------------------------------------------------------------
# 3. Detectar offsets das partições (a partir do fdisk)
# ----------------------------------------------------------------------------
declare -a PART_START PART_SECTORS PART_TYPE
if [ "$IS_GZ" -eq 0 ]; then
    # Lê linhas de partição do fdisk; coluna "Início" e "Setores".
    while read -r line; do
        # Linhas de partição contêm o caminho da imagem seguido do número.
        case "$line" in
            *"$IMAGE"[0-9]*)
                # Normaliza espaços
                set -- $line
                # campos: <dev> [*] <início> <fim> <setores> <tam> <id> <tipo...>
                local_dev="$1"; shift
                if [ "$1" = "*" ]; then shift; fi
                start="$1"; fim="$2"; sectors="$3"
                idx="${local_dev##*[!0-9]}"
                PART_START[$idx]="$start"
                PART_SECTORS[$idx]="$sectors"
                PART_TYPE[$idx]="$*"
                ;;
        esac
    done < <(fdisk -l "$IMAGE" 2>/dev/null)
fi

OFFSET_REPORT="$REPORT_DIR/partition-offsets.txt"
{
    echo "# Offsets de partição (bytes) — gerado em $(date -Iseconds)"
    echo "# offset = início_em_setores * $SECTOR_SIZE"
    echo
    for idx in "${!PART_START[@]}"; do
        off=$(( PART_START[idx] * SECTOR_SIZE ))
        sz=$(( PART_SECTORS[idx] * SECTOR_SIZE ))
        printf "p%s: start_sector=%s offset_bytes=%s size_bytes=%s  (%s)\n" \
            "$idx" "${PART_START[$idx]}" "$off" "$sz" "${PART_TYPE[$idx]}"
    done
} > "$OFFSET_REPORT"
log "Offsets: $OFFSET_REPORT"

# ----------------------------------------------------------------------------
# 4. Inspecionar a partição BOOT (p1, FAT) — listar arquivos, DTBs, boot configs
# ----------------------------------------------------------------------------
BOOT_REPORT="$REPORT_DIR/boot-partition.txt"
P1_OFFSET=""
if [ -n "${PART_START[1]:-}" ]; then
    P1_OFFSET=$(( PART_START[1] * SECTOR_SIZE ))
fi

{
    echo "# Conteúdo da partição BOOT (p1, FAT) — gerado em $(date -Iseconds)"
    echo "# offset: ${P1_OFFSET:-desconhecido}"
    echo
    if [ -z "$P1_OFFSET" ]; then
        echo "Offset da p1 não detectado (imagem comprimida?). Pulei a listagem."
    elif has mdir; then
        echo "## Listagem (mtools, somente leitura):"
        MTOOLS_SKIP_CHECK=1 mdir -i "$IMAGE@@${P1_OFFSET}" -/ :: 2>&1
    else
        echo "mtools (mdir/mcopy) não instalado — não foi possível ler a FAT sem montar."
        echo "Opções:"
        echo "  - Instale mtools:  sudo apt-get install mtools"
        echo "  - OU monte read-only:  sudo scripts/mount-arkos-readonly.sh"
        echo "    e liste mnt/arkos/boot/"
    fi
} > "$BOOT_REPORT"
log "Boot partition: $BOOT_REPORT"

# ----------------------------------------------------------------------------
# 5. Relatório Markdown consolidado
# ----------------------------------------------------------------------------
MD_REPORT="$REPORT_DIR/arkos-inspection.md"
{
    echo "# Relatório de inspeção da imagem ArkOS (referência R36S)"
    echo
    echo "> Gerado por \`scripts/inspect-arkos-image.sh\` em $(date -Iseconds)."
    echo "> A imagem ArkOS é tratada como **somente leitura** — fonte de verdade de hardware."
    echo
    echo "## Imagem"
    echo
    echo "- Arquivo: \`$IMAGE\`"
    echo "- Tamanho: $(stat -c '%s bytes' "$IMAGE" 2>/dev/null)"
    echo "- Comprimida (.gz): $([ "$IS_GZ" -eq 1 ] && echo sim || echo não)"
    echo
    echo "## Partições"
    echo
    echo '```'
    cat "$PART_REPORT"
    echo '```'
    echo
    echo "## Offsets"
    echo
    echo '```'
    cat "$OFFSET_REPORT"
    echo '```'
    echo
    echo "## Partição BOOT"
    echo
    echo '```'
    cat "$BOOT_REPORT"
    echo '```'
    echo
    echo "## Próximos passos"
    echo
    echo "- \`scripts/mount-arkos-readonly.sh\` — montar p1/p2 read-only (precisa sudo)."
    echo "- \`scripts/extract-arkos-boot-artifacts.sh\` — copiar kernel/dtb/boot configs."
    echo "- \`scripts/identify-r36s-dtb.sh\` — decodificar DTBs e extrair model/compatible."
} > "$MD_REPORT"

log "Relatório Markdown: $MD_REPORT"
log "Concluído. Nenhuma escrita feita na imagem ArkOS."
