#!/usr/bin/env bash
# deploy-r36s.sh — atualiza o R36S CyberDeck via SSH (sem tirar o cartão).
# Sincroniza UI, agente, scripts, serviços e a regra udev para o aparelho e
# reinicia os serviços. Usa tar-sobre-ssh (não exige rsync no device).
#
# Uso:
#   scripts/deploy-r36s.sh [ip|host] [componente] [--reboot]
#     host       : default r36s-cyberdeck.local (ou IP da aba NET)
#     componente : all (default) | ui | agent | fb | scripts | services | net
#     --reboot   : reinicia o aparelho ao final (reboot em background, fecha o SSH limpo)
#
# Senha root: cyberdeck. Ignora known_hosts (host key muda a cada reflash).
set -eu
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SELF/.." && pwd)"

REBOOT=0; POS=()
for a in "$@"; do
  case "$a" in
    --reboot) REBOOT=1 ;;
    *) POS+=("$a") ;;
  esac
done
HOST="${POS[0]:-r36s-cyberdeck.local}"
WHAT="${POS[1]:-all}"

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
NEED_AGENT=0; NEED_UI=0; NEED_NET=0; NEED_UDEV=0; NEED_SVC=0; NEED_FB=0

if want ui; then
  log "UI -> /usr/share/cyberdeck-ui/public"
  DST="/usr/share/cyberdeck-ui"; push "$REPO/interface/web-vanilla" public
  # policy gerenciada do Chromium (desliga a barra de tradução de página no kiosk)
  log "policy chromium -> /etc/chromium/policies/managed"
  sshd "mkdir -p /etc/chromium/policies/managed"
  scp $SSH_OPTS "$REPO/board/r36s/rootfs-overlay/etc/chromium/policies/managed/cyberdeck-policies.json" \
      "root@$HOST:/etc/chromium/policies/managed/cyberdeck-policies.json" >/dev/null
  NEED_UI=1
fi
if want react; then
  # interface web-react: bundle Webpack (build no host) -> /usr/share/cyberdeck-web-react
  if [ ! -f "$REPO/interface/web-react/dist/index.html" ] && command -v npm >/dev/null 2>&1; then
    log "web-react -> buildando (npm run build)"
    ( cd "$REPO/interface/web-react" && ./build.sh ) >/dev/null 2>&1 || true
  fi
  if [ -f "$REPO/interface/web-react/dist/index.html" ]; then
    log "web-react -> /usr/share/cyberdeck-web-react"
    DST="/usr/share/cyberdeck-web-react"; push "$REPO/interface/web-react/dist" .
    NEED_UI=1
  else
    die "interface/web-react/dist ausente — rode (cd interface/web-react && ./build.sh) primeiro"
  fi
fi
if want fb; then
  # interface nativa + seletor de boot: binários aarch64 estáticos (cross-compila e empurra).
  FB_BIN="$REPO/interface/native-fb/build/cyberdeck-fb"
  CH_BIN="$REPO/interface/native-fb/build/cyberdeck-chooser"
  if { [ ! -x "$FB_BIN" ] || [ ! -x "$CH_BIN" ]; } && command -v aarch64-linux-gnu-gcc >/dev/null 2>&1; then
    log "native-fb -> compilando (aarch64 static)"
    bash "$REPO/interface/native-fb/build.sh" >/dev/null 2>&1 || true
  fi
  pushed=0
  for b in cyberdeck-fb cyberdeck-chooser; do
    src="$REPO/interface/native-fb/build/$b"
    if [ -x "$src" ]; then
      log "native-fb -> /usr/local/bin/$b"
      scp $SSH_OPTS "$src" "root@$HOST:/usr/local/bin/$b.new" >/dev/null
      sshd "chmod +x /usr/local/bin/$b.new && mv -f /usr/local/bin/$b.new /usr/local/bin/$b"
      pushed=1
    fi
  done
  [ "$pushed" = 1 ] && NEED_FB=1 || log "AVISO: binários nativos ausentes (sem aarch64-linux-gnu-gcc?) — pulei o componente fb"
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
  log "regras udev -> /etc/udev/rules.d (wifi + 2º cartão)"
  scp $SSH_OPTS "$REPO/board/r36s/rootfs-overlay/etc/udev/rules.d/90-cyberdeck-wifi.rules" \
      "root@$HOST:/etc/udev/rules.d/90-cyberdeck-wifi.rules" >/dev/null
  scp $SSH_OPTS "$REPO/board/r36s/rootfs-overlay/etc/udev/rules.d/91-cyberdeck-sdcard.rules" \
      "root@$HOST:/etc/udev/rules.d/91-cyberdeck-sdcard.rules" >/dev/null
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
  # UI (web) e/ou native-fb: a entrada de boot é o cyberdeck-session (seletor + UI).
  # Reiniciá-lo recarrega a interface ativa (mostra o seletor por ~6s e relança a pref).
  { [ "$NEED_UI" = 1 ] || [ "$NEED_FB" = 1 ]; } && echo "systemctl restart cyberdeck-session 2>/dev/null || true"
  echo "echo OK"
} | sshd "bash -s"

[ "$NEED_NET" = 1 ] && log "obs: net.sh/serviço/udev atualizados no disco — valem no próximo boot/plug (não reiniciei p/ não cair o SSH)."
log "deploy concluído em $HOST ($WHAT)."

if [ "$REBOOT" = 1 ]; then
  log "reiniciando $HOST (reboot em background p/ a sessão SSH fechar limpa)…"
  sshd "sync; (sleep 1 && reboot) >/dev/null 2>&1 &" || true
fi
