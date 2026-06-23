#!/bin/sh
# cyberdeck-growfs.sh — expande a rootfs (ext4) p/ ocupar o cartão inteiro.
# Roda no 1º boot (cyberdeck-growfs.service, oneshot) e também pela ação "Expandir
# rootfs" da UI (--force). A imagem grava a p2 com 4 GB; num cartão maior sobra
# espaço não alocado — aqui crescemos a partição (growpart) e o filesystem
# (resize2fs, online, com a rootfs montada). NÃO destrói dados.
#
# Idempotente: marca /var/lib/cyberdeck/.fs-expanded só APÓS o resize2fs crescer
# (se o kernel só reler a tabela no próximo boot, o serviço completa lá).
FLAG=/var/lib/cyberdeck/.fs-expanded
FORCE=0; [ "${1:-}" = "--force" ] && FORCE=1
log(){ echo "[growfs] $*"; }

[ "$FORCE" = 0 ] && [ -f "$FLAG" ] && { log "já expandido (flag presente)"; exit 0; }

ROOT="$(findmnt -no SOURCE / 2>/dev/null)"
case "$ROOT" in
  /dev/*) : ;;
  *) log "rootfs não é um device de bloco ($ROOT) — abortando"; exit 0 ;;
esac

# deriva disco + número da partição (mmcblkXpN -> disco=mmcblkX, n=N; sdXN -> sdX, N)
case "$ROOT" in
  *mmcblk*p[0-9]*) DISK="${ROOT%p[0-9]*}"; PN="${ROOT##*p}" ;;
  *)              PN="$(echo "$ROOT" | sed 's/.*[^0-9]//')"; DISK="${ROOT%$PN}" ;;
esac
[ -b "$DISK" ] || { log "disco não encontrado ($DISK)"; exit 0; }

# espaço não alocado após a partição? (tamanho do disco vs fim da partição, em setores)
disk_sectors="$(cat "/sys/class/block/$(basename "$DISK")/size" 2>/dev/null || echo 0)"
part_start="$(cat "/sys/class/block/$(basename "$ROOT")/start" 2>/dev/null || echo 0)"
part_sectors="$(cat "/sys/class/block/$(basename "$ROOT")/size" 2>/dev/null || echo 0)"
free=$(( disk_sectors - (part_start + part_sectors) ))
log "disco=$DISK p$PN  livre=$(( free/2048 )) MiB"
if [ "$FORCE" = 0 ] && [ "$free" -lt 131072 ]; then   # < 64 MiB livres: nada a fazer
  log "sem espaço relevante p/ expandir; marcando flag"
  mkdir -p "$(dirname "$FLAG")"; : > "$FLAG"; exit 0
fi

command -v growpart >/dev/null || { log "growpart ausente (instale cloud-guest-utils)"; exit 0; }
log "growpart $DISK $PN"
growpart "$DISK" "$PN" 2>&1 | sed 's/^/[growfs] growpart: /' || log "growpart: nada a fazer / já no máximo"
partprobe "$DISK" 2>/dev/null || true

log "resize2fs $ROOT"
if resize2fs "$ROOT" 2>&1 | sed 's/^/[growfs] resize2fs: /'; then
  mkdir -p "$(dirname "$FLAG")"; : > "$FLAG"
  log "OK — rootfs expandida. $(df -h / | awk 'NR==2{print $2" total, "$4" livre"}')"
else
  log "resize2fs não cresceu agora (talvez só após reboot) — flag NÃO marcada"
fi
