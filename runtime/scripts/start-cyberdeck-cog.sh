#!/bin/sh
# start-cyberdeck-cog.sh — lança a CyberDeck UI (HTML/JS) em kiosk via cog (WPE),
# renderizando no KMS (/dev/dri/card0) com EGL/GLES do libMali. Fase 4c.
#
# Grava um LOG na partição BOOT (FAT) para diagnóstico no PC (R36S sem teclado):
# se o cog falhar no EGL/Mali, o erro fica em BOOT:/cyberdeck-cog.log.

UI="file:///usr/share/cyberdeck-ui/public/index.html"

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/cyberdeck}"
mkdir -p "$XDG_RUNTIME_DIR"; chmod 700 "$XDG_RUNTIME_DIR"

# libMali (do ArkOS) como provedor de EGL/GLES/GBM.
[ -d /opt/mali ] && export LD_LIBRARY_PATH="/opt/mali:${LD_LIBRARY_PATH:-}"

# Log: tenta a partição BOOT (FAT) p/ ler no PC; senão, /var/log.
LOG=/var/log/cyberdeck-cog.log
BMP=/run/bootlog; mkdir -p "$BMP"
for d in /dev/mmcblk0p1 /dev/mmcblk1p1; do
    [ -b "$d" ] && mount -t vfat -o rw "$d" "$BMP" 2>/dev/null && LOG="$BMP/cyberdeck-cog.log" && break
done

{
    echo "===== cog start $(date) ====="
    echo "## /dev/dri"; ls -l /dev/dri 2>/dev/null
    echo "## /opt/mali"; ls -l /opt/mali 2>/dev/null
    echo "## cog version"; cog --version 2>&1
    echo "## LD_LIBRARY_PATH=$LD_LIBRARY_PATH"
    echo "## env de plataforma: COG_PLATFORM_DRM"
    echo "----- cog --platform=drm output -----"
} > "$LOG" 2>&1
sync

# DRM em modo NÃO-atomic: o modo atomic causou segfault no swap de buffer
# (e o aviso "does not support rotation 0" vem do plane atomic). O caminho legado
# (drmModeSetCrtc/SetPlane) é mais simples e estável com o blob Mali.
export WPE_DEBUG=1 G_MESSAGES_DEBUG=all
COG_PARAMS="${COG_PARAMS:-disable-atomic-modesetting=true}"
echo "## cog --platform=drm --platform-params=$COG_PARAMS" >> "$LOG"
cog --platform=drm --platform-params="$COG_PARAMS" "$UI" >> "$LOG" 2>&1
rc=$?
echo "===== cog saiu (cod $rc) $(date) =====" >> "$LOG"
sync
exit $rc
