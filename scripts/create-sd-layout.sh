#!/usr/bin/env bash
#
# create-sd-layout.sh
# -------------------
# (PLANEJAMENTO / placeholder) Descreve e, futuramente, cria o layout de SD card
# do R36S CyberDeck OS, espelhando o esquema validado do ArkOS:
#
#   p1  FAT32  BOOT    (kernel + DTB rk3326 + boot.ini/extlinux + uInitrd)
#   p2  ext4   rootfs  (rootfs mínimo do CyberDeck OS)
#   p3  exFAT  data    (opcional — dados/UI/scripts do usuário)
#
# Nesta fase o script apenas IMPRIME o plano. A criação real (sfdisk/mkfs) será
# habilitada quando o rootfs do Buildroot existir. NÃO escreve em disco ainda.
#
set -u
cat <<'PLAN'
=== R36S CyberDeck OS — layout de SD planejado ===

Espelha o esquema validado do ArkOS (RK3326):

  Partição  Tipo    Rótulo   Conteúdo
  --------  ------  -------  -----------------------------------------------
  p1        FAT32   BOOT     kernel (Image), rk3326-*.dtb, boot.ini/extlinux,
                             uInitrd  -> idêntico ao fluxo de boot do ArkOS
  p2        ext4    ROOTFS   rootfs mínimo (Buildroot) + runtime web + UI
  p3        exFAT   DATA     (opcional) dados do usuário, scripts, perfis UI

Offsets de referência (do ArkOS, setor=512B):
  p1: start 32768
  p2: start 262144
  p3: start 13983744

IMPLEMENTAÇÃO FUTURA (quando o rootfs existir):
  sudo sfdisk /dev/sdX < board/r36s/boot/sd-layout.sfdisk
  mkfs.vfat -n BOOT  /dev/sdX1
  mkfs.ext4 -L ROOTFS /dev/sdX2
  mkfs.exfat -n DATA  /dev/sdX3   # opcional

Este script ainda NÃO escreve em disco. Ver docs/boot/boot-flow.md.
PLAN
