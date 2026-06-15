# Achados da extração do Arch-R (Fase 5)

Imagem: `ArchR-R36S.aarch64-20260526-original.img.gz` (v2.0 RC-4), sha256 conferido.

## Kernel / boot (partição BOOT p1, FAT "ARCHR")

- **Kernel: Linux 6.12.79** (mainline LTS, aarch64) — arquivo `KERNEL` (22 MB),
  extraído p/ `artifacts/mainline/boot/Image`. (gcc 14.2 archr.)
- **DTB do R36S:** `rk3326-gameconsole-r36s.dtb` (em `/dtbs/`), + 10 outros DTBs
  RK3326 (odroid-go2/go3, anbernic rg351, gameforce, powkiddy, soysauce, r33s).
- **Painel:** Arch-R NÃO usa um DTB fixo de painel — usa **base DTB + overlay**
  `FDTOVERLAYS /overlays/mipi-panel.dtbo`, e há dezenas de overlays por
  revisão/painel (`R36S-V12_..._Panel_0/Panel_4`, `R36S-V21_..._2550`,
  `HL-R36H-V20/V21`, `R35S-V11`, sufixos `_JPk36/_JPmm/_SRs`).
- **U-Boot:** `boot.scr` seleciona o DTB e o painel via **`hwid_adc`** (lê um ADC
  p/ identificar placa/painel) — recurso do U-Boot Armbian/Arch-R. O nosso U-Boot
  do ArkOS **não** faz essa auto-detecção de overlay.
- **extlinux.conf APPEND:** `... quiet console=ttyS2,1500000 console=tty0 loglevel=0
  ... root=${partition_root} ... uboot.hwid_adc=${hwid_adc}` → console mainline é
  **`ttyS2`** (não ttyFIQ0).

## Rootfs (p2, ext4 "ARCHR_ROOT") — é uma APPLIANCE

- Layout custom (`/usr/{config,www,plugins,qml,...}`), estilo LibreELEC/appliance.
- **`/usr/lib/modules` é symlink → `/run/kernel-overlays/modules`** (tmpfs): os
  módulos do kernel são montados por **overlay em runtime** (provável squashfs/
  arquivo), **não** há um `/lib/modules/6.12.79` comum no rootfs.
- Panfrost: provável módulo dentro desse overlay (não confirmado built-in).

## Implicação estratégica

Reaproveitar **só o kernel do Arch-R** num rootfs Debian é difícil: os módulos não
estão num `/lib/modules` simples (estão empacotados/overlay), e o painel depende da
auto-detecção do U-Boot Armbian. Reconstruir isso à mão é trabalhoso e arriscado.

Dois caminhos melhores (ver phase5 plan, seção revisada):
- **C1 — Basear no Arch-R:** Arch-R JÁ boota e renderiza no R36S (mainline 6.12 +
  Mesa Panfrost + painel auto-detectado). Adicionar `cog` + a `cyberdeck-ui` e
  desligar o frontend de jogos. Menor esforço; stack gráfico já resolvido.
- **C2 — Compilar nosso kernel mainline:** Linux 6.12 + DT do R36S + Panfrost
  (módulos via `make modules_install`, limpo) + rootfs Debian + Mesa. Controle/
  posse total, mas temos que resolver painel (overlay kd35t133 do nosso lote) e
  U-Boot nós mesmos.

Nosso painel (confirmado na Fase 1): **`elida,kd35t133`** — precisamos do overlay/
DT correspondente (no Arch-R, um dos `R36S-V*_Panel_*`/`mipi-panel.dtbo`).
