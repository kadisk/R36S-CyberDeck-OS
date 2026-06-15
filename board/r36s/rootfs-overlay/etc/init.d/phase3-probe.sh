#!/bin/sh
# phase3-probe.sh — R36S CyberDeck OS (Fase 3)
# Confirma controle do FRAMEBUFFER e captura o mapeamento real do JOYPAD.
# Roda uma vez (marcador na BOOT), grava resultados na partição BOOT (lê-se no PC).
# Não-destrutivo. O teste de tela apenas escreve em /dev/fb0 (volátil).

PATH=/bin:/sbin:/usr/bin:/usr/sbin
MP=/mnt/boot
CON=/dev/tty1
CAP_SECS=30

mkdir -p "$MP"
BOOTDEV=""
for d in /dev/mmcblk0p1 /dev/mmcblk1p1; do [ -b "$d" ] && BOOTDEV="$d" && break; done
[ -n "$BOOTDEV" ] || { echo "[phase3] sem BOOT dev" > "$CON" 2>/dev/null; exit 0; }
mount -t vfat "$BOOTDEV" "$MP" 2>/dev/null || { echo "[phase3] não montei BOOT" > "$CON" 2>/dev/null; exit 0; }

# Roda só uma vez por cartão (apague o marcador p/ repetir).
if [ -f "$MP/.phase3-probe-done" ]; then umount "$MP" 2>/dev/null; exit 0; fi

say() { echo "$*" ; echo "$*" > "$CON" 2>/dev/null; }

# ---------------------------------------------------------------------------
# 1. Geometria do framebuffer + dispositivos
# ---------------------------------------------------------------------------
{
    echo "===== fbinfo / input ($(date 2>/dev/null)) ====="
    echo "## fbset -i"; (command -v fbset >/dev/null && fbset -i) 2>&1
    echo "## /sys/class/graphics/fb0"
    for f in /sys/class/graphics/fb0/virtual_size /sys/class/graphics/fb0/bits_per_pixel \
             /sys/class/graphics/fb0/stride /sys/class/graphics/fb0/modes \
             /sys/class/graphics/fb0/name; do
        [ -r "$f" ] && echo "  $f = $(cat "$f" 2>/dev/null)"
    done
    echo "## /dev/dri"; ls -l /dev/dri 2>/dev/null || echo "  (sem /dev/dri)"
    echo "## /dev/fb*";  ls -l /dev/fb* 2>/dev/null
    echo "## /dev/input"; ls -l /dev/input 2>/dev/null
    echo "## /proc/bus/input/devices"; cat /proc/bus/input/devices 2>/dev/null
    echo "## backlight"; for b in /sys/class/backlight/*/; do
        echo "  $b brightness=$(cat "$b/brightness" 2>/dev/null) max=$(cat "$b/max_brightness" 2>/dev/null)"
    done
} > "$MP/cyberdeck-fbinfo.txt" 2>&1
sync

# ---------------------------------------------------------------------------
# 2. Teste visível no framebuffer (ruído -> preto -> branco -> preto)
# ---------------------------------------------------------------------------
FB=/dev/fb0
if [ -w "$FB" ]; then
    # tamanho aproximado da tela em bytes (stride*yres), com fallback 640*480*4
    STRIDE=$(cat /sys/class/graphics/fb0/stride 2>/dev/null)
    YRES=$(cat /sys/class/graphics/fb0/virtual_size 2>/dev/null | cut -d, -f2)
    BYTES=$(( ${STRIDE:-2560} * ${YRES:-480} ))
    [ "$BYTES" -gt 0 ] 2>/dev/null || BYTES=$((640*480*4))
    KB=$(( BYTES / 1024 + 8 ))

    say "[phase3] TESTE DE TELA: ruido -> preto -> branco (uns 8s)"
    dd if=/dev/urandom of="$FB" bs=1024 count=$KB 2>/dev/null   # ruído = prova de escrita
    sleep 3
    dd if=/dev/zero    of="$FB" bs=1024 count=$KB 2>/dev/null   # preto
    sleep 1
    # branco: zero -> 0xFF
    dd if=/dev/zero bs=1024 count=$KB 2>/dev/null | tr '\000' '\377' > "$FB" 2>/dev/null
    sleep 2
    dd if=/dev/zero    of="$FB" bs=1024 count=$KB 2>/dev/null   # preto de novo
    echo "fb test: escrito ~$BYTES bytes em $FB" >> "$MP/cyberdeck-fbinfo.txt"
else
    say "[phase3] /dev/fb0 não gravável — sem teste de tela"
fi

# ---------------------------------------------------------------------------
# 3. Captura do joypad (~30s) — APERTE TODOS OS BOTÕES
# ---------------------------------------------------------------------------
say ""
say "================ FASE 3: MAPA DO JOYPAD ================"
say " APERTE TODOS OS BOTOES, UM A UM, NOS PROXIMOS ${CAP_SECS}s:"
say " D-pad, A B X Y, L1 R1 L2 R2, F1..F6, analogicos, etc."
say "======================================================="

n=0
for ev in /dev/input/event*; do
    [ -e "$ev" ] || continue
    b=$(basename "$ev")
    ( timeout "$CAP_SECS" cat "$ev" > "$MP/input-$b.bin" 2>/dev/null ) &
    n=$((n+1))
done
[ "$n" -gt 0 ] || say "[phase3] nenhum /dev/input/event* encontrado!"
sleep $(( CAP_SECS + 2 ))
wait 2>/dev/null

# Hexdump legível de cada captura (caso queira colar como texto).
for f in "$MP"/input-event*.bin; do
    [ -e "$f" ] || continue
    sz=$(wc -c < "$f" 2>/dev/null)
    {
        echo "# $f  ($sz bytes; struct input_event = 24B: type@16 code@18 value@20)"
        od -An -tx1 "$f" 2>/dev/null
    } > "${f%.bin}.hex"
done

say "[phase3] captura concluida. Resultados gravados na particao BOOT."
say "[phase3] Desligue e mande os arquivos cyberdeck-fbinfo.txt e input-event*.* "

# Marca como feito e finaliza.
: > "$MP/.phase3-probe-done"
sync
umount "$MP" 2>/dev/null
