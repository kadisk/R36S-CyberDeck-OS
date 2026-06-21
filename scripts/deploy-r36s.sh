#!/usr/bin/env bash
# deploy-r36s.sh — atualiza o R36S CyberDeck via SSH (sem tirar o cartão).
# Sincroniza UI, agente, scripts, serviços e a regra udev para o aparelho e
# reinicia os serviços. Usa tar-sobre-ssh (não exige rsync no device).
#
# Uso:
#   scripts/deploy-r36s.sh [ip|host] [componente]
#     host       : default r36s-cyberdeck.local (ou IP da aba NET)
#     componente : all (default) | ui | agent | scripts | services | net
#
# Senha root: cyberdeck. Ignora known_hosts (host key muda a cada reflash).
set -eu
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SELF/.." && pwd)"

HOST="${1:-r36s-cyberdeck.local}"
WHAT="${2:-all}"

# ControlMaster: reaproveita UMA conexão p/ todas as chamadas -> pede senha só 1x
# por deploy (e 0x se a chave estiver instalada, ver scripts/ssh-setup-key-r36s.sh).
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR \
-o ConnectTimeout=8 -o ControlMaster=auto -o ControlPath=$HOME/.ssh/cm-%C -o ControlPersist=120"
sshd() { ssh $SSH_OPTS "root@$HOST" "$@"; }
# fecha o canal multiplexado ao sair
cleanup_cm() { ssh $SSH_OPTS -O exit "root@$HOST" 2>/dev/null || true; }
trap cleanup_cm EXIT
# envia um diretório (conteúdo) p/ um destino no aparelho, via tar
push() { # $1=dir-fonte (cwd do tar)  $2=itens...  e usa $DST
  tar -C "$1" -cf - "${@:2}" | sshd "mkdir -p '$DST' && tar -C '$DST' -xf -"
}

log() { echo "[deploy] $*"; }
die() { echo "[deploy][ERRO] $*" >&2; exit 1; }

# 1) conectividade
sshd true 2>/dev/null || die "não conectou em root@$HOST (aparelho ligado? IP certo? senha?)"
log "conectado em $HOST — enviando: $WHAT"

want() { [ "$WHAT" = "all" ] || [ "$WHAT" = "$1" ]; }
NEED_AGENT=0; NEED_UI=0; NEED_NET=0; NEED_UDEV=0; NEED_SVC=0

if want ui; then
  log "UI -> /usr/share/cyberdeck-ui/public"
  DST="/usr/share/cyberdeck-ui"; push "$REPO/cyberdeck-ui" public
  NEED_UI=1
fi
if want agent; then
  log "agente -> /usr/local/lib/cyberdeck-agent"
  DST="/usr/local/lib/cyberdeck-agent"; push "$REPO/cyberdeck-agent" agent.js lib
  NEED_AGENT=1
fi
if want scripts || want net; then
  log "scripts -> /usr/local/bin"
  DST="/usr/local/bin"; push "$REPO/runtime/scripts" .
  sshd "chmod +x /usr/local/bin/*.sh 2>/dev/null || true"
  NEED_NET=1
fi
if want services || want net; then
  log "serviços -> /etc/systemd/system"
  DST="/etc/systemd/system"; push "$REPO/runtime/services" .
  NEED_SVC=1
fi
if want net || want all; then
  log "regra udev -> /etc/udev/rules.d"
  scp $SSH_OPTS "$REPO/board/r36s/rootfs-overlay/etc/udev/rules.d/90-cyberdeck-wifi.rules" \
      "root@$HOST:/etc/udev/rules.d/90-cyberdeck-wifi.rules" >/dev/null
  NEED_UDEV=1
fi

# 2) recarrega/reinicia o que mudou.
# IMPORTANTE: NÃO reiniciamos o cyberdeck-net aqui — ele recarrega o módulo Wi-Fi e
# DERRUBARIA esta própria sessão SSH. O net.sh/serviço/udev novos ficam no disco e
# valem no próximo boot/plug do dongle (ou aplique manualmente, ciente da queda).
log "recarregando e reiniciando serviços (sem mexer no Wi-Fi p/ não cair o SSH)"
{
  [ "$NEED_SVC" = 1 ]  && echo "systemctl daemon-reload"
  [ "$NEED_UDEV" = 1 ] && echo "udevadm control --reload-rules 2>/dev/null || true"
  [ "$NEED_AGENT" = 1 ] && echo "systemctl restart cyberdeck-agent 2>/dev/null || true"
  [ "$NEED_UI" = 1 ]   && echo "systemctl restart cyberdeck-x 2>/dev/null || true"
  echo "echo OK"
} | sshd "bash -s"

[ "$NEED_NET" = 1 ] && log "obs: net.sh/serviço/udev atualizados no disco — valem no próximo boot/plug (não reiniciei p/ não cair o SSH)."
log "deploy concluído em $HOST ($WHAT)."
