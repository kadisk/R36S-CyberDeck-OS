# Changelog — R36S CyberDeck OS

Formato baseado em [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Changed — 2026-06-16 — Cores fixas p/ referências de botão + bump 0.7.0
- Referências a botões agora têm **cor fixa e negrito**: **A** vermelho, **B** amarelo,
  **X** azul, **Y** verde; demais (L1/R1/L2/R2/FN/Start/Select) **negrito branco**.
  Helper `CD.ui.btnize` aplicado no rodapé, modal de confirmação, menu FN e hints.
- **Versão → 0.7.0** (ui+agente): agrupa tudo desde a 0.6.0 (que está no aparelho) —
  os próximos screenshots caem em `v0.7.0/`.

### Changed — 2026-06-16 — Menu FN com POWER inline + ícones
- As ações de energia (Recarregar UI, Reiniciar agente/kiosk/sistema, Desligar) agora
  ficam **inline no próprio menu FN** (não navegam mais para uma tela POWER). Reiniciar
  kiosk/sistema e Desligar têm destaque vermelho; todas pedem confirmação.
- Cada item do menu FN tem **ícone + nome** (`= Ajustes`, `@ Auto screenshot`,
  `# Screenshot`, `> / !` para energia) e seção **ENERGIA**.
- A view/aba **POWER foi removida** (redundante).

### Fixed — 2026-06-16 — Polimento pós-validação no R36S (v0.6.0 no aparelho)
- **Tag [SAFE]/[DIAG] do CMD não trunca mais** (vista cortada como "[SAF…" no aparelho):
  coluna mais larga + fonte menor. FS type idem.
- **Separadores mais leves** (kv/linhas) — menos ruído visual (relatório V4).
- Microcopy: "N serviços em falha" (singular/plural) no alerta de saúde.
- Validado no R36S físico (v0.6.0): HOME cockpit, menu FN→POWER, foco refinado, subpáginas
  L1/R1, CMD drill-down e screenshots versionados/sequenciais funcionando.

### Changed — 2026-06-16 — Screenshots organizados por versão da UI
- Os prints agora ficam em **subpasta por versão**: `/root/screenshots/v0.6.0/shot-0001.png`…
  A UI envia `CD.VERSION` no `POST /api/screenshot`; o agente sanitiza (bloqueia path
  traversal → `vunknown`) e numera sequencialmente **dentro de cada versão**.
- `sd-get-screenshots.sh` copia a árvore inteira (preserva as pastas de versão) e resume por
  versão; `sd-clear-screenshots.sh` apaga `*.png` recursivamente e remove pastas vazias.

### Added — 2026-06-16 — Menu FUNCTION (FN), auto screenshot, screenshots sequenciais, semver
- **Botão FN abre o menu FUNCTION**: contém **AJUSTES** e **POWER** (saíram da barra de
  abas) + **Auto screenshot** (liga/desliga) + Screenshot agora. FN/B fecha. Mostra a versão.
- **Auto screenshot**: captura a **cada mudança de tela** (navegação: aba/subpágina/página/
  origem/voltar), em silêncio (sem toast na foto). Desarma reentrando no menu FN.
- **Screenshots sequenciais**: `shot-0001.png`, `0002`… (numeração crescente lendo a pasta;
  a data/RTC do R36S não é confiável).
- **Versionamento semver**: ui+agente em **0.6.0** (package.json); agente expõe em
  `/api/ping`, UI em `CD.VERSION` (no rodapé do menu FUNCTION).
- **Fix do rodapé sumindo ao aumentar a fonte**: o zoom da fonte agora é aplicado a um
  wrapper interno (`#screen`), mantendo `#content` com altura fixa e scroll — o rodapé fica.
- **Fonte padrão um pouco maior** (base 16→17; títulos/linhas/boxes +1).
- Validado por render headless (rodapé presente em fonte 1.6; menu FUNCTION; ping v0.6.0).
  Não testado no R36S físico.

### Changed — 2026-06-16 — Polimento visual (relatório UX V4): foco refinado, HOME cockpit
- **Foco refinado** (o maior ganho): em vez de bloco ciano preenchido, item focado ganha
  **barra lateral ciano + fundo sutil**, mantendo o texto legível. Vale p/ linhas, cards,
  chips, subtabs e alertas. Resolve a cara de "debug UI".
- **Saída (CMD/LOGS/arquivo) não fica mais ciano cheio**: `pre/.box` em foco ganham só
  uma borda ciano fina (fundo escuro).
- **Aba ativa = underline ciano + fundo sutil** (não mais barra verde preenchida).
- **HOME vira cockpit**: removido o título-herói redundante; **metric tiles** (CPU/RAM/
  TEMP/BAT com barras e cor por severidade) + alert strip + atalhos.
- **NET checklist** usa `✓ / × / ?` (mais legível que `[x]/[!]`).
- **Subabas do STATUS** em PT: AO VIVO / ENERGIA / TENDÊNCIA.
- Validado por render headless. Não testado no R36S físico. Pendente (V4): aprofundar
  painéis/microcopy nas demais telas.

### Changed — 2026-06-16 — Mais espaço p/ listas, L1/R1 = página/origem, A no gamepad, POWER separado
- **L1/R1 agora paginam/trocam origem** na seção ativa: PROCS/FS/SVC paginam (página no
  título, sem barra ocupando espaço), LOGS troca a **origem** (dmesg/journal/agent/kiosk/ui
  virou **abas**/subbar). Mecanismo genérico `view.lr(dir)`.
- **PROCS**: resumo em 1 linha + 1 linha de filtros (sort vira chip que cicla) → mostra ~10
  processos por página em vez de ~6.
- **LOGS**: origem como subbar + severidade/pausa em 1 linha (antes 2 linhas de chips).
- **SVC**: resumo compacto (estado + contagem em 1 linha), 11 por página.
- **A no gamepad corrigido**: ao trocar de seção o ponteiro some (modo foco) e o **A clica
  só em focável sob o ponteiro — senão ativa o item SELECIONADO**. Resolve "não rodava
  comando pelo pad, só pelo ponteiro" e "clicava onde o mouse estava".
- **↑ chega à barra de abas** (menu superior): no topo do conteúdo, ↑ foca a aba ativa;
  ←→ troca de aba ali; ↓ volta ao conteúdo.
- **TOOLS → AJUSTES** (só display/áudio/fonte) e nova aba **POWER** (recarregar/reiniciar/
  desligar, com Danger Zone) — separa energia das ações do dia a dia.
- Validado por render headless. **Não testado no R36S físico** (aparelho ainda na V3 parte 1).

### Fixed — 2026-06-16 — Screenshot move p/ L2+R2 (não conflita com subpáginas L1/R1)
- Como **L1/R1** passaram a trocar subpágina, o combo de screenshot **L1+R1** trocava a
  subpágina ao tirar o print. Movido para **L2+R2** (combo). L1/R1 ficam só p/ subpáginas.
  Mapas RAW/STD ganham L2/R2; dica em TOOLS e README atualizadas.

### Changed — 2026-06-16 — LOGS detalhe por linha + NET checklist (relatório UX V3, parte 3 — fim)
- **LOGS**: cada linha agora é **focável** e abre um **detalhe** (A) — badge de severidade,
  origem, timestamp extraído (QUANDO) e mensagem em box; **B** volta à lista. Lista reduzida
  p/ 150 linhas (perf) e refresh pausado enquanto no detalhe.
- **NET**: vira **checklist de diagnóstico** compacto — estado ONLINE/OFF + IP/gateway/DNS +
  `[x]/[!]` para interface detectada / link ativo / IP / gateway / DNS (filtra `lo` e DNS
  stub `127.*`). Mantém o botão de conexões (`ss`).
- Conclui o relatório V3 (mínimo scroll): partes 1 (subpáginas) + 2 (paginação) + 3 (detalhe/checklist).
- Validado por render headless (NET checklist OFF, LOGS detalhe da linha de erro). Não testado no R36S físico.

### Changed — 2026-06-16 — Paginação de listas + CMD por categoria (relatório UX V3, parte 2)
- **Paginação** (componente `CD.ui.pager` + barra `‹ ant · pág X/Y · próx ›` focável) em
  **FS** (9/pág), **PROCS** (7/pág) e **SVC** (8/pág) — listas longas deixam de rolar; a
  página reseta ao navegar/trocar filtro e é mantida no refresh ao vivo.
- **CMD por categoria** (drill-down): nível 1 mostra cards de categoria; A entra e lista os
  comandos da categoria; B volta às categorias (e da saída volta aos comandos).
- **Fonte padrão um pouco maior** (base 15→16; títulos/linhas/boxes +1) p/ leitura.
- Pendente (V3 parte 3): LOGS com detalhe por linha e NET como checklist de diagnóstico.
- Validado por render headless (FS pág 1/3, PROCS pág 1/2, CMD categorias). Não testado no R36S físico.

### Changed — 2026-06-16 — Subpáginas (L1/R1) p/ reduzir scroll (relatório UX V3, parte 1)
- **Subpáginas por seção** navegáveis com **L1/R1** (combo L1+R1 segue = screenshot; teclas
  `[` `]` no dev): cada tela densa vira seções que cabem em 640×480 sem rolar. Barra de
  subtabs no topo + dica no rodapé. Infra: `CD.subCycle`, `state.sub`.
- **HOME cabe em uma tela**: banner de saúde + alertas + **6 atalhos críticos**
  (STATUS/PROCS/LOGS/NET/SVC/TOOLS). As demais seções seguem na barra de abas (sem scroll).
- **STATUS** → **LIVE / POWER / TREND** (métricas ao vivo · bateria/brilho · sparklines).
- **DEVICE** → **ID / CPU / DISPLAY / BOOT / INPUT** (fim da lista longa rolável).
- **TOOLS** → **DISPLAY / AUDIO / SYSTEM / DANGER**: a Danger Zone (reboot/poweroff/
  restart-kiosk) agora fica numa subpágina **isolada** das ações do dia a dia.
- Validado por render headless (HOME 1 tela, DEVICE/STATUS/TOOLS subpáginas sem scroll).
  Não testado no R36S físico. **Pendente** (próxima parte do V3): paginação de listas longas
  (PROCS ALL, SVC ALL, FS), CMD por categoria e LOGS com detalhe por linha.

### Changed — 2026-06-16 — CMD/TOOLS/FS/DEVICE (relatório UX, fase 4)
- **CMD**: tags de risco por comando (**[SAFE]/[DIAG]**) e **saída unificada** com
  cabeçalho de status (OK/ERRO/TIMEOUT), `exit code` e **duração (ms)**. `exec` agora mede ms.
- **TOOLS**: separa **DANGER ZONE** (reboot/poweroff/restart — borda vermelha, confirmação)
  das ações normais (Brilho/Volume); mostra **barra de BRILHO** e a % de fonte atual.
- **FS**: **breadcrumb** compacto (`/ a > b > c`), **coluna de TIPO** (DIR/LINK/TXT/LOG/BIN…)
  e alvo do symlink inline.
- **DEVICE**: menos denso — cmdline/dmesg/módulos completos ficam na aba KERNEL (eram
  duplicados); DEVICE aponta para lá.
- Validado por render headless (CMD tags, TOOLS Danger Zone + barra, FS breadcrumb/tipo).
  Não testado no R36S físico.

### Changed — 2026-06-16 — Telas operacionais: LOGS/PROCS/SVC (relatório UX, fase 3)
- **LOGS** colore cada linha por **severidade** (heurística): erro/exit-code/failed em
  vermelho, warning em âmbar, resto apagado — falhas saltam à vista.
- **PROCS**: barras de CPU inline por processo (verde/âmbar/vermelho), filtro **"ativos"**
  como padrão (esconde kworker/threads em 0%) e legenda "CPU% é por núcleo (N cores)".
- **SVC**: serviços com **falha sempre no topo** da lista (depois rodando, depois o resto),
  para o problema não passar despercebido.
- Validado por render headless (PROCS com barras+ativos, LOGS colorido, SVC failed-first).
  Não testado no R36S físico.

### Added — 2026-06-16 — Histórico/sparklines + correção do ponteiro no boot (relatório UX, fase 2)
- **Ponteiro do X começa ESCONDIDO** e só aparece ao mover o analógico (antes aparecia no
  boot). Agora é por CSS (`cursor:none` padrão; classe `.pointer-on` ao mover), sem depender
  do repaint do Chromium; `mousemove` ignora o evento sintético do boot e micro-jitter.
- **Tendência por sparklines** (`js/history.js`, ring buffer 60 amostras alimentado pelo
  polling): STATUS ganhou seção TENDÊNCIA (CPU/RAM/TEMP/LOAD/BAT com `▁▂▃▄▅▆▇█`). Helper
  `CD.ui.sparkline`. Sem libs/canvas.
- Pequenos ajustes vindos dos prints reais: `LUZ`→`BRILHO`; SWAP/ZRAM mostra "inativo" em
  vez de "-1 MB" quando o zram está desligado (zram-swap failed no aparelho).
- Os helpers de formatação/severidade/componentes da fase 2 já viviam em `ui.js`
  (`CD.ui.fmt`, `CD.ui.level`, `h/kv/gauge/badge`) — mantido sem fragmentar em mais arquivos.
- Validado no host (node --check + render headless de STATUS com sparklines e do ponteiro
  oculto no boot). Não testado no R36S físico.

### Added — 2026-06-16 — Saúde do sistema na HOME + header com severidade (relatório UX, fase 1/P0)
- **`GET /api/health`** (`lib/health.js`): agrega status + resumo systemd (cacheado 10s) e
  devolve nível geral (ok/warn/crit) + alertas acionáveis `{level,label,target}` com régua
  de thresholds (temp/load-por-core/RAM/tensão de bateria).
- **HOME com banner de SAÚDE GERAL**: `SYS OK/WARN/CRIT` + linha de métricas + **alertas
  clicáveis** (ex.: "systemd degraded: zram-swap", "sem rede / sem IP") que abrem a aba alvo.
  Antes a HOME era só launcher; agora responde "o sistema está bem?" sem navegar.
- **Header vira barra de status com severidade**: `NET OFF` (warn), `load/cores`, `temp` e
  `bat` ganham cor ok/warn/crit (helper `CD.ui.level`, mesma régua do backend).
- **Bateria reordenada na STATUS**: estimativa/tensão em PRIMEIRO (`BAT ~79% · 3.92V`),
  raw `capacity` do rk817 em segundo plano e marcado quando instável.
- (correção) `sd-get-screenshots.sh` agora faz `chown` da árvore inteira (pasta base + grupo
  correto) — os prints deixam de vir como root.
- Validado no host (node --check; `/api/health` por curl; render do banner por harness
  headless com fetch stubado). Não testado no R36S físico.

### Changed — 2026-06-16 — UX a partir dos prints reais: navegação 2D, modos de input, bateria, menu
- **Navegação espacial 2D**: o D-pad/setas agora movem o foco para o vizinho mais próximo
  em qualquer direção (grid da HOME, toolbars, listas); ←→ na borda troca de aba. Antes só
  navegava em sequência. (correção do "menu inicial só acessa em sequência").
- **Dois modos de input**: usar o **D-pad esconde o ponteiro** e o **A ativa o item
  selecionado** (não depende mais do mouse); mexer no **analógico** mostra o ponteiro +
  *hover-select*; ocioso, o ponteiro some. (correção do "A só funciona com o mouse em cima").
- **Bug do screenshot**: o toast "capturando tela…" saía na própria captura — agora é
  escondido antes de capturar; espera o framebuffer repintar.
- **Menu reorganizado** por semântica (HOME + abas): **MONITOR** (STATUS/PROCS/NET/LOGS),
  **SISTEMA** (DEVICE/KERNEL/FS/SVC), **AÇÕES** (CMD/TOOLS), **DIAGNÓSTICO** (KEYS).
- **Bateria mais confiável** (rk817 tem fuel-gauge instável — pesquisa: capacity "gruda",
  vai a 100% ao carregar): estimativa por **tabela OCV** (1S LiPo, não-linear) + compensação
  **I·R** + suavização (EMA); expõe `ocv` e `capacity_trust`; a UI prioriza a estimativa
  quando o `capacity` é duvidoso. Solução "definitiva" (DT com ocv-table + ciclo de
  calibração) fica como nota; não mexemos no kernel/DTB.
- **Glyphs**: emoji/símbolos sem cobertura na fonte do fbdev (📷 ⟳ ∅ ⚠ ⏸ ▶ ★ ⚡) trocados
  por ASCII (o "📷" aparecia como quadrado). Estados de serviço (running/failed/dead) agora
  têm **cor** na lista SVC.
- `sd-get-screenshots.sh`: corrige `SD_NAME` não-associado (chama `sd_describe`) e passa a
  salvar **fora do repo** (`~/cyberdeck-screenshots/`, não em `artifacts/`).
- **Validado no host** (node --check + smoke headless: navegação 2D entre grupos, HOME
  agrupada, sem exceções). Screenshot/fbgrab e navegação **confirmados no R36S físico**
  (os prints foram gerados no aparelho). Bateria OCV e modos de input ainda **não testados
  no R36S físico**.

### Added — 2026-06-16 — Escala de fonte, screenshot, volume e aba KERNEL/DTB
- **Escala de fonte** configurável (TOOLS → DISPLAY/UI, ou teclas +/−): aumenta/diminui
  mantendo a proporção (zoom do `#content`). Persistida pelo agente em
  `/var/lib/cyberdeck/settings.json` (`GET/POST /api/settings`).
- **Screenshot** por combo **L1+R1** (ou F12/PrintScreen): `POST /api/screenshot` salva
  PNG em `/root/screenshots/` (fbgrab → fallback scrot). Novo
  `scripts/sdcard/sd-get-screenshots.sh <cartao>` recupera os prints p/ o host (rootfs RO).
- **Teclas de volume mapeadas**: `AudioVolumeUp/Down/Mute` chamam ações
  `volume-up/down/mute` (via `amixer`, allowlist em `actions.js`).
- **Aba KERNEL** (card na HOME, `GET /api/kernel`): kernel detalhado (version, cmdline,
  taint, printk, config, **módulos carregados** com tamanho/uso) + **Device Tree**
  (modelo, compatible, serial, bootargs, nós de topo — clicáveis abrem no FS).
- Build: adiciona `fbcat scrot alsa-utils`; FS ganha atalho `/root/screenshots`.
- Validado no host (node --check + smoke headless: TOOLS/KERNEL/cards, zoom de fonte,
  endpoints novos com erro gracioso). **Não testado no R36S físico.**

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
