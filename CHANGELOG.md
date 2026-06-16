# Changelog — R36S CyberDeck OS

Formato baseado em [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Changed — 2026-06-15 — UI com fontes maiores + ponteiro mais suave
- **Fontes aumentadas** em toda a CyberDeck UI p/ leitura no aparelho (base 13→15px;
  abas/cards/listas/kv/boxes proporcionalmente). Alturas das barras fixas ajustadas
  (topbar 24→28, tabs 26→30, footer 22→26) e `#content` recalculado (404→393px). O
  layout 640×480 não quebra — conteúdo extra rola. Validado por screenshot headless.
- **Ponteiro mais suave/fácil de controlar:** `60-joystick.conf` agora usa `deadzone`
  grande (12000) + `ConstantDeceleration 3` + `AccelerationProfile -1` (linear). Ajuste
  fino ao vivo via `xinput --set-prop … "Device Accel Constant Deceleration"` (sem reflashar).

### Changed — 2026-06-15 — Ponteiro REAL do X movido pelo analógico esquerdo (fim do cursor virtual)
- O **analógico esquerdo passa a mover o ponteiro real do X**, não mais um cursor
  desenhado pela UI. Mecanismo nativo do X: driver `xserver-xorg-input-joystick` +
  `/etc/X11/xorg.conf.d/60-joystick.conf` (eixos 1/2 → motion relativo). É **aditivo** e
  não faz `EVIOCGRAB`, então a Gamepad API (D-pad/A/B) continua funcionando.
- Xorg sobe **sem `-nocursor`** (ponteiro visível); CSS deixa de esconder o cursor.
- UI removeu o `#vcursor` e a lógica de cursor virtual; agora **rastreia o ponteiro real**
  (`mousemove`) e **A clica** onde ele está (senão ativa o item focado; Start sempre ativa).
- ⚠️ Índices de eixo/deadzone podem precisar de ajuste no aparelho (`evtest`/`xinput`).
  **Não testado no R36S físico.**

### Changed — 2026-06-15 — CyberDeck UI vira mini-ambiente operacional + backend modular
- **Backend modularizado** (`cyberdeck-agent/agent.js` roteador + `lib/*.js` por
  domínio: http, exec, status, device, fsbrowse, systemd, processes, network, logs,
  commands, actions). Sem deps. Contrato JSON consistente `{ok,data}` / `{ok,error}`.
- **Segurança:** `/api/exec` com comando livre **removido**. Comandos (`CMD`) e ações
  (`TOOLS`/`SVC`) agora são **allowlist** validadas no backend; tudo via `execFile`
  (sem shell). Navegação FS é **read-only** com path saneado (sem `../` p/ fora da raiz),
  limites de tamanho/entradas e detecção de binário. Unit/sinal validados.
- **Novos endpoints:** `fs/{list,read,bookmarks}`, `systemd/{summary,services,service,
  logs,action}`, `processes` + `:pid` + `signal`, `network/{summary,connections}`,
  `logs` (fontes + severidade + busca), `commands`/`actions` (listas + exec).
- **UI reestruturada** (`cyberdeck-ui/public/js/*`: state, api, ui, views, gamepad) —
  scripts globais (`window.CD`), sem ES modules (compatível com `file://`).
- **Tela HOME com cards** (grid navegável por gamepad) como entrada.
- **DEVICE expandida** (identity/hardware/freq por core/temps/kernel/tela/input USB+joypad).
- **Novas abas:** **FS** (navegar rootfs read-only + viewer), **SVC** (systemd
  resumo→lista→detalhe→logs→ações), **PROCS** (processos via `/proc`, ordenação/filtro→
  detalhe→sinais), **CMD** (allowlist por categoria), **NET**/**LOGS** enriquecidas.
- **Mestre→detalhe** com B voltando um nível; **modal de confirmação** em tela cheia
  para ações perigosas; estados OK/warn/crit/loading/error e **erro amigável** quando o
  agente está offline. Scripts de deploy (`build-x11-rootfs.sh`, `sd-update-ui.sh`)
  atualizados para copiar `lib/`.
- **Validado no host** (Ubuntu): `node --check` em todo o backend; smoke test headless
  (Chrome) das 11 telas sem exceções + cenário agente OFF. **Ainda não testado no R36S físico.**

### Added — 2026-06-15 — Logo de boot CyberDeck (welcome) no lugar do logo.bmp do ArkOS
- **`welcome.png` vira o logo inicial de boot.** Convertido p/ o formato que o U-Boot
  do R36S espera (BMP 640×480, 24-bit, sem compressão — idêntico ao `logo.bmp` original,
  921654 B). Fonte e BMP versionados em `board/r36s/boot/` (`welcome.png`, `logo.bmp`),
  regeráveis por `board/r36s/boot/make-logo.sh`.
- build-x11 grava o welcome na BOOT (substitui `logo.bmp` **e** `logo_kernel.bmp`).
- `scripts/sdcard/sd-set-logo.sh`: troca o logo num cartão já gravado, sem rebuild
  (guarda backup `.arkos.bak` do original).

### Added — 2026-06-15 — Cursor analógico, scroll, terminal fullscreen, aba SERVIÇOS, bateria real
- **Analógico esquerdo = cursor virtual** (desenhado pela UI; JS não move o ponteiro
  do SO, mas a UI é o kiosk inteiro). **A clica** onde o cursor aponta (este joypad
  não tem clique de analógico). **Analógico direito = scroll** (vertical ↑↓ e horizontal ←→).
- **L1/R1 não navegam abas** — só D-pad ←→ (a pedido).
- **TERMINAL**: saída em **tela cheia**; **B** volta aos comandos.
- **LOGS**: mostra os ÚLTIMOS eventos (rola p/ o fim) e **atualiza sozinho**; agente
  passa a expor `dmesg` + `journalctl`.
- **Nova aba SERVIÇOS** (`/api/systemd`): estado do sistema, tempo de boot
  (`systemd-analyze`), serviços rodando e falhos.
- **Bateria corrigida/diagnosticada**: o `capacity` do rk817 fica travado (ex.: 100%)
  por falta de calibração; o agente passa a expor **tensão, corrente, capacity_level**
  e uma **estimativa por tensão** (1S LiPo) que de fato varia. UI mostra V + estimativa.

### Added — 2026-06-15 — Todas as abas funcionando + backend Node.js (cyberdeck-agent)
- **Agente reescrito em Node.js** (`cyberdeck-agent/agent.js`, sem dependências) —
  substitui a versão em C (movida p/ `experiments/cyberdeck-agent-c/`). Endpoints:
  `/api/status` (CPU/RAM/load/uptime/temp/bateria/brilho/rede, polling 2 s),
  `/api/device` (hardware+SO completo), `/api/network` (interfaces/rotas/gateway/SSID/DNS),
  `/api/logs` (dmesg), `POST /api/exec` (terminal), `POST /api/action` (brilho±/reload/
  reboot/poweroff). Roda como root → lê tudo e executa ações. Bind só em 127.0.0.1.
- **UI: todas as 7 abas funcionais** (STATUS, DEVICE, REDE, LOGS, TERMINAL, FERRAMENTAS,
  TECLAS). DEVICE mostra todo o hardware/SO; REDE detalhada; LOGS via dmesg; TERMINAL
  com comandos prontos selecionáveis pelo gamepad (sem teclado); FERRAMENTAS executa
  ações no agente. Indicador "agente: ON/OFF" no rodapé.
- build-x11: instala `nodejs iproute2 wireless-tools` + `agent.js` em
  `/usr/local/lib/cyberdeck-agent/`. `sd-update-ui.sh` agora sincroniza UI **e** o agent.js.

### Changed — 2026-06-15 — Consolidação: foco na versão que funciona + jornada documentada
- **README.md (raiz) reescrito** focado na distro funcional: o que é, **base**
  (Debian bookworm + boot BSP clonado do ArkOS + Xorg fbdev + Chromium + Gamepad API
  + cyberdeck-agent) e **como foi montada** (pipeline do `build-x11-rootfs.sh`).
- **`docs/JORNADA.md`**: narrativa completa de TODAS as tentativas (Fases 1→5), o que
  funcionou e o que falhou **e por quê** — para futuros testes/melhorias.
- **`experiments/`**: scripts dos becos sem saída movidos p/ lá (Wayland/cog/Mali da
  Fase 4; mainline/Panfrost da 5b; ponte uinput) com README explicando cada um.
  `scripts/` enxuto, focado no caminho final. Roadmap reescrito (sem fases duplicadas).

### Added — 2026-06-15 — UI viva: dados do sistema ao vivo (cyberdeck-agent)
- **`cyberdeck-agent`** (servidor HTTP em C, aarch64 estático) em `127.0.0.1:8080`:
  lê `/proc` + `/sys` (rk817) e devolve JSON (CPU%/RAM/load/uptime/temp/bateria/
  brilho/rede) com CORS liberado. `app.js` faz `fetch` a cada 2 s e atualiza
  STATUS/REDE/topbar. UI segue por `file://` (sempre renderiza). Validado via qemu.

### Added — 2026-06-15 — UI navegável pelo gamepad (Gamepad API) + aba TECLAS
- Navegação **direta pela Gamepad API** do Chromium (dispensa uinput). Mapa do joypad
  confirmado no aparelho: A=1,X=2,Y=3,L1=4,R1=5,R2=6,↑=8,↓=9,←=10,→=11,Select=12,
  Start=13,Fn=16,B=0. L1/R1+D-pad ←→ = abas; ↑↓ = foco; A/Start = ok; B/Select = voltar.
- Aba **TECLAS**: dump ao vivo de teclas/botões/eixos (diagnóstico de input).
- `sd-update-ui.sh`: empurra só a UI (HTML/JS) no cartão por nome, sem rebuild.

### Added — 2026-06-15 — Fase 5 VENCIDA: UI web na tela do R36S (BSP + X11 + Chromium) 🎉
- **A CyberDeck UI (HTML/JS) renderiza no R36S físico!** Objetivo web original
  alcançado. Caminho: kernel BSP 4.4 (painel acende, via clone do boot ArkOS) +
  rootfs Debian + Xorg (fbdev /dev/fb0) + Chromium kiosk com a cyberdeck-ui.
  `scripts/build-x11-rootfs.sh` (imagem `x11`); runtime start-cyberdeck-x.sh +
  cyberdeck-kiosk.sh + cyberdeck-x.service + xorg fbdev.
- Evita os 2 muros: Wayland/GBM do blob Mali (Fase 4) e painel do mainline (Fase 5a).
- Builds acelerados: eatmydata (pula fsync), MAKEFLAGS=-j(nproc), apt paralelo, xz -T0.
- Kit SD: catalogo de distros (sd-catalog), sd-update por nome, allowlist de cartoes,
  sd-fix-panel-dtb (forca DTB do painel). Resultado em docs/testing/results/phase5-x11-2026-06-15.md.


### Added — 2026-06-15 — Fase 5 planejada: mainline + Panfrost (decisão)
- Fase 4 (WPE com blob Mali) **bloqueada**: validado até a `index.html` CARREGAR no
  cog DRM, mas segfault no swap de buffer; `cage`/wlroots nem carrega
  (`undefined symbol: gbm_bo_get_offset`). Causa (objdump nos blobs): o **GBM do
  blob Mali (2020) é antigo demais** (24 símbolos, sem `gbm_bo_get_offset`) p/ o
  WPE/wlroots do bookworm. Documentado em `docs/testing/results/phase4-2026-06-15.md`.
- **Decisão (escolha do usuário): Fase 5 — kernel mainline 6.x + Panfrost + Mesa**
  (stack aberto, GBM/EGL modernos). Plano em
  `docs/mainline/phase5-mainline-panfrost-plan.md`, fundamentado nas distros R36S
  open-source (Arch-R 6.12 LTS, nixos-r36s 6.19+). Estratégia: reusar kernel+DTB
  mainline (`rk3326-r36s.dtb`) + rootfs Debian Mesa Panfrost. Roadmap atualizado.

### Added — 2026-06-15 — Fase 4 (scaffolding): runtime web WPE/cog
- Plano `docs/web-ui/phase4-wpe-plan.md`: rootfs Debian arm64 + `cog`/`wpewebkit`
  + libMali (do ArkOS) renderizando a UI HTML/JS no DRM (`/dev/dri/card0`).
  Sub-etapas 4a (Debian boota) → 4b (Mali EGL + cog) → 4c (UI em kiosk).
- `scripts/build-web-rootfs.sh` (root): debootstrap Debian bookworm arm64 (2
  estágios, qemu) + instala `cog`+WPE + cyberdeck-ui + serviço; `--package` gera a
  `.img` (clone do boot ArkOS, p2 maior, rootfs por UUID).
- `scripts/extract-arkos-mali.sh` (root): extrai `libMali.so` (EGL/GLES/GBM) do
  rootfs ArkOS (ro) para `artifacts/arkos-reference/mali/` — provedor EGL da Mali-G31.
- `runtime/scripts/start-cyberdeck-cog.sh` + `runtime/services/cyberdeck-cog.service`:
  lançam `cog --platform=drm` com a UI em 640x480.
- Confirmado: Debian bookworm tem `cog`/WPE p/ arm64. **Nada disso roda no rootfs
  BusyBox atual** — é a virada para um rootfs completo. EGL/Mali é o risco a validar
  no aparelho.

### Added — 2026-06-15 — Fase 3: ações A/B (MENU ↔ DETALHE) + seções
- `cyberdeck-fb`: navegação em **dois níveis** — **A** abre a seção (tela cheia de
  detalhe), **B** volta ao menu. Seções preenchidas:
  - STATUS: CPU/load, RAM usada/total, uptime, **temperatura** (`thermal_zone0`),
    bateria, brilho.
  - DEVICE: modelo, SoC, GPU, tela, PMIC, joypad.
  - REDE: interfaces de `/sys/class/net` + estado (loopback se sem dongle).
  - LOGS: `dmesg | tail` (carregado ao abrir).
  - FERRAMENTAS: submenu navegável (Brilho ±, Recarregar UI, **Reiniciar**,
    **Desligar**) — A executa.
  - TERMINAL: placeholder (shell no serial por enquanto).
- L2/R2 (brilho) e F5 (sair) seguem globais. Removido o painel de debug de input
  (joypad já confirmado).

### Added — 2026-06-15 — Fase 3: UI navegável confirmada + brilho/bateria
- **Confirmado no R36S:** a UI nativa aparece na tela e **navega pelos botões**
  (`docs/testing/results/phase3-2026-06-15.md`). Núcleo da Fase 3 (tela+input) ok.
- `cyberdeck-fb`: adicionado **controle de brilho** (L2/R2 →
  `/sys/class/backlight/backlight/brightness`) e **leitura de bateria** (RK817 via
  `/sys/class/power_supply/{battery,ac,usb}`) no STATUS e na barra de título.

### Added — 2026-06-15 — Fase 3: renderizador 2D no framebuffer + dados do aparelho
- **Probe rodado no R36S** → dados reais (em `docs/hardware/device-captures/`):
  tela **640×480 32bpp** (stride 2560), `/dev/dri/card0` presente, backlight
  `brightness=80/160`; joypad = **`/dev/input/event1`** ("GO-Super Gamepad"),
  códigos batem 100% com o DTB (D-pad `0x220-3`, A/B/X/Y, L1/R1/L2/R2, F1–F5);
  analógicos `ABS_X/Y/RX/RY` (~±1800).
- **`cyberdeck-fb/`** — renderizador 2D em C, **aarch64 estático** (toolchain
  `aarch64-linux-gnu-gcc`): detecta geometria/bpp em runtime, desenha barra de
  título + relógio, menu lateral (STATUS/REDE/…/DEVICE), painel STATUS ao vivo
  (CPU/RAM/uptime/hora) e painel de debug de input; lê o joypad (`/dev/input/event*`)
  e navega (D-pad/L1/R1; F5 sai). Põe `tty1` em `KD_GRAPHICS`. Fonte 8×16 gerada de
  PSF (`tools/gen-font.py`).
- Integração: `create-minimal-rootfs.sh` compila e instala `/usr/local/bin/cyberdeck-fb`;
  `inittab` lança no `tty1` via `cyberdeck-launch.sh` (cai em shell na tela se sair).
- Probe (`phase3-probe.sh`) removido do boot automático (já cumpriu o papel).
- Docs: `docs/graphics/phase3-display-input-plan.md`, `cyberdeck-fb/README.md`,
  `input-buttons.md` atualizado com a captura real.

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
