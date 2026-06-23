#!/usr/bin/env bash
#
# build-x11-rootfs.sh — Fase 5 (X11). Imagem final: BOOT do ArkOS (kernel BSP 4.4 +
# DTB que ACENDE o painel) + rootfs Debian arm64 com Xorg (fbdev no /dev/fb0) +
# Chromium kiosk exibindo a cyberdeck-ui. Sem Wayland/GBM (que travaram antes),
# sem mainline (que não dirige o painel).
#
# ⚠️ PRECISA DE ROOT. PESADO (qemu): instala Xorg+Chromium (~30-60 min).
#
# Uso:  sudo scripts/build-x11-rootfs.sh
#
set -eu
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF_DIR/phase2-config.sh"

log(){ echo "[x11] $*"; }
die(){ echo "[x11][ERRO] $*" >&2; exit 1; }
has(){ command -v "$1" >/dev/null 2>&1; }

[ "$(id -u)" -eq 0 ] || die "Precisa de root. Use: sudo $0"
has qemu-aarch64-static || die "qemu-aarch64-static ausente"
QEMU="$(command -v qemu-aarch64-static)"

SUITE=bookworm
MIRROR=http://deb.debian.org/debian
RF="$BUILD_DIR/x11-rootfs"
P2_MIB="${P2_MIB:-4096}"
OUT="$OUT_DIR/r36s-cyberdeck-x11.img"
PKGS="xserver-xorg-core xserver-xorg-video-fbdev xserver-xorg-input-evdev \
      xserver-xorg-input-joystick \
      xinit x11-xserver-utils chromium fonts-dejavu-core ca-certificates zram-tools \
      nodejs iproute2 wireless-tools wpasupplicant rfkill iw isc-dhcp-client \
      openssh-server avahi-daemon libnss-mdns systemd-timesyncd \
      fbcat fbgrab netpbm scrot alsa-utils mpv ffmpeg"

DEBOOTSTRAP="$(command -v debootstrap || true)"
[ -z "$DEBOOTSTRAP" ] && [ -x /tmp/dbs/out/usr/sbin/debootstrap ] && \
    DEBOOTSTRAP=/tmp/dbs/out/usr/sbin/debootstrap && export DEBOOTSTRAP_DIR=/tmp/dbs/out/usr/share/debootstrap
[ -n "$DEBOOTSTRAP" ] || die "debootstrap ausente"

mkdir -p "$BUILD_DIR" "$OUT_DIR" "$PART_DIR"
cleanup(){ for m in proc sys dev/pts dev; do mountpoint -q "$RF/$m" 2>/dev/null && umount "$RF/$m" 2>/dev/null||true; done; }
trap cleanup EXIT; cleanup

# 1. Base Debian arm64
if [ ! -f "$RF/.x11-base-ok" ]; then
    log "debootstrap Debian $SUITE arm64 (base)"; rm -rf "$RF"
    "$DEBOOTSTRAP" --arch=arm64 --foreign --variant=minbase \
        --include=dbus,systemd-sysv,udev "$SUITE" "$RF" "$MIRROR"
    cp "$QEMU" "$RF/usr/bin/"
    env -u DEBOOTSTRAP_DIR chroot "$RF" /debootstrap/debootstrap --second-stage
    touch "$RF/.x11-base-ok"
else log "base já existe — pulando debootstrap"; fi
cp "$QEMU" "$RF/usr/bin/" 2>/dev/null || true

# 2. UI + launchers + serviço + Xorg fbdev + fstab
install -d "$RF/usr/share/cyberdeck-ui"
cp -a "$REPO_DIR/interface/web-vanilla/public" "$RF/usr/share/cyberdeck-ui/"
install -D -m0755 "$REPO_DIR/runtime/scripts/start-cyberdeck-x.sh" "$RF/usr/local/bin/start-cyberdeck-x.sh"
install -D -m0755 "$REPO_DIR/runtime/scripts/cyberdeck-kiosk.sh"   "$RF/usr/local/bin/cyberdeck-kiosk.sh"
install -D -m0644 "$REPO_DIR/runtime/services/cyberdeck-x.service" "$RF/etc/systemd/system/cyberdeck-x.service"
# agente de dados (Node.js) — alimenta a UI com hardware/SO/rede/logs/comandos/ações.
# Agora é modular: agent.js + lib/*.js (sem deps externas). Copia o pacote inteiro.
install -d "$RF/usr/local/lib/cyberdeck-agent"
cp -a "$REPO_DIR/cyberdeck-agent/agent.js" "$REPO_DIR/cyberdeck-agent/lib" "$RF/usr/local/lib/cyberdeck-agent/"
install -D -m0644 "$REPO_DIR/runtime/services/cyberdeck-agent.service" "$RF/etc/systemd/system/cyberdeck-agent.service"
# rede Wi-Fi via dongle USB: gerenciador + serviço (boot) + regra udev (hotplug)
install -D -m0755 "$REPO_DIR/runtime/scripts/cyberdeck-net.sh"        "$RF/usr/local/bin/cyberdeck-net.sh"
install -D -m0644 "$REPO_DIR/runtime/services/cyberdeck-net.service"  "$RF/etc/systemd/system/cyberdeck-net.service"
install -D -m0644 "$REPO_DIR/board/r36s/rootfs-overlay/etc/udev/rules.d/90-cyberdeck-wifi.rules" "$RF/etc/udev/rules.d/90-cyberdeck-wifi.rules"
# policy gerenciada do Chromium (desliga a barra de tradução de página no kiosk)
install -D -m0644 "$REPO_DIR/board/r36s/rootfs-overlay/etc/chromium/policies/managed/cyberdeck-policies.json" "$RF/etc/chromium/policies/managed/cyberdeck-policies.json"
# interface nativa (framebuffer) + seletor de boot: cross-compila e instala os 2 binários.
if command -v aarch64-linux-gnu-gcc >/dev/null 2>&1; then
    log "compilando interface/native-fb (cyberdeck-fb + cyberdeck-chooser)"
    bash "$REPO_DIR/interface/native-fb/build.sh" >/dev/null 2>&1 || log "AVISO: build da native-fb falhou"
fi
for b in cyberdeck-fb cyberdeck-chooser; do
    if [ -x "$REPO_DIR/interface/native-fb/build/$b" ]; then
        install -D -m0755 "$REPO_DIR/interface/native-fb/build/$b" "$RF/usr/local/bin/$b"
    else
        log "AVISO: binário $b ausente (sem aarch64-linux-gnu-gcc?) — interface nativa/seletor pode faltar"
    fi
done
# dispatcher de sessão: seletor de interface no boot + lança a UI escolhida (web/fb)
install -D -m0755 "$REPO_DIR/runtime/scripts/cyberdeck-session.sh"       "$RF/usr/local/bin/cyberdeck-session.sh"
install -D -m0644 "$REPO_DIR/runtime/services/cyberdeck-session.service" "$RF/etc/systemd/system/cyberdeck-session.service"
# samples de mídia (tela de TESTE A/V) -> /root/media (o usuário adiciona os dele depois)
install -d "$RF/root/media"
[ -d "$REPO_DIR/assets/av-samples" ] && cp -a "$REPO_DIR/assets/av-samples/." "$RF/root/media/" 2>/dev/null || true
mkdir -p "$RF/etc/X11/xorg.conf.d"
cat > "$RF/etc/X11/xorg.conf.d/99-fbdev.conf" <<'EOF'
Section "Device"
    Identifier "FBDEV"
    Driver     "fbdev"
    Option     "fbdev" "/dev/fb0"
EndSection
Section "Screen"
    Identifier "Screen0"
    Device     "FBDEV"
EndSection
EOF
# Analógico ESQUERDO move o ponteiro REAL do X (driver joystick do Xorg).
# Não faz EVIOCGRAB -> a Gamepad API do Chromium continua vendo o joypad p/ D-pad/A/B.
# StartKeysEnabled=false: o driver NÃO emite setas (quem navega abas é a Gamepad API).
# Eixos 1/2 = stick esquerdo (ABS_X/ABS_Y). Ajuste deadzone/axis no aparelho com evtest.
#
# SUAVIDADE/SENSIBILIDADE do ponteiro (mais fácil de controlar):
#  - deadzone grande (12000): ignora micro-movimentos/tremor perto do centro;
#  - AmplifyAxis / ConstantDeceleration desaceleram o ponteiro (servidor X aplica
#    a desaceleração ao movimento relativo). Maior ConstantDeceleration = mais lento.
#  - AccelerationProfile -1 = linear/previsível (sem aceleração que "dispara").
# Ajuste fino SEM reflashar, ao vivo:  veja docs (xinput set-prop).
cat > "$RF/etc/X11/xorg.conf.d/60-joystick.conf" <<'EOF'
Section "InputClass"
    Identifier      "cyberdeck joystick pointer"
    MatchIsJoystick "on"
    Driver          "joystick"
    Option          "StartKeysEnabled" "false"
    Option          "StartMouseEnabled" "true"
    Option          "MapAxis1" "mode=relative axis=+1x deadzone=12000"
    Option          "MapAxis2" "mode=relative axis=+1y deadzone=12000"
    # desacelera e lineariza o ponteiro (servidor X) -> movimento suave e controlável
    Option          "AccelerationProfile" "-1"
    Option          "ConstantDeceleration" "3"
    Option          "AccelerationNumerator" "1"
    Option          "AccelerationDenominator" "1"
EndSection
EOF
printf 'LABEL=ARCHR_ROOT  /  ext4  defaults,noatime  0 1\n' > "$RF/etc/fstab"
cat > "$RF/etc/os-release" <<EOF
NAME="R36S CyberDeck OS"
ID=r36s-cyberdeck-os
VERSION="0.6-bsp-x11"
PRETTY_NAME="R36S CyberDeck OS (BSP + Xorg + Chromium)"
EOF
echo r36s-cyberdeck > "$RF/etc/hostname"

# 3. Pacotes + autologin serial (ttyFIQ0) + serviço + zram
cp -f /etc/resolv.conf "$RF/etc/resolv.conf" 2>/dev/null || true
cat > "$RF/root/setup-x11.sh" <<EOF
#!/bin/sh
set -e
export DEBIAN_FRONTEND=noninteractive
export MAKEFLAGS="-j\$(nproc)" DEB_BUILD_OPTIONS="parallel=\$(nproc)"
echo "deb $MIRROR $SUITE main contrib non-free non-free-firmware" > /etc/apt/sources.list
echo "deb $MIRROR ${SUITE}-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list
# downloads paralelos
echo 'Acquire::Queue-Host::Pipeline-Depth "10"; Acquire::Languages "none";' > /etc/apt/apt.conf.d/99fast
apt-get update
# eatmydata: pula fsync do dpkg -> acelera MUITO sob qemu
apt-get install -y --no-install-recommends eatmydata
eatmydata apt-get install -y --no-install-recommends $PKGS
# autologin no console serial BSP (ttyFIQ0) p/ debug; X assume o tty1
mkdir -p /etc/systemd/system/serial-getty@ttyFIQ0.service.d
printf '[Service]\nExecStart=\nExecStart=-/sbin/agetty --autologin root --noclear %%I 115200 \$TERM\n' \
    > /etc/systemd/system/serial-getty@ttyFIQ0.service.d/autologin.conf
# entrada de UI no boot = cyberdeck-session (seletor + UI escolhida); cyberdeck-x NÃO é
# habilitado (a web é lançada pelo start-cyberdeck-x.sh chamado pela sessão).
systemctl enable cyberdeck-session.service
systemctl disable cyberdeck-x.service 2>/dev/null || true
systemctl enable cyberdeck-agent.service
systemctl enable cyberdeck-net.service
echo "root:cyberdeck" | chpasswd
# SSH: login root por senha (rede LAN do handheld). avahi -> ssh root@r36s-cyberdeck.local
systemctl enable ssh || true
systemctl enable avahi-daemon || true
mkdir -p /etc/ssh/sshd_config.d
printf 'PermitRootLogin yes\nPasswordAuthentication yes\n' > /etc/ssh/sshd_config.d/cyberdeck.conf
# Relógio: RTC do R36S não é confiável -> NTP (systemd-timesyncd) ao ter internet.
# Fuso horário BR (ajuste se necessário); timesyncd sincroniza e atualiza o RTC.
ln -sf /usr/share/zoneinfo/America/Sao_Paulo /etc/localtime
echo "America/Sao_Paulo" > /etc/timezone
systemctl enable systemd-timesyncd || true
# zram swap (alivia 1GB RAM p/ o Chromium)
echo 'ALGO=zstd\nPERCENT=60' > /etc/default/zramswap || true
# journal PERSISTENTE (sobrevive a reboot) — permite extrair logs do cartão depois
mkdir -p /var/log/journal && systemd-tmpfiles --create --prefix /var/log/journal 2>/dev/null || true
apt-get clean
EOF
chmod +x "$RF/root/setup-x11.sh"
mount -t proc none "$RF/proc"; mount -t sysfs none "$RF/sys"
mount --bind /dev "$RF/dev"; mount --bind /dev/pts "$RF/dev/pts"
log "instalando Xorg + Chromium (chroot/qemu — LENTO)"
chroot "$RF" /root/setup-x11.sh || { cleanup; die "setup-x11 falhou"; }
cleanup; rm -f "$RF/root/setup-x11.sh"
log "rootfs X11 pronto: $(du -sh "$RF"|cut -f1)"

# 3b. Módulos do kernel BSP 4.4.189 — o rootfs Debian NÃO tem /lib/modules da 4.4,
# então só drivers embutidos (=y) funcionavam. Instalar a árvore do ArkOS habilita
# os .ko carregáveis: Wi-Fi via dongle USB (RTL8188FTV/8188fu = 0bda:f179), etc.
KVER=4.4.189
MODSRC="$REPO_DIR/artifacts/arkos-reference/modules/$KVER"
[ -d "$MODSRC" ] || die "módulos $KVER ausentes: $MODSRC
     Rode antes: sudo scripts/extract-arkos-modules.sh"
log "instalando módulos $KVER ($(du -sh "$MODSRC"|cut -f1)) + depmod"
install -d "$RF/lib/modules"
rm -rf "$RF/lib/modules/$KVER"
cp -a "$MODSRC" "$RF/lib/modules/$KVER"
depmod -b "$RF" "$KVER"
# NÃO pré-carregar 8188fu no boot: o driver rockchip só vincula o dongle se o
# module_init rodar COM o dispositivo presente (igual ao autoload por udev do ArkOS;
# pré-carregar antes do plug NÃO vincula). Quem carrega é a regra udev no plug.
# Só fixamos a preferência pelo 8188fu (autocontido) sobre o rtl8188fu (precisa de fw).
printf 'blacklist rtl8188fu\n' > "$RF/etc/modprobe.d/cyberdeck-wifi.conf"
rm -f "$RF/etc/modules-load.d/cyberdeck-wifi.conf"

# 3c. Credenciais Wi-Fi -> /etc/wpa_supplicant/cyberdeck.conf (chmod 600). As
# credenciais vêm de board/r36s/wifi.conf (NÃO versionado) ou de env WIFI_SSID/WIFI_PSK.
# Sem credenciais, pula (a imagem fica sem rede pré-configurada).
WIFI_FILE="$REPO_DIR/board/r36s/wifi.conf"
[ -f "$WIFI_FILE" ] && . "$WIFI_FILE"
if [ -n "${WIFI_SSID:-}" ] && [ -n "${WIFI_PSK:-}" ]; then
    log "configurando Wi-Fi: SSID '$WIFI_SSID' (country ${WIFI_COUNTRY:-BR})"
    install -d -m0755 "$RF/etc/wpa_supplicant"
    umask 077
    cat > "$RF/etc/wpa_supplicant/cyberdeck.conf" <<EOF
# Gerado por build-x11-rootfs.sh — credenciais de Wi-Fi do CyberDeck.
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
    chmod 600 "$RF/etc/wpa_supplicant/cyberdeck.conf"
    umask 022
else
    log "SEM credenciais Wi-Fi (board/r36s/wifi.conf ausente) — imagem sem rede pré-configurada"
fi

# 3d. Chave(s) SSH autorizadas (login root sem senha). De board/r36s/authorized_keys
# (NÃO versionado; populado por scripts/ssh-setup-key-r36s.sh). Sem o arquivo, fica
# só a senha (cyberdeck).
if [ -s "$REPO_DIR/board/r36s/authorized_keys" ]; then
    log "instalando chave(s) SSH autorizada(s) em /root/.ssh/authorized_keys"
    install -d -m0700 "$RF/root/.ssh"
    install -m0600 "$REPO_DIR/board/r36s/authorized_keys" "$RF/root/.ssh/authorized_keys"
fi

# 4. ext4 (label ARCHR_ROOT) + montar imagem (clone do boot ArkOS, kernel BSP)
P2="$PART_DIR/x11-p2.ext4"
log "mke2fs ext4 ${P2_MIB}MiB (UUID=$R36S_ROOTFS_UUID)"
rm -f "$P2"; truncate -s "${P2_MIB}M" "$P2"
mke2fs -F -q -t ext4 -L ARCHR_ROOT -U "$R36S_ROOTFS_UUID" -d "$RF" "$P2"

ARKOS="$(find_arkos_img)" || die "imagem ArkOS não encontrada (Backups/ArkOS)"
p2s="$(fdisk -l "$ARKOS" 2>/dev/null | awk -v i="${ARKOS}2" '$1==i{for(c=2;c<=NF;c++) if($c~/^[0-9]+$/){print $c;exit}}')"
arkos_p1="$(fdisk -l "$ARKOS" 2>/dev/null | awk -v i="${ARKOS}1" '$1==i{for(c=2;c<=NF;c++) if($c~/^[0-9]+$/){print $c;exit}}')"
[ -n "$p2s" ] || die "p2 do ArkOS não detectada"
log "clonando boot do ArkOS (kernel BSP + DTB do painel): setores 0..$((p2s-1))"
tot=$(( p2s + P2_MIB*2048 + IMG_SLACK_SECTOR ))
rm -f "$OUT"; truncate -s $(( tot*512 )) "$OUT"
dd if="$ARKOS" of="$OUT" bs=512 count="$p2s" conv=notrunc status=none
# nosso boot.ini (root=UUID, console ttyFIQ0+tty1) na BOOT FAT do clone
MTOOLS_SKIP_CHECK=1 mdel  -i "$OUT@@$((arkos_p1*512))" ::/boot.ini 2>/dev/null || true
MTOOLS_SKIP_CHECK=1 mcopy -i "$OUT@@$((arkos_p1*512))" "$TEST_BOOT_INI" ::/boot.ini
# logo de boot CyberDeck (welcome) — substitui o logo do U-Boot e do kernel
LOGO_BMP="$REPO_DIR/board/r36s/boot/logo.bmp"
if [ -f "$LOGO_BMP" ]; then
    for L in logo.bmp logo_kernel.bmp; do
        MTOOLS_SKIP_CHECK=1 mdel  -i "$OUT@@$((arkos_p1*512))" "::/$L" 2>/dev/null || true
        MTOOLS_SKIP_CHECK=1 mcopy -i "$OUT@@$((arkos_p1*512))" "$LOGO_BMP" "::/$L"
    done
    log "logo de boot substituído (welcome) em logo.bmp + logo_kernel.bmp"
fi
dd if="$P2" of="$OUT" bs=512 seek="$p2s" conv=notrunc status=none
chown "$(stat -c '%U:%G' "$REPO_DIR")" "$OUT" 2>/dev/null || true

SHA="$(sha256sum "$OUT" | awk '{print $1}')"
"$SELF_DIR/sdcard/sd-image.sh" add x11 "$OUT" >/dev/null 2>&1 || true
log "IMAGEM PRONTA: $OUT  (sha256 $SHA)"
log "registrada como 'x11' — grave: sudo scripts/sdcard/sd-update.sh <cartao> x11"
log "No boot: Xorg+Chromium devem exibir a UI. Log em BOOT:/cyberdeck-x.log"
