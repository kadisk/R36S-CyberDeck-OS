#!/bin/bash
# run-ui-tests.sh — bateria de teste de UI do CyberDeck OS, RODA NO APARELHO.
# Finge ser o gamepad (via /tmp/cdpad + uinput): escolhe a native-fb no SELETOR de
# boot e percorre TODAS as telas, capturando cada uma (fbgrab) e disparando só ações
# SEGURAS. Faz smoke das rotas do agente. Resultado em /root/uitest/ (report.txt +
# PNGs). NÃO dispara ações destrutivas. Religa a sessão normal no fim.
#
# Pré: /tmp/cdpad (gamepad virtual) e fbgrab+netpbm presentes. Disparado pelo host
# (scripts/test/test-r36s.sh) de forma detached — resistente a queda de Wi-Fi.
set -u
OUT=/root/uitest
PAD=/usr/local/bin/cyberdeck-fb
CHOOSER=/usr/local/bin/cyberdeck-chooser
FIFO=/tmp/cdpad.fifo
REPORT="$OUT/report.txt"
N=0; PASS=0; FAIL=0

rm -rf "$OUT"; mkdir -p "$OUT"
exec >"$REPORT" 2>&1
echo "===== CyberDeck UI test battery  $(date) ====="
ckpad(){ [ -x /tmp/cdpad ] || { echo "FATAL: /tmp/cdpad ausente"; exit 1; }; }
ckpad
command -v fbgrab >/dev/null || { echo "FATAL: fbgrab ausente"; exit 1; }

# ---- gamepad virtual via FIFO (criado ANTES do chooser/fb) ----
rm -f "$FIFO"; mkfifo "$FIFO"
/tmp/cdpad < "$FIFO" &
CDPAD=$!
exec 3>"$FIFO"          # mantém o FIFO aberto p/ escrita
sleep 1
tap(){ for t in "$@"; do echo "$t" >&3; sleep 0.35; done; }
combo(){ echo "COMBO $1 $2" >&3; sleep 0.6; }
shot(){ N=$((N+1)); local f; f="$(printf '%s/%02d-%s.png' "$OUT" "$N" "$1")"; sleep 0.5
  if fbgrab "$f" >/dev/null 2>&1 && [ -s "$f" ]; then echo "SHOT  ok  $f ($(stat -c%s "$f")B)"; PASS=$((PASS+1)); else echo "SHOT  FAIL $f"; FAIL=$((FAIL+1)); fi; }

echo "--- parando sessão e matando resíduos ---"
systemctl stop cyberdeck-session 2>/dev/null
pkill -9 chromium 2>/dev/null; pkill -9 Xorg 2>/dev/null; pkill cyberdeck-fb 2>/dev/null; pkill cyberdeck-chooser 2>/dev/null
sleep 2

# ===== 1) SELETOR DE BOOT (escolhe a fb como o usuário) =====
echo "--- seletor: escolhendo NATIVE pelo gamepad ---"
echo web > /var/lib/cyberdeck/interface          # começa em web p/ provar a navegação
nohup "$CHOOSER" >/tmp/chooser.out 2>&1 &
CH=$!
sleep 1.5; shot selector
tap R R A                                        # WEB->REACT->NATIVE + confirma (seletor de 3 opções)
sleep 1; wait "$CH" 2>/dev/null
echo "pref após seletor: $(cat /var/lib/cyberdeck/interface)"

# ===== 2) NATIVE-FB: percorre todas as telas =====
echo "--- native-fb: navegando todas as telas ---"
nohup "$PAD" >/tmp/fb.out 2>/tmp/fb.err &
FB=$!
sleep 2.5
shot home
tap R;      shot status
tap R1;     shot status-energia
tap R1;     shot status-tendencia
tap R1                                            # volta p/ AO VIVO
tap R;      shot procs
tap X;      shot procs-filtro
tap Y;      shot procs-sort
tap A;      shot procs-detalhe
tap B
tap R;      shot net
tap X; sleep 2; shot net-scan
tap B
tap Y; sleep 1; shot net-conexoes
tap B
tap R;      shot logs
tap X;      shot logs-severidade
tap A;      shot logs-detalhe
tap B
tap R;      shot device
tap R1;     shot device-cpu
tap R;      shot fs
tap A;      shot fs-dir
tap B
tap X;      shot fs-atalhos
tap R;      shot svc
tap X;      shot svc-filtro
tap A;      shot svc-detalhe
tap B
tap R;      shot cmd
tap A;      shot cmd-lista
tap B
# --- menu FN + telas/ações seguras ---
tap FN;          shot fn-menu
tap A;           shot ajustes-display      # Ajustes
tap A;           shot ajustes-brilho       # Brilho - (ação segura)
tap R1;          shot ajustes-audio        # subpágina AUDIO
tap A;           shot ajustes-volume       # Volume - (ação segura)
tap B
tap FN; tap D D; tap A;  shot media        # Teste A/V
tap A; sleep 1;  shot media-tocando        # tocar 1º sample (áudio, seguro)
tap B
tap FN; tap D D D; tap A; shot storage     # Armazenamento (só ver — NÃO expande)
tap B
tap FN; tap D D D D; tap A; shot kernel    # Kernel & DTB
tap A;           shot kernel-no-fs         # nó DTB -> FS
tap B
tap FN; tap D; tap A;     shot keys        # Testar botões
tap A B X Y;     shot keys-pressionado
combo START SELECT                         # sai do KEYS (Start+Select juntos)
combo L2 R2;     shot screenshot-combo     # screenshot (ação segura)

# ===== 3) SMOKE DO AGENTE (backend das duas UIs) =====
echo "--- smoke do agente ---"
agced(){ # GET path -> ok?
  exec 4<>/dev/tcp/127.0.0.1/8080 || { echo "AGENT FAIL conexão $1"; FAIL=$((FAIL+1)); return; }
  printf 'GET %s HTTP/1.0\r\nHost: x\r\n\r\n' "$1" >&4
  if timeout 5 cat <&4 | tail -1 | grep -q '"ok":true'; then echo "AGENT ok   $1"; PASS=$((PASS+1)); else echo "AGENT FAIL $1"; FAIL=$((FAIL+1)); fi
  exec 4>&- 2>/dev/null
}
for p in /api/status /api/health /api/ping /api/device /api/kernel /api/processes \
         /api/systemd/summary /api/systemd/services "/api/fs/list?path=/" /api/fs/bookmarks \
         /api/network/summary "/api/logs?source=dmesg" /api/commands /api/actions \
         /api/volume /api/media /api/storage; do agced "$p"; done

# ===== 4) validação: frames distintos (não travado/branco) =====
DISTINCT=$(md5sum "$OUT"/*.png 2>/dev/null | awk '{print $1}' | sort -u | wc -l)
TOTAL=$(ls "$OUT"/*.png 2>/dev/null | wc -l)
echo "--- frames distintos: $DISTINCT de $TOTAL capturas ---"
[ "$DISTINCT" -ge 6 ] && { echo "DISTINCT ok"; PASS=$((PASS+1)); } || { echo "DISTINCT FAIL (telas iguais?)"; FAIL=$((FAIL+1)); }

# ===== 5) encerra: gamepad off + religa a sessão =====
echo "--- encerrando ---"
exec 3>&-; sleep 0.3; kill "$CDPAD" 2>/dev/null
kill -TERM "$FB" 2>/dev/null; sleep 1
rm -f "$FIFO"
echo web > /var/lib/cyberdeck/interface
systemctl reset-failed cyberdeck-session 2>/dev/null
systemctl start cyberdeck-session 2>/dev/null &
sleep 12
WEB=$(pgrep -x chromium >/dev/null && echo on || echo off)
echo "--- web smoke: chromium=$WEB ---"
[ "$WEB" = on ] && PASS=$((PASS+1)) || { echo "WEB FAIL (chromium não subiu)"; FAIL=$((FAIL+1)); }

echo "===== RESUMO: PASS=$PASS FAIL=$FAIL  ($TOTAL screenshots em $OUT) ====="
echo "DONE"
