#!/usr/bin/env bash
# sd-apply-wifi.sh — aplica TODA a stack de Wi-Fi (dongle USB) na rootfs de um
# cartão JÁ GRAVADO, SEM reflash completo (sem qemu/debootstrap). Instala:
#   - módulos do kernel 4.4.189 (se faltarem) + depmod + autoload do 8188fu
#   - gerenciador /usr/local/bin/cyberdeck-net.sh
#   - serviço cyberdeck-net.service (habilitado) + regra udev (hotplug)
#   - /etc/wpa_supplicant/cyberdeck.conf a partir de board/r36s/wifi.conf (chmod 600)
#
# Depois é só inserir o cartão e bootar: conecta sozinho. PRECISA SUDO.
#
# Uso:  sudo scripts/sdcard/sd-apply-wifi.sh <nome-do-cartao | /dev/sdX>
set -eu
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF/sdcard-lib.sh"
REPO="$(cd "$SELF/../.." && pwd)"

KVER=4.4.189
MODSRC="$REPO/artifacts/arkos-reference/modules/$KVER"
NET_SH="$REPO/runtime/scripts/cyberdeck-net.sh"
NET_SVC="$REPO/runtime/services/cyberdeck-net.service"
UDEV_RULE="$REPO/board/r36s/rootfs-overlay/etc/udev/rules.d/90-cyberdeck-wifi.rules"
WIFI_FILE="$REPO/board/r36s/wifi.conf"

CARD="${1:-}"
[ -n "$CARD" ] || die "uso: sudo $0 <nome-do-cartao | /dev/sdX>"
[ "$(id -u)" -eq 0 ] || die "precisa de root (montar/escrever): sudo $0 $CARD"
[ -f "$NET_SH" ] && [ -f "$NET_SVC" ] && [ -f "$UDEV_RULE" ] || die "fontes do projeto ausentes (runtime/board)"

sd_resolve_device "$CARD" || exit 1
DEV="$SD_DEV"; P2="${DEV}2"
[ -b "$P2" ] || die "partição rootfs $P2 não existe"

sd_describe "$DEV"
say "================= APLICAR WI-FI NO CARTÃO (sem reflash) ================="
sd_require_writable "$DEV"

MNT="$(mktemp -d)"; trap 'mountpoint -q "$MNT" && umount "$MNT"; rmdir "$MNT" 2>/dev/null||true' EXIT
mount "$P2" "$MNT" || die "falha ao montar $P2 (rw)"

# 1) módulos do kernel BSP (Wi-Fi) — instala se faltarem; sempre roda depmod
if [ ! -e "$MNT/lib/modules/$KVER/kernel/drivers/net/wireless/rockchip_wlan/rtl8188fu/8188fu.ko" ]; then
    [ -d "$MODSRC" ] || die "módulos $KVER ausentes no host: $MODSRC (rode sudo scripts/extract-arkos-modules.sh)"
    say "instalando módulos $KVER ($(du -sh "$MODSRC"|cut -f1))"
    install -d "$MNT/lib/modules"
    rm -rf "$MNT/lib/modules/$KVER"
    cp -a "$MODSRC" "$MNT/lib/modules/$KVER"
else
    say "módulos $KVER já presentes no cartão"
fi
depmod -b "$MNT" "$KVER"
# NÃO pré-carregar no boot (não vincula antes do plug); só preferência de driver.
printf 'blacklist rtl8188fu\n' > "$MNT/etc/modprobe.d/cyberdeck-wifi.conf"
rm -f "$MNT/etc/modules-load.d/cyberdeck-wifi.conf"

# 2) gerenciador + serviço + regra udev
install -D -m0755 "$NET_SH"    "$MNT/usr/local/bin/cyberdeck-net.sh"
install -D -m0644 "$NET_SVC"   "$MNT/etc/systemd/system/cyberdeck-net.service"
install -D -m0644 "$UDEV_RULE" "$MNT/etc/udev/rules.d/90-cyberdeck-wifi.rules"

# habilita o serviço offline (equivale a `systemctl enable`)
install -d "$MNT/etc/systemd/system/multi-user.target.wants"
ln -sf ../cyberdeck-net.service "$MNT/etc/systemd/system/multi-user.target.wants/cyberdeck-net.service"

# 3) credenciais -> /etc/wpa_supplicant/cyberdeck.conf
[ -f "$WIFI_FILE" ] && . "$WIFI_FILE" || true
if [ -n "${WIFI_SSID:-}" ] && [ -n "${WIFI_PSK:-}" ]; then
    say "Wi-Fi: SSID '$WIFI_SSID' (country ${WIFI_COUNTRY:-BR})"
    install -d -m0755 "$MNT/etc/wpa_supplicant"
    ( umask 077; cat > "$MNT/etc/wpa_supplicant/cyberdeck.conf" <<EOF
ctrl_interface=/run/wpa_supplicant
update_config=1
country=${WIFI_COUNTRY:-BR}
network={
    ssid="$WIFI_SSID"
    psk="$WIFI_PSK"
    key_mgmt=WPA-PSK
    scan_ssid=1
}
EOF
    )
    chmod 600 "$MNT/etc/wpa_supplicant/cyberdeck.conf"
else
    warn "board/r36s/wifi.conf sem WIFI_SSID/WIFI_PSK — pulei a config (sem rede pré-definida)"
fi

# 4) checagem: ferramentas necessárias estão no rootfs?
say "ferramentas no rootfs:"
for t in sbin/wpa_supplicant usr/sbin/wpa_supplicant usr/sbin/dhclient sbin/dhclient usr/sbin/iw usr/sbin/iwlist; do
    [ -e "$MNT/$t" ] && echo "   ok /$t" || true
done
MISSING=""
for bin in wpa_supplicant dhclient; do
    found=""
    for p in sbin usr/sbin bin usr/bin; do [ -e "$MNT/$p/$bin" ] && found=1; done
    [ -z "$found" ] && MISSING="$MISSING $bin"
done
[ -n "$MISSING" ] && warn "FALTAM no rootfs:$MISSING — precisa rebuild (apt) ou instalar no aparelho"

sync
ok "Wi-Fi aplicado em '$CARD'. Insira no R36S e bote pra bootar."
say "Diagnóstico no aparelho (console serial, root): sh /usr/local/bin/cyberdeck-net.sh diag"
