#!/bin/sh
# cyberdeck-kiosk.sh — cliente X: abre a CyberDeck UI (HTML/JS) em Chromium kiosk,
# fullscreen 640x480, no painel BSP (Xorg fbdev sobre /dev/fb0). Sem Wayland/GBM.
# Chamado por start-cyberdeck-x.sh (via xinit). Software rendering (--disable-gpu)
# porque o blob Mali não dá GL no X — a UI é leve, então tudo bem.
export DISPLAY=:0
xset -dpms 2>/dev/null; xset s off 2>/dev/null; xset s noblank 2>/dev/null

# a URL depende da interface escolhida no seletor: web (vanilla) ou react.
PREF="$(cat /var/lib/cyberdeck/interface 2>/dev/null)"
if [ "$PREF" = "react" ]; then
    UI="file:///usr/share/cyberdeck-web-react/index.html"
else
    UI="file:///usr/share/cyberdeck-ui/public/index.html"
fi
BIN="$(command -v chromium || command -v chromium-browser || echo chromium)"

exec "$BIN" \
    --kiosk --app="$UI" \
    --no-sandbox --disable-gpu --disable-software-rasterizer \
    --window-size=640,480 --window-position=0,0 \
    --user-data-dir=/var/lib/cyberdeck-chromium \
    --no-first-run --fast --fast-start --disable-translate --noerrdialogs \
    --disable-features=Translate,TranslateUI --check-for-update-interval=31536000 \
    --disable-pinch --overscroll-history-navigation=0 \
    --allow-file-access-from-files --autoplay-policy=no-user-gesture-required
