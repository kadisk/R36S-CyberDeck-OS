#!/usr/bin/env bash
# sd-revoke.sh — remove um cartão da allowlist (por fingerprint ou nome). Sem sudo.
#
# Uso: scripts/sdcard/sd-revoke.sh <fingerprint|nome>
set -eu
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/sdcard-lib.sh"
sd_allowlist_init

KEY="${1:-}"; [ -n "$KEY" ] || die "uso: $0 <fingerprint|nome>"
[ -f "$ALLOWLIST" ] || die "allowlist não existe ainda."

# casa por fingerprint (col1) OU nome (col2)
match="$(grep -vE '^#' "$ALLOWLIST" | awk -F'\t' -v k="$KEY" '$1==k || $2==k {print}')"
[ -n "$match" ] || die "nenhum cartão com fingerprint/nome '$KEY' na lista."

say "Removendo da allowlist:"
printf '%s\n' "$match" | while IFS=$'\t' read -r fp name serial model size added; do
    printf '  - %s  (%s, %s)\n' "$name" "$fp" "$(sd_human_size "${size:-0}")"
done

tmp="$(mktemp)"
awk -F'\t' -v k="$KEY" 'NR==1 || ($1!=k && $2!=k)' "$ALLOWLIST" > "$tmp" && mv "$tmp" "$ALLOWLIST"
ok "removido. Scripts de escrita não aceitam mais este cartão."
