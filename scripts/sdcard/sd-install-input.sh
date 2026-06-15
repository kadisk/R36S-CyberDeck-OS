#!/usr/bin/env bash
# sd-install-input.sh — instala a PONTE DE INPUT (joypad->teclado) num cartão JÁ
# gravado com a imagem x11, SEM precisar regravar os 4GB. Monta a rootfs (p2),
# copia /usr/local/bin/cyberdeck-input + o serviço, habilita e carrega uinput no boot.
# PRECISA SUDO. Não regrava a imagem.
#
# Uso: sudo scripts/sdcard/sd-install-input.sh <nome-do-cartao | /dev/sdX>
set -eu
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF/sdcard-lib.sh"
REPO="$(cd "$SELF/../.." && pwd)"
BIN="$REPO/cyberdeck-input/cyberdeck-input"
SVC="$REPO/runtime/services/cyberdeck-input.service"

CARD="${1:-}"
[ -n "$CARD" ] || die "uso: sudo $0 <nome-do-cartao | /dev/sdX>"
[ "$(id -u)" -eq 0 ] || die "precisa de root: sudo $0 $CARD"

# garante binário compilado
if [ ! -f "$BIN" ]; then
    say "binário não existe — compilando (aarch64 estático)..."
    ( cd "$REPO/cyberdeck-input" && ./build.sh ) || die "falha ao compilar cyberdeck-input"
fi
[ -f "$SVC" ] || die "serviço não encontrado: $SVC"

sd_resolve_device "$CARD" || exit 1
DEV="$SD_DEV"; P2="${DEV}2"
[ -b "$P2" ] || die "partição rootfs $P2 não existe"

say "============== INSTALAR PONTE DE INPUT (joypad->teclado) ============="
say "Cartão '$CARD' -> $DEV  (rootfs $P2)"
sd_require_writable "$DEV"

MNT="$(mktemp -d)"; trap 'mountpoint -q "$MNT" && umount "$MNT"; rmdir "$MNT" 2>/dev/null||true' EXIT
mount "$P2" "$MNT" || die "falha ao montar $P2"
[ -d "$MNT/etc/systemd/system" ] || die "$P2 não parece a rootfs Debian (sem /etc/systemd)"

install -D -m0755 "$BIN" "$MNT/usr/local/bin/cyberdeck-input"
install -D -m0644 "$SVC" "$MNT/etc/systemd/system/cyberdeck-input.service"
# habilita (symlink WantedBy=multi-user.target) sem precisar de systemctl no host
install -d "$MNT/etc/systemd/system/multi-user.target.wants"
ln -sf ../cyberdeck-input.service \
    "$MNT/etc/systemd/system/multi-user.target.wants/cyberdeck-input.service"
# uinput no boot
install -d "$MNT/etc/modules-load.d"
echo uinput > "$MNT/etc/modules-load.d/uinput.conf"
sync

ok "Ponte de input instalada e habilitada em '$SD_NAME' ($P2)."
say "Mapa: D-pad=setas, A=Enter, B=Esc, X=Tab, Y=Backspace, L1/R1=PageUp/Down."
say "RESULTADO: reinsira no R36S, ligue normal. A UI deve navegar PELOS BOTÕES."
say "Debug (no serial): journalctl -u cyberdeck-input -b"
