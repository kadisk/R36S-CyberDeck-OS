# Checklist de boot — Fase 2 (R36S físico)

Objetivo: confirmar que o **rootfs próprio** boota no R36S, reutilizando o boot do
ArkOS. Marque cada item ao testar; anote evidências.

## Antes de ligar

- [ ] Imagem gerada: `artifacts/test-images/r36s-cyberdeck-minimal.img`.
- [ ] Relatório conferido: `artifacts/test-images/reports/test-image.md`
      (sha256, partições, bootloader "incluído").
- [ ] microSD **de teste** (não o ArkOS) gravado com `dd` (ver
      `docs/boot/sd-card-test-layout.md`).
- [ ] Cartão ArkOS original guardado, **intacto**.
- [ ] (Opcional, recomendado) cabo USB-serial ligado ao `ttyFIQ0`
      (1500000 8N1) para ver o boot mesmo sem tela.

## Sequência de boot esperada

- [ ] **U-Boot inicia** (BootROM achou o idbloader/U-Boot copiado do ArkOS).
- [ ] U-Boot carrega `Image`, `uInitrd`, `rk3326-r35s-linux.dtb` de `mmc 1:1`.
- [ ] **Kernel 4.4.189 imprime log** no serial `ttyFIQ0` (sem `quiet`).
- [ ] initramfs do ArkOS monta a raiz por `root=UUID=c1be7dec-…`.
- [ ] **switch_root** para o nosso `/sbin/init` (BusyBox).
- [ ] `rcS` roda: aparece o **banner** `R36S CyberDeck OS — minimal rootfs … ROOTFS OK`.
- [ ] **Shell** abre em `ttyFIQ0` (serial) e/ou `tty1` (tela).

## Verificações no shell (no aparelho)

- [ ] `cat /etc/os-release` → `R36S CyberDeck OS`.
- [ ] `uname -a` → `Linux … 4.4.189 … aarch64`.
- [ ] `cat /proc/device-tree/model` → modelo `rk3326` (odroidgo3-linux).
- [ ] `mount | grep ' / '` → raiz é a p2 ext4 (UUID nosso) montada `rw`.
- [ ] `ls /dev` → tem `console`, `tty1`, `ttyFIQ0` (devtmpfs), `mmcblk0p*`.
- [ ] `dmesg | grep -i panel` → painel `kd35t133` inicializou (DSI/VOP).
- [ ] `cat /proc/cpuinfo` → 4× Cortex-A35.

## Critérios de aceite (Fase 2)

- [ ] **A tela mostra** o log de boot ou um shell.
- [ ] **Serial `ttyFIQ0` mostra** o boot.
- [ ] **O rootfs monta** (a nossa p2, por UUID).
- [ ] **init executa** (BusyBox init → rcS → banner).
- [ ] **Shell abre** e responde a comandos.

## Se NÃO bootar — triagem

| Sintoma | Provável causa | Ação |
|---------|----------------|------|
| Tela/serial mortos, sem U-Boot | bootloader ausente/region errada | confirmar "bootloader incluído" no relatório; ArkOS presente ao gerar |
| U-Boot ok, mas "Bad Linux ARM64 Image" | Image/cmd corrompido | regravar; conferir `boot.ini` |
| Kernel sobe, **panic "no init found"** / VFS não monta root | initramfs não fez switch_root, ou UUID errada | ver Plano B em `minimal-rootfs-boot-plan.md` (sem uInitrd, ou `root=/dev/mmcblk0p2`, ou initramfs próprio) |
| Monta root mas sem shell | `/dev/console` ausente / inittab | já criamos `console`; conferir `etc/inittab` |
| Shell só no serial, tela preta | fbcon/painel | manter `fbcon=rotate:0`; checar `dmesg` do painel; é assunto da Fase 3 |

## Registro

Anote o resultado em `docs/testing/results/phase2-<data>.md` (criar ao testar):
foto/serial do banner, saída de `uname -a` e `cat /proc/device-tree/model`,
e quais itens do aceite passaram.
