#!/usr/bin/env bash
# sd-grab-panel-overlay.sh — copia o overlay de painel gerado pelo wizard do Arch-R
# (/overlays/mipi-panel.dtbo, na partição BOOT) para o nosso repo, para reaproveitar
# na imagem mainline do CyberDeck. PRECISA SUDO (monta a BOOT, somente leitura).
#
# Rode DEPOIS de bootar o Arch-R original no R36S (a tela dele tem que ter funcionado).
#
# Uso: sudo scripts/sdcard/sd-grab-panel-overlay.sh <nome-do-cartao | /dev/sdX>
set -eu
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF/sdcard-lib.sh"
REPO="$(cd "$SELF/../.." && pwd)"
DEST="$REPO/artifacts/mainline/panel/mipi-panel.dtbo"

CARD="${1:-}"
[ -n "$CARD" ] || die "uso: sudo $0 <nome-do-cartao | /dev/sdX>"
[ "$(id -u)" -eq 0 ] || die "precisa de root: sudo $0 $CARD"
sd_resolve_device "$CARD" || exit 1
DEV="$SD_DEV"; P1="${DEV}1"
[ -b "$P1" ] || die "partição BOOT $P1 não existe"

say "=============== EXTRAIR OVERLAY DE PAINEL (Arch-R) ==============="
say "Cartão '$CARD' -> $DEV"
mkdir -p "$(dirname "$DEST")"
MNT="$(mktemp -d)"; trap 'mountpoint -q "$MNT" && umount "$MNT"; rmdir "$MNT" 2>/dev/null||true' EXIT
mount -o ro "$P1" "$MNT" || die "falha ao montar $P1 (ro)"

say "Overlays presentes na BOOT:"
ls -la "$MNT/overlays/" 2>/dev/null | grep -iE 'mipi-panel|\.dtbo' | sed 's/^/   /' | head
SRC="$MNT/overlays/mipi-panel.dtbo"
if [ ! -f "$SRC" ]; then
    err "/overlays/mipi-panel.dtbo NÃO existe — o wizard do Arch-R ainda não gerou."
    say "Boote o Arch-R original no R36S (até a UI dele aparecer) e rode de novo."
    exit 1
fi
cp "$SRC" "$DEST"
chown "$(stat -c '%U:%G' "$REPO")" "$DEST" 2>/dev/null || true
ok "overlay copiado -> $DEST ($(stat -c %s "$DEST") bytes)"
# mostra qual painel/timing (se decodificável)
if command -v dtc >/dev/null; then
    say "Conteúdo (resumo):"
    dtc -I dtb -O dts "$DEST" 2>/dev/null | grep -iE 'compatible|panel_description|clock=' | head -3 | sed 's/^/   /'
fi
say "RESULTADO: sucesso — agora rebuildo a imagem mainline com este overlay."
