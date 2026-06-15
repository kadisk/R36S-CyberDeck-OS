#!/usr/bin/env bash
#
# print-flash-command.sh
# ----------------------
# Imprime o comando `dd` recomendado para gravar a imagem de teste num microSD.
# NÃO grava nada. NÃO escreve em /dev/sdX. Apenas mostra o comando e listas de
# referência (lsblk) para VOCÊ identificar o cartão certo manualmente.
#
set -eu
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/phase2-config.sh"

log()  { echo "[flash-cmd] $*"; }

if [ ! -f "$OUT_IMG" ]; then
    log "Imagem ainda não gerada: $OUT_IMG"
    log "Gere primeiro:  scripts/create-test-sd-image.sh"
    exit 1
fi

SZ="$(stat -c '%s' "$OUT_IMG")"
SHA="$(sha256sum "$OUT_IMG" | awk '{print $1}')"

cat <<EOF

================================================================
 R36S CyberDeck OS — gravação do cartão de TESTE (Fase 2)
================================================================
 Imagem : $OUT_IMG
 Tamanho: $SZ bytes ($(( SZ / 1024 / 1024 )) MiB)
 sha256 : $SHA

 ⚠️  REGRAS DE SEGURANÇA (leia antes):
   - Use um microSD SEPARADO, dedicado ao teste.
   - NUNCA grave no cartão ArkOS original (mantenha-o como referência).
   - Confirme o dispositivo do SD com 'lsblk' — gravar no disco errado
     APAGA dados. /dev/sdX abaixo é um EXEMPLO, troque pelo seu.

 Discos atualmente visíveis (apenas referência — NÃO gravando):
EOF

if command -v lsblk >/dev/null; then
    lsblk -o NAME,SIZE,TYPE,RM,MOUNTPOINT,MODEL 2>/dev/null | sed 's/^/   /'
else
    echo "   (lsblk indisponível)"
fi

cat <<EOF

 Comando de gravação RECOMENDADO (rode VOCÊ, trocando /dev/sdX):

   sudo dd if=$OUT_IMG of=/dev/sdX bs=4M status=progress conv=fsync
   sync

 Depois:
   - Insira o microSD no SLOT de boot do R36S (o mesmo do cartão de SO).
   - Ligue e observe o serial /dev/ttyFIQ0 e/ou a tela.
   - Checklist: docs/testing/phase2-boot-checklist.md
   - Rollback : docs/boot/sd-card-test-layout.md (seção Rollback)

 Este script NÃO gravou em nenhum dispositivo.
================================================================
EOF
