#!/bin/sh
# collect-hwinfo.sh — R36S CyberDeck OS (Fase 2 -> ponte p/ Fase 3)
# Coleta dados reais de hardware do R36S e grava na partição BOOT (FAT), para
# serem lidos depois no PC (o R36S não tem teclado). Não é destrutivo: monta a
# BOOT, escreve UM arquivo, sincroniza e desmonta.

PATH=/bin:/sbin:/usr/bin:/usr/sbin
OUT_NAME="cyberdeck-hwinfo.txt"
MP=/mnt/boot
mkdir -p "$MP"

# Acha a partição BOOT (p1) do cartão de SO. Normalmente mmcblk0p1.
BOOTDEV=""
for d in /dev/mmcblk0p1 /dev/mmcblk1p1; do
    [ -b "$d" ] && BOOTDEV="$d" && break
done

dump() {
    echo "===== R36S CyberDeck OS — hwinfo ($(date 2>/dev/null)) ====="
    echo "## uname";            uname -a
    echo "## cmdline";          cat /proc/cmdline
    echo "## device-tree model";cat /proc/device-tree/model 2>/dev/null; echo
    echo "## compatible";       cat /proc/device-tree/compatible 2>/dev/null | tr '\0' ' '; echo
    echo "## os-release";       cat /etc/os-release 2>/dev/null
    echo "## mounts";           cat /proc/mounts
    echo "## blkid (root)";     [ -x /sbin/blkid ] && blkid 2>/dev/null
    echo "## /dev/dri (DRM/KMS p/ Fase 3)"; ls -l /dev/dri 2>/dev/null || echo "  (sem /dev/dri)"
    echo "## /dev/fb*";         ls -l /dev/fb* 2>/dev/null || echo "  (sem framebuffer)"
    echo "## backlight";        ls -l /sys/class/backlight 2>/dev/null
    echo "## /dev/input";       ls -l /dev/input 2>/dev/null
    echo "## input devices";    cat /proc/bus/input/devices 2>/dev/null
    echo "## power_supply (bateria rk817)"; ls /sys/class/power_supply 2>/dev/null
    echo "## drm sysfs";        ls /sys/class/drm 2>/dev/null
    echo "## cpuinfo";          cat /proc/cpuinfo
    echo "## meminfo (topo)";   head -5 /proc/meminfo
    echo "## modules";          cat /proc/modules 2>/dev/null
    echo "## dmesg: panel/dsi/vop/drm/mali/backlight"
    dmesg 2>/dev/null | grep -iE 'panel|dsi|vop|drm|mali|backlight|rockchip' | tail -60
    echo "## dmesg: rk817/charger/battery/saradc/joypad"
    dmesg 2>/dev/null | grep -iE 'rk817|charger|battery|saradc|joypad|adc' | tail -40
    echo "## dmesg: mmc/root/ext4/switch"
    dmesg 2>/dev/null | grep -iE 'mmc|mmcblk|ext4|VFS|rootfs|switch' | tail -40
    echo "===== fim ====="
}

if [ -n "$BOOTDEV" ] && mount -t vfat "$BOOTDEV" "$MP" 2>/dev/null; then
    dump > "$MP/$OUT_NAME" 2>&1
    sync
    umount "$MP" 2>/dev/null
    echo "[hwinfo] relatório gravado em ${BOOTDEV} :/$OUT_NAME (leia no PC)"
else
    # Sem conseguir montar a BOOT: mostra na tela ao menos o essencial.
    echo "[hwinfo] não montei a BOOT ($BOOTDEV); dump na tela:"
    dump
fi
