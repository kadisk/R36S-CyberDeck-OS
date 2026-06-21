#!/bin/sh
# cyberdeck-net.sh — gerencia o Wi-Fi via dongle USB (ex.: RTL8188FTV/8188fu, 0bda:f179).
# Detecta a interface wireless DINAMICAMENTE (independe do nome: wlan0, wlx..., etc.),
# sobe o link, autentica via wpa_supplicant e pega IP por DHCP.
#
# Subcomandos:  up | down | reconnect | status | scan | iface
#   up         sobe + conecta na rede de /etc/wpa_supplicant/cyberdeck.conf
#   status     imprime  iface= state= ssid= ip=   (consumido pelo agente)
#   scan       lista SSIDs visíveis (um por linha)
#
# Roda como root (chamado pelo systemd, pela regra udev e pelo agente).
set -u

CONF=/etc/wpa_supplicant/cyberdeck.conf
RUNDIR=/run/cyberdeck-net
WPA_PID="$RUNDIR/wpa.pid"

log() { echo "[net] $*"; }

# desbloqueia o RF. O framework rfkill-wlan da Rockchip inicia BLOQUEADO; com o RF
# bloqueado, o driver 8188fu não completa o probe e NÃO cria a wlan0. O ArkOS resolve
# isso com 'rfkill unblock wlan' — replicamos aqui (e cedo, antes de procurar a iface).
unblock_rf() {
  command -v rfkill >/dev/null 2>&1 || return 0
  rfkill unblock all 2>/dev/null || true
}

# espera a interface wireless aparecer (até $1 segundos). Imprime o nome se achar.
wait_iface() {
  n="${1:-10}"; i=0
  while [ "$i" -lt "$n" ]; do
    IFW="$(find_iface)" && { echo "$IFW"; return 0; }
    i=$((i + 1)); sleep 1
  done
  return 1
}

# carrega o 8188fu: modprobe; se os índices depmod estiverem incompatíveis (kmod do
# host x kmod do kernel 4.4), cai para insmod pelo caminho absoluto.
load_module() {
  lsmod 2>/dev/null | grep -q '^8188fu' && return 0
  KV="$(uname -r)"
  modprobe 8188fu 2>/dev/null && return 0
  for KO in \
    "/lib/modules/$KV/kernel/drivers/net/wireless/rockchip_wlan/rtl8188fu/8188fu.ko" \
    /lib/modules/*/kernel/drivers/net/wireless/rockchip_wlan/rtl8188fu/8188fu.ko ; do
    [ -f "$KO" ] || continue
    log "insmod $KO"; insmod "$KO" 2>&1 || true
    lsmod 2>/dev/null | grep -q '^8188fu' && return 0
  done
  return 1
}

# o dongle Realtek f179 está conectado no USB?
dongle_present() {
  grep -qi 'f179' /sys/bus/usb/devices/*/idProduct 2>/dev/null && return 0
  command -v lsusb >/dev/null 2>&1 && lsusb 2>/dev/null | grep -qi '0bda:f179' && return 0
  return 1
}

# insmod direto de um .ko por nome de arquivo (8188fu.ko / rtl8188fu.ko)
insmod_by_name() {
  for KO in /lib/modules/*/kernel/drivers/net/wireless/rockchip_wlan/*/"$1" \
            /lib/modules/*/kernel/drivers/net/wireless/"$1" ; do
    [ -f "$KO" ] || continue
    log "insmod $KO"; insmod "$KO" 2>&1 || true
    return 0
  done
  return 1
}

# garante interface. CHAVE: o driver rockchip 8188fu só vincula o dongle quando o
# module_init roda COM o dispositivo já presente (igual ao autoload por udev do ArkOS).
# Pré-carregar no boot (antes do plug) NÃO vincula. Então aqui forçamos uma carga
# LIMPA do módulo com o dongle presente; se o 8188fu não criar wlan, tenta o rtl8188fu.
ensure_module() {
  find_iface >/dev/null 2>&1 && return 0          # já tem interface? nada a fazer
  unblock_rf
  # espera o dongle aparecer no USB (até ~10s) — pode ter acabado de ser plugado
  i=0; while [ "$i" -lt 10 ] && ! dongle_present; do i=$((i + 1)); sleep 1; done
  dongle_present || { log "dongle Realtek f179 não está no USB (cabo OTG/porta?)"; return 1; }
  log "dongle f179 presente — (re)carregando módulo LIMPO com o dispositivo conectado"
  # descarrega qualquer instância anterior (carregada antes do plug, que não vincula)
  modprobe -r 8188fu 2>/dev/null; rmmod 8188fu 2>/dev/null || true
  modprobe -r rtl8188fu 2>/dev/null; rmmod rtl8188fu 2>/dev/null || true
  sleep 1; unblock_rf
  modprobe 8188fu 2>/dev/null || insmod_by_name 8188fu.ko || true
  wait_iface 10 >/dev/null && { log "wlan criada pelo 8188fu"; return 0; }
  # fallback: driver rtl8188fu (genérico)
  log "8188fu não criou wlan — tentando rtl8188fu"
  modprobe -r 8188fu 2>/dev/null; rmmod 8188fu 2>/dev/null || true
  sleep 1; unblock_rf
  modprobe rtl8188fu 2>/dev/null || insmod_by_name rtl8188fu.ko || true
  wait_iface 10 >/dev/null && { log "wlan criada pelo rtl8188fu"; return 0; }
  log "nenhum driver criou wlan mesmo com o dongle presente (ver diag)"
  return 1
}

# primeira interface com diretório wireless (wext) ou phy80211 (mac80211)
find_iface() {
  for w in /sys/class/net/*/wireless /sys/class/net/*/phy80211; do
    [ -e "$w" ] || continue
    basename "$(dirname "$w")"
    return 0
  done
  return 1
}

dhcp() {
  IF="$1"
  if command -v dhclient >/dev/null 2>&1; then
    dhclient -1 -nw "$IF" 2>/dev/null || true
  elif command -v udhcpc >/dev/null 2>&1; then
    udhcpc -i "$IF" -t 6 -n -q 2>/dev/null || true
  else
    log "nenhum cliente DHCP (dhclient/udhcpc) — IP não será obtido"
  fi
}

up() {
  unblock_rf                                       # libera o RF ANTES (rockchip inicia bloqueado)
  ensure_module || true
  IF="$(find_iface)" || { log "nenhuma interface wireless (rfkill? módulo? dongle plugado?)"; return 1; }
  log "interface wireless: $IF"
  unblock_rf
  ip link set "$IF" up || true
  [ -f "$CONF" ] || { log "sem configuração de rede: $CONF"; return 1; }
  mkdir -p "$RUNDIR"
  # encerra wpa_supplicant anterior nessa interface
  pkill -f "wpa_supplicant.*-i *$IF" 2>/dev/null || true
  sleep 1
  log "wpa_supplicant -i $IF"
  wpa_supplicant -B -i "$IF" -c "$CONF" -P "$WPA_PID" || { log "falha ao iniciar wpa_supplicant"; return 1; }
  # aguarda associação (até ~20s)
  i=0
  while [ "$i" -lt 20 ]; do
    st="$(wpa_cli -i "$IF" status 2>/dev/null | sed -n 's/^wpa_state=//p')"
    [ "$st" = "COMPLETED" ] && break
    i=$((i + 1)); sleep 1
  done
  log "wpa_state=${st:-?}"
  dhcp "$IF"
  status
}

down() {
  IF="$(find_iface)" || return 0
  pkill -f "wpa_supplicant.*-i *$IF" 2>/dev/null || true
  command -v dhclient >/dev/null 2>&1 && dhclient -r "$IF" 2>/dev/null || true
  ip addr flush dev "$IF" 2>/dev/null || true
  ip link set "$IF" down 2>/dev/null || true
  log "Wi-Fi desativado ($IF)"
}

status() {
  IF="$(find_iface)" || { echo "iface="; echo "state=no-device"; echo "ssid="; echo "ip="; return 0; }
  S="$(wpa_cli -i "$IF" status 2>/dev/null)"
  ssid="$(printf '%s\n' "$S" | sed -n 's/^ssid=//p')"
  wstate="$(printf '%s\n' "$S" | sed -n 's/^wpa_state=//p')"
  ip4="$(ip -4 -o addr show dev "$IF" 2>/dev/null | awk '{print $4}' | head -1)"
  echo "iface=$IF"
  echo "state=${wstate:-down}"
  echo "ssid=${ssid:-}"
  echo "ip=${ip4:-}"
}

scan() {
  IF="$(find_iface)" || { log "sem interface wireless"; return 1; }
  ip link set "$IF" up 2>/dev/null || true
  if command -v iw >/dev/null 2>&1; then
    iw dev "$IF" scan 2>/dev/null | sed -n 's/^[[:space:]]*SSID: //p' | sed '/^$/d' | sort -u
  else
    iwlist "$IF" scan 2>/dev/null | sed -n 's/.*ESSID:"\(.*\)"/\1/p' | sed '/^$/d' | sort -u
  fi
}

# diag — dump completo para depurar "não conecta" (rodar no console do R36S)
diag() {
  echo "==== cyberdeck-net diag ===="
  echo "--- kernel rodando ---"; uname -r
  echo "--- vermagic do 8188fu.ko vs kernel ---"
  KO="$(find /lib/modules -iname '8188fu.ko' 2>/dev/null | head -1)"
  if [ -n "$KO" ]; then echo "ko: $KO"; modinfo "$KO" 2>/dev/null | grep -iE 'vermagic|version'; else echo "(8188fu.ko NÃO encontrado em /lib/modules)"; fi
  echo "--- rfkill (bloqueado? rockchip inicia BLOQUEADO) ---"; rfkill list 2>/dev/null || echo "(rfkill ausente)"
  echo "--- desbloqueando RF (rfkill unblock all) ---"; unblock_rf && echo "(ok)"
  echo "--- módulo 8188fu carregado? ---"; lsmod 2>/dev/null | grep -iE '8188|rtl8' || echo "(NÃO carregado)"
  echo "--- modprobe 8188fu (tenta carregar) ---"; modprobe 8188fu 2>&1 || echo "(falhou modprobe)"
  echo "--- insmod por caminho (ignora índices depmod) ---"; [ -n "$KO" ] && { insmod "$KO" 2>&1 && echo "(insmod OK)" || echo "(insmod falhou ^)"; }
  echo "--- USB ---"; (lsusb 2>/dev/null || cat /sys/kernel/debug/usb/devices 2>/dev/null) | grep -iE '0bda|f179|realtek|802.11' || echo "(dongle não visto no USB)"
  echo "--- dmesg wifi ---"; dmesg 2>/dev/null | grep -iE '8188|rtl8|wlan|f179|cfg80211' | tail -20 || echo "(nada)"
  echo "--- interfaces de rede ---"; ls /sys/class/net 2>/dev/null
  echo "--- iface wireless detectada ---"; find_iface || echo "(NENHUMA)"
  echo "--- ferramentas ---"; for t in wpa_supplicant wpa_cli dhclient udhcpc iw iwlist rfkill; do command -v "$t" >/dev/null 2>&1 && echo "ok $t" || echo "FALTA $t"; done
  echo "--- config wpa ---"; [ -f "$CONF" ] && { echo "existe $CONF:"; grep -vE 'psk=' "$CONF"; echo "    psk=<oculto>"; } || echo "(SEM $CONF)"
  echo "--- autoload (modules-load.d / blacklist) ---"; cat /etc/modules-load.d/cyberdeck-wifi.conf 2>/dev/null; cat /etc/modprobe.d/cyberdeck-wifi.conf 2>/dev/null
  echo "--- serviço ---"; systemctl is-enabled cyberdeck-net.service 2>/dev/null; systemctl status cyberdeck-net.service --no-pager 2>/dev/null | head -12
  echo "--- status atual ---"; status
  echo "==== fim diag ===="
}

cmd="${1:-status}"
case "$cmd" in
  up)        up ;;
  down)      down ;;
  reconnect) down; up ;;
  status)    status ;;
  scan)      scan ;;
  iface)     find_iface || echo "" ;;
  diag)      diag ;;
  *)         echo "uso: $0 up|down|reconnect|status|scan|iface|diag" >&2; exit 2 ;;
esac
