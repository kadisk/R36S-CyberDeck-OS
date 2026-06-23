#!/bin/sh
# cyberdeck-session.sh — entrada de UI no boot do R36S CyberDeck OS.
# Roda o SELETOR de interface (cyberdeck-chooser) e lança a interface escolhida:
#   web -> Xorg + Chromium kiosk (start-cyberdeck-x.sh)
#   fb  -> renderizador nativo (cyberdeck-fb)
# Se a interface sair (F5/crash), o cyberdeck-session.service reinicia e o seletor
# reaparece. A escolha persiste em /var/lib/cyberdeck/interface (gravada pelo chooser
# ou por ações do agente "Trocar interface"). Default: web.
CHOOSER=/usr/local/bin/cyberdeck-chooser
PREF=/var/lib/cyberdeck/interface

choice=""
if [ -x "$CHOOSER" ]; then
    # o chooser desenha no /dev/fb0, lê o joypad e imprime "web"/"fb" no stdout
    choice="$("$CHOOSER" 2>/dev/null | tail -n1)"
fi
# fallback: arquivo de preferência; senão, web
[ -n "$choice" ] || choice="$(cat "$PREF" 2>/dev/null)"
[ -n "$choice" ] || choice=web

case "$choice" in
    fb) exec /usr/local/bin/cyberdeck-fb ;;
    *)  exec /usr/local/bin/start-cyberdeck-x.sh ;;
esac
