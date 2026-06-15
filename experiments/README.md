# experiments/ — tentativas e becos sem saída (preservados como referência)

Tudo aqui foi **tentado e não entrou na versão final**, mas é mantido de propósito
para futuros testes e melhorias. A narrativa completa (o que, por quê, como falhou)
está em [`../docs/JORNADA.md`](../docs/JORNADA.md). Estes scripts podem precisar de
ajuste de caminho para rodar de novo (foram movidos de `scripts/`).

## Fase 4 — runtime web acelerado (Wayland + blob Mali)
- `build-web-rootfs.sh` — rootfs Debian + `cog`/WPE.
- `extract-arkos-mali.sh` — extrai `libMali.so` (EGL/GLES/GBM) do ArkOS.
- `web-card-cage.sh`, `patch-web-card.sh` — variações com `cage`/wlroots.
- `start-cyberdeck-cog.sh`, `cyberdeck-cog.service` — lançar `cog --platform=drm`.

**Por que falhou:** o blob Mali (2020) tem **GBM antigo demais** (sem
`gbm_bo_get_offset`). `cog` DRM inicializa e a `index.html` chega a carregar, mas
segfalta no swap de buffer; `cage` nem carrega. Não há flag que resolva.
→ Detalhe: `../docs/testing/results/phase4-2026-06-15.md`.

## Fase 5b — kernel mainline + Panfrost + Mesa
- `build-mainline-rootfs.sh`, `extract-mainline-kernel.sh`, `build-panel-dtb.sh`.

**Por que falhou:** o **painel deste lote de R36S não sobe no kernel mainline**
(nem com Arch-R original, overlays de timing, ou MultiPanel). Só o **kernel+DTB BSP**
do ArkOS dirige o painel `elida,kd35t133`. Forçar só o DTB em outras imagens não basta
(kernel e DTB são acoplados). Scripts de painel relacionados ficaram em
`../scripts/sdcard/` (sd-apply-panel-dtb, sd-try-panel-overlay, sd-grab-panel-overlay,
sd-fix-panel-dtb) — ver o README de lá.
→ Detalhe: `../docs/mainline/phase5-mainline-panfrost-plan.md`.

## Agente de dados em C (`cyberdeck-agent-c/`) — substituído por Node
Primeira versão do agente de dados: servidor HTTP minúsculo em **C** (aarch64
estático) servindo JSON de `/proc`+`/sys`. Funcionava, mas foi **substituído por um
backend Node.js** (`../cyberdeck-agent/`) para alimentar **todas as abas** com mais
informação (hardware, SO, rede, logs, terminal, ações) e ser mais fácil de estender.
Mantido aqui como referência da abordagem enxuta.

## Ponte de input via uinput (dispensável)
- `cyberdeck-input/` — daemon C que lia o joypad e criava teclado virtual (uinput).
- `cyberdeck-input.service`.

**Por que saiu:** o **Chromium expõe o joypad direto pela Gamepad API**, então a UI
navega sem precisar de teclado virtual. Além disso, o módulo `uinput` provavelmente
não está no kernel BSP (nosso rootfs Debian não tem `/lib/modules` da 4.4). A
navegação final é feita em `cyberdeck-ui/public/app.js`.
