#!/usr/bin/env bash
# sd-catalog.sh — catálogo de imagens/distros candidatas a R36S, com status de teste.
# Testa uma a uma e MANTÉM a lista das que comprovadamente funcionam.
#
# Catálogo: scripts/sdcard/r36s-catalog.tsv  (versionado — é conhecimento do projeto)
# Colunas: nome  status  url  notas  testado_em
#   status: TODO | TESTANDO | FUNCIONA | FALHA | PARCIAL
#
# Uso:
#   sd-catalog.sh list                          # tabela de candidatas + status
#   sd-catalog.sh next                          # próxima a testar (TODO)
#   sd-catalog.sh add  <nome> <url> [notas]     # adiciona candidata
#   sd-catalog.sh fetch <nome>                  # baixa+descomprime+registra p/ gravar
#   sd-catalog.sh result <nome> <FUNCIONA|FALHA|PARCIAL> "<notas>"   # marca resultado
set -eu
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF/sdcard-lib.sh"
REPO="$(cd "$SELF/../.." && pwd)"
CAT="$SELF/r36s-catalog.tsv"
DL="$REPO/artifacts/test-images/downloads"

cat_init(){ [ -f "$CAT" ] || printf '# nome\tstatus\turl\tnotas\ttestado_em\n' > "$CAT"; }
cat_get(){ grep -vE '^#' "$CAT" 2>/dev/null | awk -F'\t' -v n="$1" '$1==n{print; exit}'; }
cat_set(){ # nome status url notas data
    local tmp; tmp="$(mktemp)"
    awk -F'\t' -v n="$1" 'NR==1 || $1!=n' "$CAT" > "$tmp"
    printf '%s\t%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" "$5" >> "$tmp"
    mv "$tmp" "$CAT"
}
icon(){ case "$1" in FUNCIONA) echo "✅";; FALHA) echo "❌";; PARCIAL) echo "🟡";; TESTANDO) echo "🔄";; *) echo "⬜";; esac; }

cat_init
cmd="${1:-list}"
case "$cmd" in
  list|"")
    say "================== CATÁLOGO DE IMAGENS R36S =================="
    printf '  %-2s %-10s %-22s %s\n' "" "STATUS" "NOME" "NOTAS"
    grep -vE '^#' "$CAT" | while IFS=$'\t' read -r n st url notas data; do
        printf '  %-2s %-10s %-22s %s\n' "$(icon "$st")" "$st" "$n" "${notas:-}"
    done
    echo
    c_ok=$(grep -cP '\tFUNCIONA\t' "$CAT" 2>/dev/null || echo 0)
    c_all=$(grep -vcE '^#' "$CAT" 2>/dev/null || echo 0)
    say "  $c_ok de $c_all comprovadamente funcionam.  arquivo: $CAT"
    ;;
  next)
    n="$(grep -vE '^#' "$CAT" | awk -F'\t' '$2=="TODO"{print $1; exit}')"
    [ -n "$n" ] && { say "Próxima a testar: $n"; cat_get "$n" | awk -F'\t' '{print "  url: "$3"\n  notas: "$4}'; } \
                || say "Nenhuma TODO — todas testadas (ou catálogo vazio)."
    ;;
  add)
    n="${2:-}"; url="${3:-}"; notas="${4:-}"
    [ -n "$n" ] || die "uso: $0 add <nome> <url> [notas]"
    cat_set "$n" "TODO" "$url" "$notas" ""
    ok "candidata '$n' adicionada (TODO)."
    ;;
  result)
    n="${2:-}"; st="${3:-}"; notas="${4:-}"
    [ -n "$n" ] && [ -n "$st" ] || die "uso: $0 result <nome> <FUNCIONA|FALHA|PARCIAL> \"notas\""
    row="$(cat_get "$n")" || true; [ -n "$row" ] || die "candidata '$n' não está no catálogo (use add)."
    url="$(printf '%s' "$row" | cut -f3)"
    cat_set "$n" "$st" "$url" "$notas" "$(date -Iseconds)"
    ok "$(icon "$st") '$n' marcada como $st. $notas"
    ;;
  fetch)
    n="${2:-}"; [ -n "$n" ] || die "uso: $0 fetch <nome>"
    row="$(cat_get "$n")" || true; [ -n "$row" ] || die "'$n' não está no catálogo."
    url="$(printf '%s' "$row" | cut -f3)"
    [ -n "$url" ] && [ "$url" != "-" ] || die "'$n' não tem URL. Baixe manual e use: scripts/sdcard/sd-image.sh add $n <arquivo.img>"
    mkdir -p "$DL"; f="$DL/$(basename "$url")"
    say "baixando $url ..."
    if command -v curl >/dev/null; then curl -fL --progress-bar -o "$f" "$url"; else wget -O "$f" "$url"; fi
    img="$f"
    case "$f" in
        *.gz)  img="${f%.gz}";  [ -f "$img" ] || gunzip -kc "$f" > "$img";;
        *.xz)  img="${f%.xz}";  [ -f "$img" ] || unxz -kc "$f" > "$img";;
        *.zip) say "descompacte o .zip e use sd-image.sh add"; img="$f";;
        *.7z)  command -v 7z >/dev/null && 7z e -o"$DL" "$f" >/dev/null && img="$(ls -t "$DL"/*.img 2>/dev/null|head -1)";;
    esac
    case "$img" in *.img) "$SELF/sd-image.sh" add "$n" "$img"; cat_set "$n" "TESTANDO" "$url" "$(printf '%s' "$row"|cut -f4)" "$(printf '%s' "$row"|cut -f5)";
                          ok "pronto p/ gravar:  sudo scripts/sdcard/sd-update.sh <cartao> $n";;
                   *) say "Baixado em $img — descompacte e use: scripts/sdcard/sd-image.sh add $n <arquivo.img>";; esac
    ;;
  *) die "comando inválido: $cmd (use list|next|add|fetch|result)";;
esac
