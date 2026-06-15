# Roadmap — R36S CyberDeck OS

Abordagem em fases. Cada fase tem um critério de "feito" verificável.

## Fase 1 — Inventário ArkOS / hardware  ◄ **CONCLUÍDA**
- [x] Localizar imagem ArkOS de referência (`Backups/ArkOS/...img`).
- [x] Layout de partições (p1 FAT BOOT / p2 ext4 rootfs / p3 exFAT roms).
- [x] Inventário de hardware consolidado (`docs/hardware/`).
- [x] Extrair kernel/DTB/boot configs para `artifacts/` (via mtools, sem sudo).
- [x] Decodificar DTB ativo e confirmar `model`/`compatible`
      (`rockchip,rk3326-odroidgo3-linux`), `boot.ini`, kernel 4.4.189,
      mapa real do joypad `odroidgo3-joypad` (17 botões).
- **Feito:** docs/hardware/* completos e confirmados pelo DTB/boot.ini reais.
- Pendente menor (não bloqueia Fase 2): offset/origem do U-Boot antes da p1.

## Fase 2 — Boot mínimo  ◄ **CONCLUÍDA ✅ (boot confirmado no R36S físico)**
- [x] Reproduzir esquema de partição + bootloader (via **clone do MBR/boot do ArkOS**).
- [x] Reutilizar kernel/uInitrd/DTB do ArkOS; `boot.ini` próprio com logs visíveis
      (`console=tty1`) e `root=UUID` da nossa rootfs.
- [x] Rootfs mínimo próprio (BusyBox aarch64) com init/inittab/rcS/banner.
- [x] Geração da imagem `.img` por script, sem root e sem gravar em `/dev/sdX`.
- [x] **Boot confirmado no R36S físico** (2026-06-15) — ver
      `docs/testing/results/phase2-2026-06-15.md`.
- [x] Coleta automática de hardware no boot (grava na BOOT) para alimentar a Fase 3.
- **Aprendizado-chave:** NÃO recriar o MBR (sfdisk não bootou — tela apagada);
  **clonar o MBR+bootloader+FAT do ArkOS** e trocar só `boot.ini`+rootfs.

## Fase 3 — Tela e input  ◄ **NÚCLEO FUNCIONANDO no R36S ✅**
- [x] Painel ativo 640×480 (fbcon/`/dev/fb0`, **32bpp**); `/dev/dri/card0` presente.
- [x] **Renderizador 2D próprio** (`cyberdeck-fb`) desenhando UI no framebuffer.
- [x] Gamepad `odroidgo3-joypad` (`/dev/input/event1`) **mapeado e navegando** a UI.
- [x] **Backlight controlável** (L2/R2 → `/sys/class/backlight/backlight/brightness`).
- [x] Bateria (RK817) lida no STATUS (`/sys/class/power_supply`).
- [ ] Ações A/B (abrir seção / voltar) e mais seções (rede, logs, ferramentas).
- [ ] (futuro) double-buffering via KMS (`/dev/dri/card0`) p/ evitar flicker.
- **Confirmado:** UI na tela navegável pelos botões do R36S (2026-06-15).

## Fase 4 — Runtime web
- [ ] Escolher runtime (WPE WebKit preferido — ver `docs/web-ui/runtime-options.md`).
- [ ] Renderizar uma página HTML em fullscreen no aparelho.
- **Feito quando:** `index.html` aparece em kiosk no R36S.

## Fase 5 — UI CyberDeck
- [ ] Seções: terminal, CPU/RAM, rede, bateria, relógio, logs, comandos, device.
- [ ] Navegação por botões/teclado.
- [ ] Camada de dados do sistema (`/proc`, `/sys`, rk817).
- **Feito quando:** UV utilizável só com os botões do R36S.

## Fase 6 — Buildroot image
- [ ] `r36s_cyberdeck_defconfig` gera imagem de SD completa.
- [ ] BR2_EXTERNAL com pacotes da UI + runtime + serviço.
- **Feito quando:** `make` produz `cyberdeck-os.img` flashável.

## Fase 7 — Teste em SD card
- [ ] Gravar SD e bootar no R36S real.
- [ ] Plano de teste de `docs/testing/r36s-physical-test-plan.md` executado.
- **Feito quando:** checklist de teste físico passa.

## Fase 8 — Otimização
- [ ] Tempo de boot, consumo, brilho, suspensão, leitura de bateria.

## Fase 9 — Substituição completa da base ArkOS
- [ ] Rootfs 100% próprio; ArkOS deixa de ser necessário até como referência.
