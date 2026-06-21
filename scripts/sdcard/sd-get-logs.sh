#!/usr/bin/env bash
# sd-get-logs.sh — extrai LOGS e arquivos de diagnóstico de um cartão para o projeto,
# em  logs/<cartao>/<DATA-DO-UPLOAD>/  (no .gitignore). A pasta é versionada pela
# DATA DO HOST no momento da extração (o RTC do R36S não é confiável).
# Monta BOOT (p1) e rootfs (p2) em SOMENTE LEITURA — não altera o cartão. PRECISA SUDO.
#
# Uso:  sudo scripts/sdcard/sd-get-logs.sh <nome-do-cartao | /dev/sdX>
set -eu
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF/sdcard-lib.sh"
REPO="$(cd "$SELF/../.." && pwd)"

CARD="${1:-}"
[ -n "$CARD" ] || die "uso: sudo $0 <nome-do-cartao | /dev/sdX>"
[ "$(id -u)" -eq 0 ] || die "precisa de root (para montar): sudo $0 $CARD"

sd_resolve_device "$CARD" || exit 1
DEV="$SD_DEV"; P1="${DEV}1"; P2="${DEV}2"
[ -b "$P2" ] || die "partição rootfs $P2 não existe"

sd_describe "$DEV"
NAME="${SD_NAME:-$CARD}"

STAMP="$(date +%Y%m%d-%H%M%S)"                 # data do UPLOAD (host), não do device
DEST="$REPO/logs/$NAME/$STAMP"
say "================= EXTRAIR LOGS (read-only) ================="
say "Cartão '$CARD' -> $DEV"
say "Destino: $DEST  (data do host: $STAMP)"

mkdir -p "$DEST"
MB="$(mktemp -d)"; MR="$(mktemp -d)"
cleanup() {
    mountpoint -q "$MR" && umount "$MR" 2>/dev/null || true
    mountpoint -q "$MB" && umount "$MB" 2>/dev/null || true
    rmdir "$MB" "$MR" 2>/dev/null || true
}
trap cleanup EXIT

mount -o ro "$P2" "$MR" || die "falha ao montar rootfs $P2 (ro)"
mount -o ro "$P1" "$MB" 2>/dev/null || warn "não montei BOOT $P1 (segue só com rootfs)"

# 1) journal do systemd (se persistido em /var/log/journal) -> texto legível
if [ -d "$MR/var/log/journal" ] && command -v journalctl >/dev/null 2>&1; then
    say "exportando journal persistente"
    journalctl -D "$MR/var/log/journal" --no-pager > "$DEST/journal-full.txt" 2>/dev/null || true
    journalctl -D "$MR/var/log/journal" --no-pager -k > "$DEST/journal-kernel.txt" 2>/dev/null || true
else
    echo "(sem journal persistente em /var/log/journal — habilite Storage=persistent)" > "$DEST/journal-AUSENTE.txt"
fi

# 2) /var/log inteiro (syslog, etc., se existirem)
[ -d "$MR/var/log" ] && { mkdir -p "$DEST/var-log"; cp -a "$MR/var/log/." "$DEST/var-log/" 2>/dev/null || true; }

# 3) logs do CyberDeck na BOOT (cyberdeck-x.log etc.)
if mountpoint -q "$MB"; then
    mkdir -p "$DEST/boot"
    for f in "$MB"/*.log "$MB"/boot.ini; do [ -f "$f" ] && cp -a "$f" "$DEST/boot/" 2>/dev/null || true; done
fi

# 4) config/estado relevante de rede e módulos (texto)
mkdir -p "$DEST/state"
{
    echo "### os-release"; cat "$MR/etc/os-release" 2>/dev/null
    echo; echo "### modules-load.d/cyberdeck-wifi.conf"; cat "$MR/etc/modules-load.d/cyberdeck-wifi.conf" 2>/dev/null
    echo; echo "### modprobe.d/cyberdeck-wifi.conf"; cat "$MR/etc/modprobe.d/cyberdeck-wifi.conf" 2>/dev/null
    echo; echo "### /lib/modules (versões presentes)"; ls "$MR/lib/modules" 2>/dev/null
    for KV in "$MR"/lib/modules/*/; do
        kv="$(basename "$KV")"
        echo; echo "### $kv: 8188fu.ko presente?"; find "$KV" -iname '8188fu.ko' -o -iname 'rtl8188fu.ko' 2>/dev/null
        echo "### $kv: alias f179 em modules.alias?"; grep -i 'f179' "$KV/modules.alias" 2>/dev/null
        echo "### $kv: 8188fu em modules.dep?"; grep -i '8188fu' "$KV/modules.dep" 2>/dev/null
        echo "### $kv: indices .bin (depmod)"; ls -l "$KV"/modules.dep.bin "$KV"/modules.alias.bin 2>/dev/null
    done
    echo; echo "### wpa_supplicant/cyberdeck.conf (psk REDIGIDO)"
    sed 's/psk=.*/psk=<REDIGIDO>/' "$MR/etc/wpa_supplicant/cyberdeck.conf" 2>/dev/null || echo "(ausente)"
    echo; echo "### serviços cyberdeck habilitados"
    ls -l "$MR"/etc/systemd/system/multi-user.target.wants/ 2>/dev/null | grep -i cyberdeck
} > "$DEST/state/diagnostico.txt" 2>&1

# 5) resumo: pesca linhas de wifi/módulo nos logs coletados
{
    echo "### grep wifi/módulo nos logs coletados ($STAMP)"
    grep -rInaE '8188|rtl8|f179|wlan|cfg80211|modules-load|modprobe|insmod|wpa_supplicant' \
        "$DEST/journal-full.txt" "$DEST/journal-kernel.txt" "$DEST/var-log" "$DEST/boot" 2>/dev/null \
        | grep -vaE 'screenshots' | tail -200
} > "$DEST/RESUMO-wifi.txt" 2>&1

# dono do usuário real
if [ -n "${SUDO_USER:-}" ]; then
    GRP="$(id -gn "$SUDO_USER" 2>/dev/null || echo "$SUDO_USER")"
    chown -R "$SUDO_USER:$GRP" "$REPO/logs" 2>/dev/null || true
fi
sync

ok "Logs extraídos para: $DEST"
say "Comece por:  $DEST/RESUMO-wifi.txt  e  $DEST/state/diagnostico.txt"
