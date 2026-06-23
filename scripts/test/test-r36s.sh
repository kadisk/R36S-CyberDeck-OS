#!/usr/bin/env bash
# test-r36s.sh — dispara a bateria de teste de UI no R36S e coleta os artefatos.
# Compila o gamepad virtual (cdpad), empurra cdpad + run-ui-tests.sh, roda o runner
# DETACHED no aparelho (resistente a queda do Wi-Fi do dongle), faz poll até terminar
# e baixa /root/uitest/ (report.txt + screenshots) p/ artifacts/uitest/. Imprime o resumo.
#
# Uso: scripts/test/test-r36s.sh [ip|host]   (default r36s-cyberdeck.local)
set -eu
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SELF/../.." && pwd)"
HOST="${1:-r36s-cyberdeck.local}"
OUT="$REPO/artifacts/uitest"
CC="${CC:-aarch64-linux-gnu-gcc}"
SSH_OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ConnectTimeout=8"
sshd(){ ssh $SSH_OPTS "root@$HOST" "$@"; }
log(){ echo "[uitest] $*"; }
die(){ echo "[uitest][ERRO] $*" >&2; exit 1; }

command -v "$CC" >/dev/null || die "cross-compiler ausente: $CC (apt install gcc-aarch64-linux-gnu)"
log "compilando cdpad (gamepad virtual, aarch64)"
"$CC" -O2 -static -Wall -Wno-misleading-indentation -o "$SELF/cdpad" "$SELF/cdpad.c"

wait_online(){ for i in $(seq 1 24); do sshd true 2>/dev/null && return 0; sleep 5; done; return 1; }
log "aguardando $HOST…"; wait_online || die "não conectou em $HOST"

log "empurrando cdpad + runner"
scp $SSH_OPTS "$SELF/cdpad" "root@$HOST:/tmp/cdpad" >/dev/null
scp $SSH_OPTS "$SELF/run-ui-tests.sh" "root@$HOST:/tmp/run-ui-tests.sh" >/dev/null
sshd "chmod +x /tmp/cdpad /tmp/run-ui-tests.sh; rm -rf /root/uitest"

log "disparando a bateria (detached no aparelho)…"
sshd "nohup /tmp/run-ui-tests.sh >/dev/null 2>&1 & echo pid \$!"

log "aguardando terminar (poll por DONE)…"
done=0
for i in $(seq 1 40); do
  sleep 6
  if sshd "grep -q DONE /root/uitest/report.txt 2>/dev/null"; then done=1; break; fi
done
[ "$done" = 1 ] || log "aviso: não vi DONE em ~4 min — coletando o que houver"

log "baixando artefatos p/ $OUT"
mkdir -p "$OUT"; rm -f "$OUT"/*.png "$OUT/report.txt" 2>/dev/null || true
scp $SSH_OPTS "root@$HOST:/root/uitest/report.txt" "$OUT/report.txt" >/dev/null 2>&1 || true
scp $SSH_OPTS "root@$HOST:/root/uitest/*.png" "$OUT/" >/dev/null 2>&1 || true

echo; echo "================= RESUMO ================="
grep -E 'RESUMO|FAIL|AGENT FAIL|SHOT  FAIL|DISTINCT|seletor|pref após' "$OUT/report.txt" 2>/dev/null || cat "$OUT/report.txt" 2>/dev/null || echo "(sem report)"
echo "screenshots: $(ls "$OUT"/*.png 2>/dev/null | wc -l) em $OUT"
echo "report completo: $OUT/report.txt"
