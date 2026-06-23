#!/usr/bin/env bash
# update-r36s.sh — ATUALIZA O R36S CYBERDECK POR COMPLETO via SSH e REINICIA,
# esperando o aparelho voltar e verificando que subiu. O objetivo é tornar a
# regravação do cartão um ÚLTIMO RECURSO: quase tudo se atualiza a quente por SSH.
#
# O que ESTE script faz (chama scripts/deploy-r36s.sh por baixo):
#   - empurra UI web, agente Node, scripts de runtime, serviços systemd, regra udev
#     e o binário native-fb (cross-compilado, se houver toolchain);
#   - reinicia o aparelho e ESPERA ele voltar (SSH de novo de pé);
#   - confere os serviços (cyberdeck-agent / cyberdeck-x) e imprime no fim
#     O QUE AINDA EXIGE REGRAVAR O CARTÃO.
#
# Uso:
#   scripts/update-r36s.sh [ip|host] [--no-reboot] [--no-wait] [--timeout SEG]
#     host        : default r36s-cyberdeck.local (ou IP da aba NET)
#     --no-reboot : só atualiza (não reinicia) — equivale a deploy-r36s.sh all
#     --no-wait   : reinicia mas não espera voltar
#     --timeout N : segundos a esperar o aparelho voltar (default 180)
#
# Senha root: cyberdeck (instale a chave com scripts/ssh-setup-key-r36s.sh p/ não pedir).
set -eu
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY="$SELF/deploy-r36s.sh"

REBOOT=1; WAIT=1; TIMEOUT=180; HOST="r36s-cyberdeck.local"
while [ $# -gt 0 ]; do
  case "$1" in
    --no-reboot) REBOOT=0 ;;
    --no-wait)   WAIT=0 ;;
    --timeout)   shift; TIMEOUT="${1:?--timeout precisa de um número}" ;;
    -*)          echo "[update][ERRO] opção desconhecida: $1" >&2; exit 2 ;;
    *)           HOST="$1" ;;
  esac
  shift
done

SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR \
-o ConnectTimeout=6"
sshd() { ssh $SSH_OPTS "root@$HOST" "$@"; }

log() { echo "[update] $*"; }
die() { echo "[update][ERRO] $*" >&2; exit 1; }

# 1) atualiza tudo a quente (sem reboot aqui — o reboot/espera é controlado abaixo).
log "atualizando todos os componentes em $HOST…"
"$DEPLOY" "$HOST" all

if [ "$REBOOT" = 0 ]; then
  log "concluído (sem reiniciar, --no-reboot)."
  exit 0
fi

# 2) reinicia (reboot em background p/ a sessão SSH fechar limpa).
log "reiniciando $HOST…"
sshd "sync; (sleep 1 && reboot) >/dev/null 2>&1 &" || true

if [ "$WAIT" = 0 ]; then
  log "reinício disparado (não esperei voltar, --no-wait)."
  exit 0
fi

# 3) espera o aparelho voltar. Dá um tempo p/ ele realmente cair antes de sondar.
log "esperando $HOST voltar (timeout ${TIMEOUT}s)…"
sleep 10
deadline=$(( $(date +%s) + TIMEOUT ))
until sshd true 2>/dev/null; do
  if [ "$(date +%s)" -ge "$deadline" ]; then
    die "o aparelho não voltou em ${TIMEOUT}s. Confira energia/rede; se não responder, aí sim regrave o cartão."
  fi
  sleep 4
done
log "$HOST está de volta."

# 4) verifica que os serviços subiram (best-effort; nem toda imagem tem os dois).
for unit in cyberdeck-agent cyberdeck-x; do
  st="$(sshd "systemctl is-active $unit 2>/dev/null" 2>/dev/null || true)"
  [ -n "$st" ] && log "serviço $unit: $st"
done

cat <<'EOF'

[update] OK — atualização a quente concluída.

O QUE ESTE FLUXO **NÃO** ATUALIZA (ainda exige regravar o cartão — último recurso):
  • região de boot / U-Boot e kernel BSP 4.4 (clonados do ArkOS na gravação);
  • DTB do painel (overlay/dtb) — troca de painel/lote;
  • layout de partições da imagem (tamanho/ordem das partições);
  • troca da base do rootfs (debootstrap) ou pacotes apt novos no build.
Para esses casos: rebuild (scripts/build-x11-rootfs.sh) + gravação (scripts/sdcard/sd-update.sh).
EOF
