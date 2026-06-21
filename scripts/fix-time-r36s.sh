#!/usr/bin/env bash
# fix-time-r36s.sh — acerta o relógio do R36S AGORA, via SSH, sem reflash.
# Define o fuso (BR), ajusta o clock pela hora do PRÓPRIO PC (UTC) e grava no RTC.
# É um remendo imediato; o NTP persistente vem com o build (systemd-timesyncd).
#
# Uso:  scripts/fix-time-r36s.sh [ip|host]   (default r36s-cyberdeck.local)
set -eu
HOST="${1:-r36s-cyberdeck.local}"
TZ_WANT="${TZ_WANT:-America/Sao_Paulo}"
OPTS="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR \
-o ConnectTimeout=8 -o ControlMaster=auto -o ControlPath=$HOME/.ssh/cm-%C -o ControlPersist=60"

NOW_UTC="$(date -u '+%Y-%m-%d %H:%M:%S')"   # hora correta do host, em UTC
echo "[time] host UTC = $NOW_UTC -> $HOST (fuso $TZ_WANT)"

ssh $OPTS "root@$HOST" "
  # fuso horário
  if command -v timedatectl >/dev/null 2>&1; then timedatectl set-timezone '$TZ_WANT' 2>/dev/null || true; fi
  ln -sf /usr/share/zoneinfo/$TZ_WANT /etc/localtime 2>/dev/null || true
  echo '$TZ_WANT' > /etc/timezone 2>/dev/null || true
  # ajusta o relógio do sistema pela hora (UTC) do PC
  date -u -s '$NOW_UTC' >/dev/null
  # persiste no RTC do aparelho
  command -v hwclock >/dev/null 2>&1 && hwclock -w 2>/dev/null || true
  # se houver NTP, deixa ligado p/ refinar
  command -v timedatectl >/dev/null 2>&1 && timedatectl set-ntp true 2>/dev/null || true
  echo -n '[time] agora no R36S: '; date
"
echo "[time] pronto."
