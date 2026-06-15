#!/usr/bin/env bash
# sd-cards.sh — lista cartões AUTORIZADOS e os discos removíveis CONECTADOS agora,
# com fingerprint e status. Sem sudo. Leitura apenas.
#
# Uso: scripts/sdcard/sd-cards.sh
set -eu
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/sdcard-lib.sh"
sd_allowlist_init

say "================= CARTÕES AUTORIZADOS (allowlist) ================="
if grep -vqE '^#' "$ALLOWLIST" 2>/dev/null; then
    printf '  %-16s  %-22s  %-10s  %s\n' "FINGERPRINT" "NOME" "TAMANHO" "ADICIONADO"
    grep -vE '^#' "$ALLOWLIST" | while IFS=$'\t' read -r fp name serial model size added; do
        printf '  %-16s  %-22s  %-10s  %s\n' "$fp" "$name" "$(sd_human_size "${size:-0}")" "$added"
    done
else
    say "  (nenhum cartão cadastrado — use sd-allow.sh para adicionar)"
fi
say "  arquivo: $ALLOWLIST"
echo

say "============ DISCOS REMOVÍVEIS CONECTADOS AGORA =================="
found=0
for d in /sys/block/sd*; do
    [ -e "$d" ] || continue
    b="$(basename "$d")"; dev="/dev/$b"
    [ "$(cat "$d/removable" 2>/dev/null)" = "1" ] || continue
    [ "$(sd_size_bytes "$dev")" -gt 0 ] || continue   # leitor vazio
    found=1
    sd_describe "$dev"
done
[ "$found" = 1 ] || say "  (nenhum cartão/leitor removível com mídia detectado)"
echo
say "Dica: cadastre um cartão de teste com:"
say "  scripts/sdcard/sd-allow.sh /dev/sdX \"meu-cartao-teste\""
