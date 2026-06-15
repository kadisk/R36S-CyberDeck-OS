#!/bin/sh
# cyberdeck-kiosk.sh — cliente X: abre a CyberDeck UI (HTML/JS) em Chromium kiosk,
# fullscreen 640x480, no painel BSP (Xorg fbdev sobre /dev/fb0). Sem Wayland/GBM.
# Chamado por start-cyberdeck-x.sh (via xinit). Software rendering (--disable-gpu)
# porque o blob Mali não dá GL no X — a UI é leve, então tudo bem.
export DISPLAY=:0
xset -dpms 2>/dev/null; xset s off 2>/dev/null; xset s noblank 2>/dev/null

UI="file:///usr/share/cyberdeck-ui/public/index.html"
BIN="$(command -v chromium || command -v chromium-browser || echo chromium)"

exec "$BIN" \
    --kiosk --app="$UI" \
    --no-sandbox --disable-gpu --disable-software-rasterizer \
    --window-size=640,480 --window-position=0,0 \
    --user-data-dir=/var/lib/cyberdeck-chromium \
    --no-first-run --fast --fast-start --disable-translate --noerrdialogs \
    --disable-features=Translate --check-for-update-interval=31536000 \
    --disable-pinch --overscroll-history-navigation=0
