#!/usr/bin/env bash
# sd-get-screenshots.sh — copia os SCREENSHOTS do CyberDeck (salvos em
# /root/screenshots no cartão) para o host, pelo NOME do cartão. Monta a rootfs
# (p2) em READ-ONLY — não escreve nada no cartão. PRECISA SUDO (montar).
#
# Uso:
#   sudo scripts/sdcard/sd-get-screenshots.sh <nome-do-cartao | /dev/sdX> [destino]
#
# destino: pasta no host (default: artifacts/screenshots/<cartao>/). Os arquivos
# já existentes no destino são preservados (cópia incremental por nome).
set -eu
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF/sdcard-lib.sh"
REPO="$(cd "$SELF/../.." && pwd)"

CARD="${1:-}"
DEST="${2:-}"
[ -n "$CARD" ] || die "uso: sudo $0 <nome-do-cartao | /dev/sdX> [destino]"
[ "$(id -u)" -eq 0 ] || die "precisa de root (para montar): sudo $0 $CARD"

sd_resolve_device "$CARD" || exit 1
DEV="$SD_DEV"; P2="${DEV}2"
[ -b "$P2" ] || die "partição rootfs $P2 não existe"

# sd_describe popula SD_NAME (e mostra o bloco do cartão); fallback p/ o arg passado
sd_describe "$DEV"
NAME="${SD_NAME:-$CARD}"

# destino padrão: FORA do repositório (home do usuário, não em artifacts/ — capturas
# não devem entrar no git). Resolve a home do usuário real mesmo rodando sob sudo.
USER_HOME="$(eval echo ~"${SUDO_USER:-$USER}")"
if [ -n "$DEST" ]; then OWN_DIR="$DEST"; else DEST="$USER_HOME/cyberdeck-screenshots/$NAME"; OWN_DIR="$USER_HOME/cyberdeck-screenshots"; fi

say "================= RECUPERAR SCREENSHOTS (read-only) ================="
say "Cartão '$CARD' -> $DEV  (rootfs $P2, montado RO)"
say "Destino: $DEST"

MNT="$(mktemp -d)"; trap 'mountpoint -q "$MNT" && umount "$MNT"; rmdir "$MNT" 2>/dev/null||true' EXIT
mount -o ro "$P2" "$MNT" || die "falha ao montar $P2 (read-only)"

SRC="$MNT/root/screenshots"
[ -d "$SRC" ] || die "nenhuma pasta de screenshots no cartão ($SRC). Tire um print no aparelho (L1+R1)."

COUNT="$(find "$SRC" -maxdepth 1 -type f -name '*.png' | wc -l)"
[ "$COUNT" -gt 0 ] || die "a pasta existe mas está vazia ($SRC)."

mkdir -p "$DEST"
# cópia preservando timestamps; não apaga o que já houver no destino
cp -a -n "$SRC"/*.png "$DEST"/ 2>/dev/null || cp -a "$SRC"/*.png "$DEST"/
# arquivos/pastas foram criados como root (sudo) — devolve a posse ao usuário real
# (árvore inteira, incluindo a pasta base, com o grupo primário correto do usuário).
if [ -n "${SUDO_USER:-}" ]; then
    GRP="$(id -gn "$SUDO_USER" 2>/dev/null || echo "$SUDO_USER")"
    chown -R "$SUDO_USER:$GRP" "$OWN_DIR" || warn "não consegui ajustar o dono de $OWN_DIR"
fi
sync

ok "$COUNT screenshot(s) copiados de '$NAME' para: $DEST"
say "Mais recentes:"
ls -1t "$DEST"/*.png 2>/dev/null | head -n 5 | sed 's/^/   /'
say "RESULTADO: sucesso (cartão não foi modificado — montado read-only)."
