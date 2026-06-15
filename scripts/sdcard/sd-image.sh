#!/usr/bin/env bash
# sd-image.sh — registra/lista imagens .img por APELIDO (para gravar pelo nome). Sem sudo.
#
# Uso:
#   scripts/sdcard/sd-image.sh add <apelido> <caminho.img>
#   scripts/sdcard/sd-image.sh list
#   scripts/sdcard/sd-image.sh rm  <apelido>
set -eu
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/sdcard-lib.sh"
sd_images_init

cmd="${1:-list}"
case "$cmd" in
  add)
    name="${2:-}"; path="${3:-}"
    [ -n "$name" ] && [ -n "$path" ] || die "uso: $0 add <apelido> <caminho.img>"
    sd_image_add "$name" "$path" || exit 1
    ok "imagem '$name' registrada -> $(sd_image_path "$name")"
    ;;
  rm)
    name="${2:-}"; [ -n "$name" ] || die "uso: $0 rm <apelido>"
    tmp="$(mktemp)"; awk -F'\t' -v n="$name" 'NR==1 || $1!=n' "$IMAGES" > "$tmp" && mv "$tmp" "$IMAGES"
    ok "imagem '$name' removida do registro."
    ;;
  list|"")
    say "===================== IMAGENS REGISTRADAS ====================="
    if grep -vqE '^#' "$IMAGES" 2>/dev/null; then
        printf '  %-20s  %-10s  %s\n' "APELIDO" "TAMANHO" "CAMINHO"
        grep -vE '^#' "$IMAGES" | while IFS=$'\t' read -r n p added; do
            sz="(ausente)"; [ -f "$p" ] && sz="$(sd_human_size "$(stat -c %s "$p")")"
            printf '  %-20s  %-10s  %s\n' "$n" "$sz" "$p"
        done
    else
        say "  (nenhuma imagem registrada — use: $0 add <apelido> <caminho.img>)"
    fi
    say "  arquivo: $IMAGES"
    ;;
  *) die "comando inválido: $cmd (use add|list|rm)";;
esac
