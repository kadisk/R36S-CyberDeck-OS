#!/bin/sh
# cyberdeck-mount-card.sh — monta o 2º cartão (o microSD que NÃO carrega a rootfs)
# em /media/sdcard. Chamado no boot (cyberdeck-mountcard.service) e no hotplug (udev).
# Não-destrutivo: só monta (rw, type auto: vfat/exfat/ext4). Se o 2º cartão sumiu,
# desmonta. O R36S tem dois slots; o de boot vira a rootfs, o outro é o "2º cartão".
MNT=/media/sdcard
log(){ echo "[mountcard] $*"; }

ROOT="$(findmnt -no SOURCE / 2>/dev/null)"
case "$ROOT" in
  *mmcblk*) ROOTDISK="/dev/$(basename "${ROOT%p[0-9]*}")" ;;
  *)        ROOTDISK="" ;;
esac

TARGET=""
for d in /dev/mmcblk[0-9]; do
  [ -b "$d" ] || continue
  [ "$d" = "$ROOTDISK" ] && continue
  TARGET="$d"; break
done

if [ -z "$TARGET" ]; then
  if mountpoint -q "$MNT"; then umount -l "$MNT" 2>/dev/null && log "2º cartão removido — desmontado"; fi
  log "nenhum 2º cartão"; exit 0
fi

PART="${TARGET}p1"; [ -b "$PART" ] || PART="$TARGET"   # 1ª partição, ou o disco cru
mkdir -p "$MNT"
if mountpoint -q "$MNT"; then log "já montado em $MNT"; exit 0; fi
if mount -o rw,noatime "$PART" "$MNT" 2>/dev/null || mount "$PART" "$MNT" 2>/dev/null; then
  log "$PART -> $MNT ($(findmnt -no FSTYPE "$MNT" 2>/dev/null))"
else
  log "falha ao montar $PART (fs sem suporte?)"; exit 1
fi
