# Changelog — R36S CyberDeck OS

Formato baseado em [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

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
