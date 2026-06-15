#!/usr/bin/env bash
#
# start-cyberdeck-ui.sh
# ---------------------
# Inicia a CyberDeck UI em fullscreen/kiosk no R36S.
# Caminho preferido: Cage (Wayland kiosk) + WPE WebKit (cog). Fallbacks abaixo.
#
# Instalado em /usr/local/bin/ no rootfs final. Chamado por cyberdeck.service.
# No PC, serve só como referência (o caminho gráfico real é validado no aparelho).
#
set -u

UI_DIR="${CYBERDECK_UI_DIR:-/usr/share/cyberdeck-ui/public}"
UI_INDEX="$UI_DIR/index.html"
UI_URL="file://$UI_INDEX"

log() { echo "[cyberdeck-ui] $*"; }
has() { command -v "$1" >/dev/null 2>&1; }

[ -f "$UI_INDEX" ] || { echo "[cyberdeck-ui][ERRO] index não encontrado: $UI_INDEX" >&2; exit 1; }

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/0}"
mkdir -p "$XDG_RUNTIME_DIR" 2>/dev/null || true

# 1) Preferido: Cage + cog (WPE WebKit)
if has cage && has cog; then
    log "Cage + cog (WPE WebKit): $UI_URL"
    exec cage -- cog "$UI_URL"
fi

# 2) Cage + WebKitGTK (cog também roda WebKitGTK; ou MiniBrowser)
if has cage && has cog; then
    log "Cage + cog: $UI_URL"
    exec cage -- cog "$UI_URL"
fi

# 3) Fallback: Chromium em kiosk (pesado — só se nada acima existir)
if has chromium || has chromium-browser; then
    BIN="$(command -v chromium || command -v chromium-browser)"
    log "Fallback Chromium kiosk: $UI_URL"
    exec "$BIN" --kiosk --app="$UI_URL" \
        --window-size=640,480 --disable-pinch \
        --no-first-run --noerrdialogs --disable-translate
fi

echo "[cyberdeck-ui][ERRO] Nenhum runtime web encontrado (cage/cog/chromium)." >&2
echo "Ver docs/web-ui/runtime-options.md." >&2
exit 1
