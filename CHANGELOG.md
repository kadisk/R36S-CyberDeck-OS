# Changelog — R36S CyberDeck OS

Formato baseado em [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added — 2026-06-15 — Fase 2 CONCLUÍDA: boot confirmado no R36S físico ✅
- **Boot do rootfs próprio confirmado no R36S** (modo `--clone`): foto mostra o
  banner "R36S CyberDeck OS … ROOTFS OK", `raiz: /dev/mmcblk0p2 ext4 rw`, kernel
  4.4.189 aarch64 e shell BusyBox na tela. Ver
  `docs/testing/results/phase2-2026-06-15.md`.
- **Coleta de hardware no boot** (`/etc/init.d/collect-hwinfo.sh`, chamado pelo rcS):
  grava `cyberdeck-hwinfo.txt` na partição BOOT (model/dt, `/dev/dri`, `/dev/fb*`,
  backlight, `/dev/input`, dmesg de painel/DSI/VOP/Mali/RK817, módulos) — lê-se no PC.
  Ponte para a Fase 3, já que o R36S não tem teclado.
- `inittab`: removido o respawn genérico sem tty (gerava "can't access tty; job
  control turned off"); shells confirmados em `ttyFIQ0` e `tty1`.

### Fixed — 2026-06-15 — Fase 2: MBR clonado do ArkOS (2º teste: tela apagada)
- 2º flash (já com console=tty1) → **tela totalmente apagada**; ArkOS original
  **boota normal no mesmo slot** (aparelho/slot OK). Comparação setor a setor: no
  bloco de boot (0..32767) **só o setor 0 (MBR) diferia** — o MBR feito por `sfdisk`
  (p1 tipo `c`, geometria própria) impedia o U-Boot de achar a BOOT → nada acendia.
- **Correção (modo `--clone`, agora padrão em `create-test-sd-image.sh`):** em vez de
  montar MBR/FAT do zero, **clona a região de boot do ArkOS** (MBR + bootloader +
  a própria FAT BOOT, byte-a-byte) e troca SÓ: o `boot.ini` (nosso, root=UUID +
  console=tty1) e a **rootfs ext4** (gravada no setor da p2 do ArkOS, 262144;
  montada por UUID). MBR e U-Boot passam a ser exatamente os que bootam o ArkOS.
- Modo `--fresh` (MBR/FAT do zero) mantido só como referência (não bootou).
- Verificado: MBR e bootloader da imagem nova == ArkOS (sha256); FAT com nosso
  boot.ini + Image/uInitrd/dtb; ext4 com UUID `c1be7dec-…` no setor 262144.

### Fixed — 2026-06-15 — Fase 2: visibilidade de boot na tela (1º teste físico)
- 1º flash no R36S não exibiu boot. Diagnóstico estático: U-Boot/kernel são
  **byte a byte iguais ao ArkOS** (bootloader copiado confere sha256; `LOADER`@16384,
  `BL3X`@24576), o `uInitrd` é **initramfs-tools genérico** (lê `root=UUID`, sem
  UUID embutida, faz switch_root) e o ext4 usa as MESMAS features do rootfs ArkOS
  (mountável pelo 4.4). Causa provável do "tela preta": o kernel logava só em
  `console=/dev/ttyFIQ0` (serial), invisível sem cabo.
- **Correção:** `boot.ini` agora inclui `console=tty1` (além de ttyFIQ0) → log do
  kernel, banner e shell aparecem **na tela** do R36S. Imagem regerada.
- Docs: checklist ganhou tabela "o que aparece na tela → conclusão" e passo de
  isolar aparelho/slot (R36S tem 2 slots; o ArkOS original deve bootar no mesmo).

### Added — 2026-06-14 — Fase 2: boot mínimo experimental (imagem de teste)
- **Imagem de SD de teste gerável por script**, sem root e sem gravar em `/dev/sdX`:
  `scripts/create-test-sd-image.sh` → `artifacts/test-images/r36s-cyberdeck-minimal.img`
  (≈401 MiB). Reutiliza kernel/uInitrd/DTB do ArkOS + **copia a região de
  bootloader RK3326** (idbloader+U-Boot, setores 64..32767) da imagem ArkOS
  (somente leitura).
- **Rootfs mínimo próprio** (`board/r36s/rootfs-overlay/` + BusyBox aarch64 1.36.1):
  `/sbin/init`→busybox, `/etc/inittab` (shells em `ttyFIQ0` e `tty1`), `rcS`
  (monta proc/sys/devtmpfs, banner "R36S CyberDeck OS minimal rootfs"), `fstab`,
  `issue`, `os-release`, nós de `/dev` e ownership `root:root` via **fakeroot**
  (sem sudo). Construído com `mke2fs -d` (ext4 populada sem montar).
- **`boot.ini` de teste** (`board/r36s/boot/boot.ini`): baseado no ArkOS, sem
  `quiet`/`splash`, mantém `console=/dev/ttyFIQ0`/`fbcon=rotate:0`/`consoleblank=0`,
  `root=UUID=c1be7dec-…` (nossa p2), `init=/sbin/init`, `rootfstype=ext4`, `loglevel=7`.
- Scripts novos: `create-minimal-rootfs.sh`, `prepare-boot-partition.sh`,
  `prepare-rootfs-partition.sh`, `create-test-sd-image.sh`, `print-flash-command.sh`
  + `phase2-config.sh` (constantes/UUID/geometria compartilhadas).
- Docs: `docs/boot/minimal-rootfs-boot-plan.md` (estratégia + análise do uInitrd
  LZ4 + planos B), `docs/boot/sd-card-test-layout.md` (layout, gravação,
  **rollback**), `docs/testing/phase2-boot-checklist.md`.
- `.gitignore`: ignora `artifacts/test-images/build/` e `*.img`; versiona reports.
- **Não** usa WPE/Cage/Weston/Node/EmulationStation/RetroArch/GUI ainda.
- Pendente: gravar em microSD e bootar no R36S físico (teste do usuário).

### Changed — 2026-06-14 — Fase 1 concluída: extração e confirmação real
- `mtools` instalado → leitura da p1 FAT **sem sudo e sem montar**.
- `extract-arkos-boot-artifacts.sh` reescrito: suporta dois modos (mount RO **ou**
  mtools/mcopy direto na FAT). Extraídos `boot.ini`, `Image`, `uInitrd` e os 3 DTBs.
- `identify-r36s-dtb.sh` executado: gerou `docs/hardware/device-tree-analysis.md`
  com dados reais e salvou o `.dts` decodificado em
  `artifacts/arkos-reference/reports/rk3326-r35s-linux.dts`.
- **Confirmações/correções** nos docs de hardware:
  - Kernel **Linux 4.4.189** (`#192`, 2025-07-09); `uInitrd` = uImage RAMDisk gzip.
  - `boot.ini` real: `root=UUID=e139ce78…`, console **`/dev/ttyFIQ0`** (não ttyS1),
    `fbcon=rotate:0`, carrega de `mmc 1:1`, `booti`.
  - Joypad real = **`odroidgo3-joypad`** ("GO-Super Gamepad"), **17 botões GPIO** +
    2 analógicos — mapa `linux,code` completo em `docs/hardware/input-buttons.md`.
  - Painel `elida,kd35t133` 4 lanes DSI; VOP/DSI `px30-vop-big`/`px30-mipi-dsi`.
- `.gitignore` ajustado: versiona `boot.ini`/`.dts`/relatórios (texto); ignora os
  binários grandes (`Image`, `uInitrd`, `*.dtb`).

### Added — 2026-06-14 — Bootstrap do projeto (Fase 1)
- Repositório `R36S-CyberDeck-OS` criado com estrutura inicial.
- **Scripts de inspeção** (read-only da imagem ArkOS):
  - `scripts/inspect-arkos-image.sh` — layout de partições, offsets, relatório MD.
  - `scripts/mount-arkos-readonly.sh` — loop mount somente leitura (p1/p2) + cleanup.
  - `scripts/extract-arkos-boot-artifacts.sh` — copia kernel/DTB/boot configs.
  - `scripts/identify-r36s-dtb.sh` — decodifica DTBs (dtc) → device-tree-analysis.md.
  - `scripts/create-sd-layout.sh`, `scripts/flash-test-sd.sh` — placeholders seguros.
- **Documentação inicial**: `README.md`, `docs/architecture.md`, `docs/roadmap.md`,
  `docs/hardware/*` (inventário, device-tree, display, input, boot-flow),
  `docs/graphics/*` (kiosk stack, DRM/KMS), `docs/web-ui/*` (runtime, UI arch),
  `docs/buildroot/strategy.md`, `docs/testing/r36s-physical-test-plan.md`,
  `docs/boot/boot-flow.md`.
- **CyberDeck UI** (`cyberdeck-ui/`): v1 HTML/CSS/JS, 640×480, navegação por botões.
- **Runtime**: `cyberdeck.service` + `start-cyberdeck-ui.sh` (Cage+WPE, fallbacks).
- **Inventário de hardware** consolidado da imagem ArkOS (RK3326, Mali-G31,
  RK817, painel `kd35t133`, joypad odroidgo2, 2× microSD) — fonte: inspeção
  read-only e device-tree.
- Relatório inicial da imagem ArkOS gerado em `artifacts/arkos-reference/reports/`.

### Notas
- A imagem ArkOS é tratada como **somente leitura** — nunca modificada.
- Projeto **independente** do `arkos-r36s-dev-lab` (laboratório separado).
- Alvo final: **R36S físico**. QEMU é só auxiliar de desenvolvimento.
