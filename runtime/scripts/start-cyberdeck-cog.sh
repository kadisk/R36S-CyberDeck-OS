#!/bin/sh
# start-cyberdeck-cog.sh — lança a CyberDeck UI (HTML/JS) em kiosk via cog (WPE),
# renderizando direto no KMS (/dev/dri/card0) com EGL/GLES do libMali. Fase 4c.
# Instalado em /usr/local/bin no rootfs Debian; chamado por cyberdeck-cog.service.

UI="file:///usr/share/cyberdeck-ui/public/index.html"

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/cyberdeck}"
mkdir -p "$XDG_RUNTIME_DIR"; chmod 700 "$XDG_RUNTIME_DIR"

# Garante o libMali (do ArkOS) como provedor de EGL/GLES.
[ -d /opt/mali ] && export LD_LIBRARY_PATH="/opt/mali:${LD_LIBRARY_PATH:-}"

# cog com a plataforma DRM (sem compositor). 640x480.
exec cog --platform=drm \
         --width=640 --height=480 \
         "$UI"
