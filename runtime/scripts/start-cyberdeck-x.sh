#!/bin/sh
# start-cyberdeck-x.sh — inicia o Xorg (fbdev no painel BSP) e o cliente kiosk.
# Lançado pelo cyberdeck-x.service no boot. Loga em BOOT:/cyberdeck-x.log p/ diagnóstico.

LOG=/var/log/cyberdeck-x.log
BMP=/run/bootlog; mkdir -p "$BMP"
for d in /dev/mmcblk0p1 /dev/mmcblk1p1; do
    [ -b "$d" ] && mount -t vfat -o rw "$d" "$BMP" 2>/dev/null && LOG="$BMP/cyberdeck-x.log" && break
done
{
    echo "===== cyberdeck-x start $(date) ====="
    echo "## /dev/fb*"; ls -l /dev/fb* 2>/dev/null
    echo "## /dev/dri"; ls -l /dev/dri 2>/dev/null
    echo "## chromium:"; command -v chromium chromium-browser 2>/dev/null
    echo "## Xorg:"; command -v Xorg X 2>/dev/null
    echo "----- xinit/Xorg/chromium output -----"
} > "$LOG" 2>&1
sync

# Xorg em fbdev no /dev/fb0 (sem GL); cliente = cyberdeck-kiosk.sh
# -nocursor: o X não desenha o ponteiro de hardware (a UI usa um cursor virtual próprio)
exec xinit /usr/local/bin/cyberdeck-kiosk.sh -- /usr/bin/X :0 vt1 -nolisten tcp -keeptty -nocursor >> "$LOG" 2>&1
