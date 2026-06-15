#!/usr/bin/env bash
# sd-allow.sh — cadastra (autoriza) um cartão na allowlist. Sem sudo.
# É o passo HUMANO deliberado: depois disso, scripts de escrita aceitam este cartão.
#
# Uso: scripts/sdcard/sd-allow.sh /dev/sdX "nome-amigavel"
set -eu
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/sdcard-lib.sh"
sd_allowlist_init

DEV="${1:-}"; NAME="${2:-}"
[ -n "$DEV" ] || die "uso: $0 /dev/sdX \"nome\""
[ -b "$DEV" ] || die "não é um device de bloco: $DEV"
[ -n "$NAME" ] || NAME="cartao-$(date +%Y%m%d-%H%M%S)"

sd_describe "$DEV"

# Segurança: só deixa cadastrar disco removível (evita cadastrar o disco do sistema).
[ "$(sd_removable "$DEV")" = "1" ] || die "RECUSADO: $DEV não é removível. Não vou cadastrar um possível disco de sistema."
echo "$SD_REASONS" | grep -q "sistema" && die "RECUSADO: $DEV tem montagem de sistema. Não cadastrado."

if sd_is_authorized "$SD_FP"; then
    ok "este cartão JÁ está autorizado como '$(sd_authorized_name "$SD_FP")' (fingerprint $SD_FP). Nada a fazer."
    exit 0
fi
printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$SD_FP" "$NAME" "${ID_SERIAL_SHORT:-?}" "${ID_MODEL:-?}" "$SD_SIZE" "$(date -Iseconds)" >> "$ALLOWLIST"
ok "CARTÃO AUTORIZADO: '$NAME'  (fingerprint $SD_FP)"
say "A partir de agora, sd-flash.sh / sd-edit-extlinux.sh aceitam este cartão."
say "Para remover depois: scripts/sdcard/sd-revoke.sh $SD_FP   (ou pelo nome)"
