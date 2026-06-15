#!/usr/bin/env bash
# sd-update-ui.sh — atualiza SÓ a UI web (cyberdeck-ui/public) num cartão já gravado,
# sem regravar os 4GB. Monta a rootfs (p2) e copia para /usr/share/cyberdeck-ui/public.
# Iteração rápida de HTML/JS/CSS. PRECISA SUDO. Não regrava a imagem.
#
# Uso: sudo scripts/sdcard/sd-update-ui.sh <nome-do-cartao | /dev/sdX>
set -eu
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF/sdcard-lib.sh"
REPO="$(cd "$SELF/../.." && pwd)"
SRC="$REPO/cyberdeck-ui/public"

CARD="${1:-}"
[ -n "$CARD" ] || die "uso: sudo $0 <nome-do-cartao | /dev/sdX>"
[ "$(id -u)" -eq 0 ] || die "precisa de root: sudo $0 $CARD"
[ -d "$SRC" ] || die "UI não encontrada: $SRC"

sd_resolve_device "$CARD" || exit 1
DEV="$SD_DEV"; P2="${DEV}2"
[ -b "$P2" ] || die "partição rootfs $P2 não existe"

say "================= ATUALIZAR UI WEB (sem rebuild) ================="
say "Cartão '$CARD' -> $DEV  (rootfs $P2)"
sd_require_writable "$DEV"

MNT="$(mktemp -d)"; trap 'mountpoint -q "$MNT" && umount "$MNT"; rmdir "$MNT" 2>/dev/null||true' EXIT
mount "$P2" "$MNT" || die "falha ao montar $P2"
DST="$MNT/usr/share/cyberdeck-ui"
[ -d "$DST" ] || die "$P2 não tem a UI instalada ($DST) — é a imagem x11?"

rm -rf "$DST/public.bak" 2>/dev/null || true
[ -d "$DST/public" ] && mv "$DST/public" "$DST/public.bak"
cp -a "$SRC" "$DST/public"

# também sincroniza o agente Node (se já existir no cartão — não instala nodejs)
AGENT_SRC="$REPO/cyberdeck-agent/agent.js"
AGENT_DST="$MNT/usr/local/lib/cyberdeck-agent/agent.js"
if [ -f "$AGENT_SRC" ] && [ -d "$MNT/usr/local/lib/cyberdeck-agent" ]; then
    cp -a "$AGENT_SRC" "$AGENT_DST"; say "agente Node sincronizado (agent.js)."
fi
sync
ok "UI atualizada em '$SD_NAME' ($P2): $(find "$SRC" -type f | wc -l) arquivos."
say "Backup da anterior em $DST/public.bak (dentro do cartão)."
say "RESULTADO: reinsira no R36S e ligue. Navegue as abas pelo gamepad."