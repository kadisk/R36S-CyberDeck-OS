#!/bin/sh
# start-cyberdeck-cog.sh — lança a CyberDeck UI (HTML/JS) em kiosk.
#
# Caminho: cage (compositor Wayland kiosk, wlroots) + cog --platform=wl (WPE).
# O cog prefere Wayland (wl=500 > drm=200) e o caminho DRM puro deu segfault no
# swap de buffer com o blob Mali. cage usa a variante wayland-gbm do Mali.
#
# Loga em BOOT:/cyberdeck-cog.log p/ diagnóstico no PC (R36S sem teclado).

UI="file:///usr/share/cyberdeck-ui/public/index.html"

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/cyberdeck}"
mkdir -p "$XDG_RUNTIME_DIR"; chmod 700 "$XDG_RUNTIME_DIR"

# libMali (do ArkOS) como provedor de EGL/GLES/GBM + Wayland-EGL.
[ -d /opt/mali ] && export LD_LIBRARY_PATH="/opt/mali:${LD_LIBRARY_PATH:-}"

# wlroots/cage sem logind: sessão "builtin" do libseat (privilegiada; rodamos root).
export LIBSEAT_BACKEND=builtin
export WLR_RENDERER=gles2
export WLR_NO_HARDWARE_CURSORS=1
export WLR_DRM_NO_ATOMIC=1

# Log p/ a partição BOOT (FAT), senão /var/log.
LOG=/var/log/cyberdeck-cog.log
BMP=/run/bootlog; mkdir -p "$BMP"
for d in /dev/mmcblk0p1 /dev/mmcblk1p1; do
    [ -b "$d" ] && mount -t vfat -o rw "$d" "$BMP" 2>/dev/null && LOG="$BMP/cyberdeck-cog.log" && break
done

{
    echo "===== cog/cage start $(date) ====="
    echo "## launcher: cage + cog --platform=wl (v2)"
    echo "## /dev/dri"; ls -l /dev/dri 2>/dev/null
    echo "## /opt/mali (libmali.so deve ser a variante WAYLAND)"; ls -l /opt/mali 2>/dev/null
    echo "## cage:"; command -v cage && cage --version 2>&1
    echo "## cog:";  cog --version 2>&1
    echo "## LD_LIBRARY_PATH=$LD_LIBRARY_PATH  LIBSEAT_BACKEND=$LIBSEAT_BACKEND"
    echo "----- cage -- cog --platform=wl output -----"
} > "$LOG" 2>&1
sync

export WPE_DEBUG=1 G_MESSAGES_DEBUG=all WAYLAND_DEBUG=0
cage -- cog --platform=wl "$UI" >> "$LOG" 2>&1
rc=$?
echo "===== saiu (cod $rc) $(date) =====" >> "$LOG"
sync
exit $rc
