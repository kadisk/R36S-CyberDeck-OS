#!/usr/bin/env bash
#
# identify-r36s-dtb.sh
# --------------------
# Decodifica os DTBs (via dtc) extraídos em artifacts/arkos-reference/dtb/ e
# extrai model / compatible, além de procurar referências de hardware do R36S.
# Gera docs/hardware/device-tree-analysis.md.
#
# Uso:
#   scripts/identify-r36s-dtb.sh [diretório-com-dtbs]
#   (padrão: artifacts/arkos-reference/dtb/)
#
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

DTB_DIR="${1:-$REPO_DIR/artifacts/arkos-reference/dtb}"
OUT="$REPO_DIR/docs/hardware/device-tree-analysis.md"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

log()  { echo "[dtb] $*"; }
die()  { echo "[dtb][ERRO] $*" >&2; exit 1; }
has()  { command -v "$1" >/dev/null 2>&1; }

has dtc || die "dtc (device-tree-compiler) não instalado. sudo apt-get install device-tree-compiler"
[ -d "$DTB_DIR" ] || die "Diretório de DTBs não existe: $DTB_DIR
     Rode antes: scripts/extract-arkos-boot-artifacts.sh"

KEYWORDS=(rk3326 r35s r36s odroidgo odroid-go mipi panel backlight mali rk817 \
          joypad saradc adc dwmmc cortex-a35 kd35t133 elida vop dsi)

mapfile -t DTBS < <(find "$DTB_DIR" -maxdepth 1 -name '*.dtb' | sort)
[ "${#DTBS[@]}" -gt 0 ] || die "Nenhum .dtb em $DTB_DIR"

{
    echo "# Análise de Device Tree — R36S (referência ArkOS)"
    echo
    echo "> Gerado por \`scripts/identify-r36s-dtb.sh\` em $(date -Iseconds)."
    echo "> DTBs decodificados de \`$DTB_DIR\` (extraídos da imagem ArkOS, read-only)."
    echo
    echo "## DTBs encontrados"
    echo
    for d in "${DTBS[@]}"; do
        sz=$(stat -c '%s' "$d" 2>/dev/null)
        sha=$(sha256sum "$d" 2>/dev/null | awk '{print $1}')
        echo "- \`$(basename "$d")\` — ${sz} bytes — sha256 \`${sha}\`"
    done
    echo

    for d in "${DTBS[@]}"; do
        name="$(basename "$d")"
        dts="$WORK/${name}.dts"
        echo "## $name"
        echo
        if ! dtc -I dtb -O dts -o "$dts" "$d" 2>/dev/null; then
            echo "_dtc falhou ao decodificar este DTB._"
            echo
            continue
        fi

        model="$(grep -m1 -oE 'model = "[^"]*"' "$dts" | sed 's/model = //; s/"//g')"
        compat="$(grep -m1 -A0 'compatible = ' "$dts" | head -1 | sed 's/.*compatible = //; s/;//')"
        echo "- **model:** ${model:-(não encontrado)}"
        echo "- **compatible (raiz):** ${compat:-(não encontrado)}"
        echo
        echo "### Referências de hardware encontradas"
        echo
        echo '| keyword | ocorrências |'
        echo '|---------|-------------|'
        for kw in "${KEYWORDS[@]}"; do
            n="$(grep -ic "$kw" "$dts" 2>/dev/null)"
            [ "$n" -gt 0 ] && printf '| `%s` | %s |\n' "$kw" "$n"
        done
        echo
        # Nós-chave: painel, backlight, joypad, pmic
        echo "### Nós de interesse (trecho)"
        echo
        echo '```'
        grep -nE 'panel|backlight|joypad|pmic|gpu|vop|dsi|battery|charger' "$dts" \
            | head -40
        echo '```'
        echo
    done

    echo "## Observações"
    echo
    echo "- O DTB ativo do aparelho é apontado pelo \`boot.ini\` da partição BOOT."
    echo "- Para o CyberDeck OS, este \`compatible\`/\`model\` deve ser reproduzido pelo"
    echo "  kernel/DTB do rootfs final (ver docs/boot/boot-flow.md)."
} > "$OUT"

log "Análise escrita em: $OUT"
log "Concluído."
