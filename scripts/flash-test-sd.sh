#!/usr/bin/env bash
#
# flash-test-sd.sh
# ----------------
# (PLANEJAMENTO / placeholder) Gravará a imagem do CyberDeck OS num SD para teste
# no R36S físico. Por segurança, nesta fase apenas VALIDA argumentos e imprime o
# comando que SERIA executado — não grava nada.
#
# Uso (futuro):
#   sudo scripts/flash-test-sd.sh /dev/sdX path/para/cyberdeck-os.img
#
set -eu

log()  { echo "[flash] $*"; }
die()  { echo "[flash][ERRO] $*" >&2; exit 1; }

DEV="${1:-}"
IMG="${2:-}"

[ -n "$DEV" ] && [ -n "$IMG" ] || die "Uso: sudo $0 /dev/sdX caminho/imagem.img"
[ -b "$DEV" ] || die "Não é um dispositivo de bloco: $DEV"
[ -f "$IMG" ] || die "Imagem não encontrada: $IMG"

# Proteção: recusa discos grandes demais (provável HD do sistema)
size_bytes="$(blockdev --getsize64 "$DEV" 2>/dev/null || echo 0)"
if [ "$size_bytes" -gt $((128*1024*1024*1024)) ]; then
    die "ABORTADO: $DEV tem >128GB — improvável ser um SD do R36S. Confirme manualmente."
fi

cat <<EOF
[flash] MODO DRY-RUN (segurança). Comando que SERIA executado:

    sudo dd if='$IMG' of='$DEV' bs=4M conv=fsync status=progress
    sync

Para habilitar de fato, edite este script e remova o dry-run, OU grave manualmente
após confirmar o dispositivo com 'lsblk'. NUNCA aponte para o disco do sistema.
EOF
