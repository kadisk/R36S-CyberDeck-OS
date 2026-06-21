#!/usr/bin/env bash
# ssh-r36s.sh — conecta via SSH no R36S CyberDeck (login root).
# Por padrão resolve pelo mDNS (avahi): r36s-cyberdeck.local — passe um IP/host p/
# sobrescrever (o IP aparece na aba NET do aparelho). Senha padrão: cyberdeck.
#
# Como o aparelho é reflashado com frequência (a host key muda a cada imagem),
# ignoramos o known_hosts p/ evitar o aviso "REMOTE HOST IDENTIFICATION CHANGED".
#
# Uso:  scripts/ssh-r36s.sh [ip|host]            # shell interativo
#       scripts/ssh-r36s.sh [ip|host] <comando>  # roda um comando e sai
set -eu

HOST="${1:-r36s-cyberdeck.local}"; shift || true

exec ssh \
  -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null \
  -o LogLevel=ERROR \
  -o ConnectTimeout=8 \
  -o ControlMaster=auto \
  -o ControlPath="$HOME/.ssh/cm-%C" \
  -o ControlPersist=120 \
  root@"$HOST" "$@"
