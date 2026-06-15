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

## Fase 4 — Runtime web (WPE) com blob Mali  ◄ **BLOQUEADA (achado documentado)**
Plano: `docs/web-ui/phase4-wpe-plan.md`. Resultado em
`docs/testing/results/phase4-2026-06-15.md`.
- [x] **4a** — rootfs **Debian arm64 bootou** no R36S.
- [x] **4b** — Mali EGL/GLES wired; cog DRM **inicializa e a `index.html` CARREGA**.
- [~] **4c** — bloqueado: cog DRM **segfaulta no swap de buffer**; `cage`/wlroots nem
      carrega: o **blob Mali (2020) tem GBM antigo** (sem `gbm_bo_get_offset`),
      incompatível com WPE/wlroots do bookworm. **Não há flag que resolva.**
- **Conclusão:** web acelerada neste hardware exige driver Mali **aberto e moderno**
  → ver Fase 5. (O renderizador nativo `cyberdeck-fb` segue como UI funcional.)

## Fase 5 — Runtime web NA TELA  ◄ **✅ VENCIDA (via BSP + X11 + Chromium)**
A UI HTML/JS renderiza no R36S! Caminho vencedor: **kernel BSP** (painel acende) +
**Xorg fbdev** + **Chromium kiosk** com a `cyberdeck-ui` (`scripts/build-x11-rootfs.sh`,
imagem `x11`). Detalhes/lições: `docs/testing/results/phase5-x11-2026-06-15.md`.
- [x] UI web exibindo no aparelho físico.
- [ ] Ponte de input joypad→teclas (navegar pelos botões).
- [ ] Dados ao vivo + brilho na UI.
Becos sem saída documentados (não apagar — são conhecimento): web por Wayland/cog
travou no GBM do blob Mali (Fase 4); mainline+Panfrost não dirige o painel deste
lote (`docs/testing/results/phase4-2026-06-15.md`, `phase5-mainline-panfrost-plan.md`).

## Fase 5b — (arquivada) Kernel mainline + Panfrost + Mesa
Plano: `docs/mainline/phase5-mainline-panfrost-plan.md`. Troca o BSP 4.4 + blob Mali
por **mainline 6.x + Panfrost + Mesa** (GBM/EGL/GLES modernos) — aí o `cog`/`cage`
renderiza a UI. Estratégia: **reusar kernel+DTB de distro R36S mainline** (Arch-R/
nixos-r36s) + rootfs Debian Mesa Panfrost.
- [ ] Obter Image + `rk3326-r36s.dtb` + módulos mainline.
- [ ] BOOT mainline (boot.ini novo; testar U-Boot do ArkOS com kernel mainline).
- [ ] Rootfs: remover blob Mali, instalar Mesa Panfrost + módulos do kernel.
- [ ] `cage`+`cog --platform=wl` renderiza `cyberdeck-ui` (GBM do Mesa resolve).
- [ ] Re-mapear joypad (mainline = gpio-keys/adc-joystick).

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
