#!/usr/bin/env bash
# sd-update.sh — grava uma IMAGEM (por apelido) num CARTÃO (por nome), ambos por
# nome — sem dd, sem caminhos. PRECISA SUDO. Só grava em cartão autorizado.
#
# Lembra o último vínculo cartão->imagem: na próxima, pode omitir a imagem.
#
# Uso:
#   sudo scripts/sdcard/sd-update.sh <cartao> <imagem>   # grava e memoriza o vínculo
#   sudo scripts/sdcard/sd-update.sh <cartao>            # usa a imagem vinculada
set -eu
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/sdcard-lib.sh"

CARD="${1:-}"; IMGNAME="${2:-}"
[ -n "$CARD" ] || die "uso: sudo $0 <cartao> [<imagem>]"
[ "$(id -u)" -eq 0 ] || die "precisa de root: sudo $0 $* "

# imagem: usa o apelido dado, ou o vínculo salvo do cartão
if [ -z "$IMGNAME" ]; then
    IMGNAME="$(sd_bind_get "$CARD" || true)"
    [ -n "$IMGNAME" ] || die "cartão '$CARD' não tem imagem vinculada. Rode: sudo $0 $CARD <imagem>"
    say "usando imagem vinculada ao cartão '$CARD': '$IMGNAME'"
fi
IMGPATH="$(sd_image_path "$IMGNAME" || true)"
[ -n "$IMGPATH" ] || die "imagem '$IMGNAME' não registrada. Veja: scripts/sdcard/sd-image.sh list"
[ -f "$IMGPATH" ] || die "arquivo da imagem '$IMGNAME' sumiu: $IMGPATH"

sd_resolve_device "$CARD" || exit 1
DEV="$SD_DEV"

say "========================== ATUALIZAR SD =========================="
say "CARTÃO : $CARD  ->  $DEV"
say "IMAGEM : $IMGNAME  ->  $IMGPATH"
say "  tamanho: $(sd_human_size "$(stat -c %s "$IMGPATH")")  | sha256: $(sha256sum "$IMGPATH" | cut -d' ' -f1)"
sd_require_writable "$DEV"

sd_bind_set "$CARD" "$IMGNAME"     # memoriza p/ próxima
say "Gravando '$IMGNAME' -> $DEV ('$SD_NAME') ..."
sd_flash_image "$DEV" "$IMGPATH"
ok "ATUALIZADO: cartão '$CARD' agora tem a imagem '$IMGNAME'. Pode inserir no R36S."
say "RESULTADO: sucesso  (próxima vez: sudo $0 $CARD)"
