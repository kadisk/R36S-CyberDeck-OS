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

## Fase 2 — Boot mínimo
- [ ] Reproduzir esquema de partição (p1 BOOT / p2 rootfs).
- [ ] Kernel + DTB rk3326 bootando até um shell (serial/HDMI-less).
- **Feito quando:** rootfs mínimo dá login no R36S físico.

## Fase 3 — Tela e input
- [ ] Painel MIPI-DSI `kd35t133` ativo (640×480) via DRM/KMS.
- [ ] Backlight controlável.
- [ ] Gamepad `odroidgo2-joypad` mapeado (16 botões + 2 analógicos).
- **Feito quando:** framebuffer/KMS visível e input lido.

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
