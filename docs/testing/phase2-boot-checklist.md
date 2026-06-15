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

## Diagnóstico do 1º teste (sem cabo serial)

Como U-Boot, kernel, initramfs e ext4 estão **comprovadamente corretos** (idênticos
ao ArkOS / genéricos), se "não bootar" o passo-chave é **ver onde para**. Por isso o
`boot.ini` agora tem `console=tty1` → o **log do kernel aparece na TELA**.

Ao reflashar e ligar, observe a tela e classifique:

| O que aparece na tela | Conclusão | Próximo passo |
|------------------------|-----------|---------------|
| **Nada / tela apagada, sem backlight** | U-Boot não rodou OU slot errado | confirmar slot (ver abaixo) e gravação |
| **Backlight liga, tela preta, sem texto** | U-Boot rodou, mas kernel não carregou (FAT/`mmc 1:1`/slot) | testar o outro slot; conferir boot.ini |
| **Log do kernel rolando e para / "Kernel panic … VFS: Unable to mount root"** | kernel ok; falhou montar nossa raiz | fotografar a mensagem; ver Plano B |
| **Log do kernel + "R36S CyberDeck OS … ROOTFS OK" + prompt** | ✅ **SUCESSO** | rodar as verificações do shell |

**Isolar o aparelho/slot:** antes de culpar a imagem, confirme que o **cartão ArkOS
original ainda boota** nesse mesmo R36S e no mesmo slot. Se o ArkOS boota e o nosso
não, o problema está na nossa imagem (e a tabela acima diz onde). O R36S tem **2
slots**; use o **mesmo** onde o ArkOS normalmente boota.

> Dica: **fotografe a tela** no ponto em que travar e me mande — a última linha
> costuma identificar a causa exata.

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
