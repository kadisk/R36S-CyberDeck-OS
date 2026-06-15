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
- [x] **Navegável pelo gamepad** — o Chromium expõe o joypad pela **Gamepad API**;
      `app.js` faz a navegação direta (L1/R1+D-pad ←→ = abas, ↑↓ = foco, A/Start =
      ok, B/Select = voltar). Mapa real confirmado: A=1,X=2,Y=3,L1=4,R1=5,R2=6,
      ↑=8,↓=9,←=10,→=11,Select=12,Start=13,Fn=16. **Não precisou de uinput.**
      Diagnóstico: aba **TECLAS** (dump ao vivo de botões/eixos). Push sem rebuild:
      `sd-update-ui.sh`. (A ponte `cyberdeck-input`/uinput ficou dispensável.)
- [x] **Navegável pelo gamepad** (Gamepad API; mapa confirmado no aparelho).
- [x] **Dados ao vivo na UI** + **todas as abas funcionando**, alimentadas pelo
      backend **Node.js** (`cyberdeck-agent/agent.js`): STATUS, DEVICE (hardware+SO),
      REDE, LOGS (dmesg), TERMINAL (comandos prontos), FERRAMENTAS (ações), TECLAS.
- **Feito quando:** ✅ UI web na tela, navegável pelos botões, todas as abas com dados.

> A narrativa completa (todas as tentativas e becos sem saída) está em
> [`JORNADA.md`](JORNADA.md). Os caminhos descartados (Wayland/Mali, mainline/Panfrost,
> ponte uinput) viraram conhecimento documentado e o código foi para `experiments/`.

---

## Próximos passos (melhorias sobre a versão que funciona)
- [ ] Brilho ajustável pela UI (escrever em `/sys/class/backlight/.../brightness`
      via uma ação do agente).
- [ ] Terminal real na aba TERMINAL (ponte pty/WebSocket).
- [ ] Otimizar boot (tempo, serviços) e RAM (zram já ativo).
- [ ] Ações de FERRAMENTAS (Wi-Fi dongle, reiniciar UI, desligar) ligadas ao agente.
- [ ] (futuro) Empacotamento reproduzível por Buildroot (`docs/buildroot/strategy.md`).
- [ ] (futuro, difícil) Rootfs 100% sem depender do boot ArkOS — exige resolver o
      painel fora do kernel BSP (hoje só o BSP acende). Ver [`JORNADA.md`](JORNADA.md).
