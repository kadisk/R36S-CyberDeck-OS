#!/usr/bin/env bash
# sdcard-lib.sh — funções compartilhadas do kit de SD card (NÃO executa sozinho).
#
# Identidade do cartão = "fingerprint" estável derivada de: serial USB + modelo +
# tamanho físico. Allowlist em authorized-cards.tsv. Ações de escrita só prosseguem
# em cartão AUTORIZADO e que passe nas checagens de segurança.
#
# Saídas pensadas para humano E IA: blocos com cabeçalho + linhas "chave: valor".

SDLIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ALLOWLIST="${SDCARD_ALLOWLIST:-$SDLIB_DIR/authorized-cards.tsv}"

# ---- saída ----
hr(){ printf '%s\n' "------------------------------------------------------------"; }
say(){ printf '%s\n' "$*"; }
ok(){ printf '✓ %s\n' "$*"; }
warn(){ printf '⚠ %s\n' "$*" >&2; }
err(){ printf '✗ ERRO: %s\n' "$*" >&2; }
die(){ err "$*"; exit 1; }

# ---- helpers de device ----
sd_basename(){ basename "$1"; }                 # /dev/sdd -> sdd
sd_is_wholedisk(){ [ -e "/sys/block/$(sd_basename "$1")" ]; }
sd_size_bytes(){ local b; b="$(sd_basename "$1")"; echo $(( $(cat "/sys/block/$b/size" 2>/dev/null||echo 0) * 512 )); }
sd_removable(){ cat "/sys/block/$(sd_basename "$1")/removable" 2>/dev/null || echo 0; }
sd_human_size(){ awk -v b="$1" 'BEGIN{ s="B KiB MiB GiB TiB"; split(s,u," "); i=1; while(b>=1024 && i<5){b/=1024;i++} printf "%.1f %s", b, u[i]}'; }

# Propriedades udev (serial/modelo) — sem sudo.
sd_props(){
    local dev="$1"
    ID_SERIAL_SHORT=""; ID_MODEL=""; ID_VENDOR=""; ID_BUS=""
    if command -v udevadm >/dev/null; then
        eval "$(udevadm info --query=property --name="$dev" 2>/dev/null \
              | grep -E '^(ID_SERIAL_SHORT|ID_SERIAL|ID_MODEL|ID_VENDOR|ID_BUS)=' \
              | sed -E 's/^([A-Z_]+)=(.*)$/\1="\2"/')"
    fi
    [ -n "${ID_SERIAL_SHORT:-}" ] || ID_SERIAL_SHORT="${ID_SERIAL:-}"
}

# Fingerprint estável (16 hex). Baseia-se em serial+modelo+tamanho físico (o
# tamanho não muda ao reparticionar/regravar).
sd_fingerprint(){
    local dev="$1"; sd_props "$dev"
    local size; size="$(sd_size_bytes "$dev")"
    local raw="bus=${ID_BUS}|serial=${ID_SERIAL_SHORT}|model=${ID_MODEL}|size=${size}"
    SD_FP="$(printf '%s' "$raw" | sha256sum | cut -c1-16)"
    SD_FP_RAW="$raw"; SD_SIZE="$size"
}

# ---- allowlist ----
sd_allowlist_init(){ [ -f "$ALLOWLIST" ] || { printf '# fingerprint\tnome\tserial\tmodelo\tsize_bytes\tadicionado\n' > "$ALLOWLIST"; }; }
sd_is_authorized(){ # $1 = fingerprint
    [ -f "$ALLOWLIST" ] || return 1
    grep -qE "^$1[[:space:]]" "$ALLOWLIST"
}
sd_authorized_name(){ grep -E "^$1[[:space:]]" "$ALLOWLIST" 2>/dev/null | head -1 | cut -f2; }

# ---- resolver cartão por NOME (ou fingerprint, ou /dev/sdX) -> SD_DEV ----
# Permite usar o nome registrado; descobre o /dev/sdX atual pela fingerprint
# (o device pode mudar a cada conexão). Aceita também /dev/sdX direto.
sd_resolve_device(){ # $1 = nome | fingerprint | /dev/sdX
    local arg="$1"; SD_DEV=""
    if [ -b "$arg" ]; then SD_DEV="$arg"; return 0; fi
    sd_allowlist_init
    local fp=""
    if grep -qE "^$arg[[:space:]]" "$ALLOWLIST" 2>/dev/null; then
        fp="$arg"                                   # já é uma fingerprint
    else
        fp="$(grep -vE '^#' "$ALLOWLIST" 2>/dev/null | awk -F'\t' -v n="$arg" '$2==n{print $1; exit}')"
    fi
    [ -n "$fp" ] || { err "'$arg' não é um device nem um cartão cadastrado. Veja: scripts/sdcard/sd-cards.sh"; return 1; }
    local d b dev
    for d in /sys/block/sd*; do
        [ -e "$d" ] || continue
        b="$(basename "$d")"; dev="/dev/$b"
        [ "$(cat "$d/removable" 2>/dev/null)" = "1" ] || continue
        [ "$(sd_size_bytes "$dev")" -gt 0 ] || continue
        sd_fingerprint "$dev"
        if [ "$SD_FP" = "$fp" ]; then SD_DEV="$dev"; return 0; fi
    done
    err "cartão '$arg' (fingerprint $fp) NÃO está conectado agora. Insira o cartão e tente de novo."
    return 1
}

# ---- checagem de segurança (retorna 0 se seguro p/ escrita) ----
sd_safety_reasons(){ # imprime motivos de RECUSA (vazio = seguro). $1=dev
    local dev="$1" b; b="$(sd_basename "$dev")"
    sd_is_wholedisk "$dev" || { echo "não é um disco inteiro (use /dev/sdX, não uma partição)"; return; }
    [ "$(sd_removable "$dev")" = "1" ] || echo "NÃO é removível (risco de ser disco interno/sistema)"
    case "$b" in nvme*|md*|dm-*) echo "tipo de device suspeito ($b) — não é um leitor de SD";; esac
    local sz; sz="$(sd_size_bytes "$dev")"
    [ "$sz" -gt 0 ] || echo "tamanho zero / device ausente"
    [ "$sz" -le $((256*1000*1000*1000)) ] || echo "grande demais p/ um microSD ($(sd_human_size "$sz"))"
    # nenhuma partição montada em ponto crítico
    local mp
    while read -r mp; do
        case "$mp" in /|/home|/boot|/boot/efi|/usr|/var|/etc) echo "tem partição montada em '$mp' (disco do sistema!)";; esac
    done < <(lsblk -nro MOUNTPOINT "$dev" 2>/dev/null | grep -v '^$')
}

# ---- bloco descritivo do cartão (humano + IA) ----
sd_describe(){ # $1 = dev
    local dev="$1"; sd_fingerprint "$dev"
    local name auth reasons
    if sd_is_authorized "$SD_FP"; then auth="SIM"; name="$(sd_authorized_name "$SD_FP")"; else auth="NÃO"; name="(não cadastrado)"; fi
    reasons="$(sd_safety_reasons "$dev")"
    hr
    say "CARTÃO SD: $dev"
    hr
    printf '  %-12s: %s\n' "fingerprint" "$SD_FP"
    printf '  %-12s: %s\n' "serial"      "${ID_SERIAL_SHORT:-(desconhecido)}"
    printf '  %-12s: %s\n' "modelo"      "${ID_MODEL:-(desconhecido)} ${ID_VENDOR:+/ $ID_VENDOR}"
    printf '  %-12s: %s\n' "tamanho"     "$(sd_human_size "$SD_SIZE") ($SD_SIZE bytes)"
    printf '  %-12s: %s\n' "removível"   "$([ "$(sd_removable "$dev")" = 1 ] && echo sim || echo NÃO)"
    printf '  %-12s: %s\n' "autorizado"  "$([ "$auth" = SIM ] && echo "✓ SIM — '$name'" || echo "✗ NÃO")"
    if [ -n "$reasons" ]; then
        printf '  %-12s:\n' "seguranca"
        while IFS= read -r r; do [ -n "$r" ] && printf '      ✗ %s\n' "$r"; done <<< "$reasons"
    else
        printf '  %-12s: %s\n' "seguranca" "✓ checagens ok (removível, tamanho ok, sem montagem de sistema)"
    fi
    hr
    SD_REASONS="$reasons"; SD_AUTH="$auth"; SD_NAME="$name"
}

# Garante autorizado + seguro, senão aborta. (usar antes de escrever)
sd_require_writable(){ # $1 = dev
    sd_describe "$1"
    [ "$SD_AUTH" = "SIM" ] || die "cartão NÃO autorizado (fingerprint $SD_FP). Cadastre com: scripts/sdcard/sd-allow.sh $1 <nome>"
    [ -z "$SD_REASONS" ]   || die "cartão reprovado nas checagens de segurança (veja acima). Ação abortada."
    ok "cartão autorizado e seguro — pode prosseguir."
}
