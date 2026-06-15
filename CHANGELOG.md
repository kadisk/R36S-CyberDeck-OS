# Changelog — R36S CyberDeck OS

Formato baseado em [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

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
