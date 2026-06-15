#!/usr/bin/env bash
# sd-edit-extlinux.sh — aplica o extlinux.conf do CyberDeck (rw + boot verboso) na
# partição BOOT (p1, FAT) de um cartão AUTORIZADO. PRECISA SUDO. Não regrava a imagem.
#
# Fonte: board/r36s/boot/extlinux.conf.cyberdeck
# Faz backup do extlinux.conf atual em /extlinux/extlinux.conf.bak (uma vez).
#
# Uso: sudo scripts/sdcard/sd-edit-extlinux.sh <nome-do-cartao | /dev/sdX>
set -eu
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF/sdcard-lib.sh"
REPO_DIR="$(cd "$SELF/../.." && pwd)"
SRC="$REPO_DIR/board/r36s/boot/extlinux.conf.cyberdeck"

CARD="${1:-}"
[ -n "$CARD" ] || die "uso: sudo $0 <nome-do-cartao | /dev/sdX>"
[ "$(id -u)" -eq 0 ] || die "precisa de root: sudo $0 $CARD"
[ -f "$SRC" ] || die "template não encontrado: $SRC"
sd_resolve_device "$CARD" || exit 1
DEV="$SD_DEV"
say "Cartão '$CARD' -> $DEV"

say "===================== EDITAR EXTLINUX (BOOT) ====================="
say "AÇÃO: instalar extlinux.conf (rw + boot verboso) na partição BOOT do cartão"
sd_require_writable "$DEV"

P1="${DEV}1"; [ -b "$P1" ] || die "partição BOOT $P1 não existe (gravou a imagem mainline?)"
MNT="$(mktemp -d)"
cleanup(){ mountpoint -q "$MNT" && umount "$MNT" 2>/dev/null || true; rmdir "$MNT" 2>/dev/null || true; }
trap cleanup EXIT
mount "$P1" "$MNT" || die "falha ao montar $P1"
[ -d "$MNT/extlinux" ] || die "$P1 não parece a BOOT do Arch-R (sem /extlinux)"

if [ -f "$MNT/extlinux/extlinux.conf" ] && [ ! -f "$MNT/extlinux/extlinux.conf.bak" ]; then
    cp "$MNT/extlinux/extlinux.conf" "$MNT/extlinux/extlinux.conf.bak"
    ok "backup do original em /extlinux/extlinux.conf.bak"
fi
cp "$SRC" "$MNT/extlinux/extlinux.conf"
sync
say "Novo cmdline aplicado:"
grep -E '^\s*APPEND' "$MNT/extlinux/extlinux.conf" | sed 's/^/   /'
ok "extlinux.conf do CyberDeck instalado em $P1 ('$SD_NAME')."
say "RESULTADO: sucesso — reinsira o cartão no R36S e ligue."
