#!/usr/bin/env bash
# sd-flash.sh — grava uma imagem .img num cartão AUTORIZADO (dd seguro). PRECISA SUDO.
# Recusa cartão não-autorizado ou que falhe nas checagens de segurança.
#
# Uso: sudo scripts/sdcard/sd-flash.sh <nome-do-cartao | /dev/sdX> caminho/imagem.img
set -eu
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/sdcard-lib.sh"

CARD="${1:-}"; IMG="${2:-}"
[ -n "$CARD" ] && [ -n "$IMG" ] || die "uso: sudo $0 <nome-do-cartao | /dev/sdX> imagem.img"
[ "$(id -u)" -eq 0 ] || die "precisa de root: sudo $0 $CARD $IMG"
[ -f "$IMG" ] || die "imagem não encontrada: $IMG"
sd_resolve_device "$CARD" || exit 1
DEV="$SD_DEV"
say "Cartão '$CARD' -> $DEV"

say "============================ GRAVAR SD ============================"
say "AÇÃO  : gravar imagem no cartão (dd, apaga todo o conteúdo do cartão)"
say "IMAGEM: $IMG"
say "  tamanho: $(sd_human_size "$(stat -c %s "$IMG")")"
say "  sha256 : $(sha256sum "$IMG" | cut -d' ' -f1)"
sd_require_writable "$DEV"

# desmonta partições do cartão (se o automount montou)
for p in $(lsblk -nro NAME "$DEV" | tail -n +2); do umount "/dev/$p" 2>/dev/null || true; done

say "Gravando $IMG -> $DEV ..."
dd if="$IMG" of="$DEV" bs=4M conv=fsync status=progress
sync
ok "GRAVAÇÃO CONCLUÍDA em $DEV ('$SD_NAME'). Pode inserir no R36S."
say "RESULTADO: sucesso"
