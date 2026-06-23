# Especificação de funcionalidades da interface — R36S CyberDeck OS

**Status:** fonte da verdade, stack-agnóstica.
**Propósito:** descrever **tudo** que a interface do CyberDeck OS faz, independente da
tecnologia de render, para que qualquer stack (`web-vanilla`, `native-fb`, `web-react`, …)
possa ser construída/mantida em **paridade visual e funcional**.

A implementação de referência hoje é a [`web-vanilla`](../../interface/web-vanilla/)
(HTML/CSS/JS). Quando este documento e o código divergirem, **este documento é o alvo**;
ajuste o código (ou atualize o documento *antes*, se for mudança de comportamento).

Todas as interfaces consomem o **mesmo backend**, o [`cyberdeck-agent`](../../cyberdeck-agent/)
(`http://127.0.0.1:8080`, contrato `{ok,data}` / `{ok,error}`). A interface **não acessa
hardware diretamente** — sempre pede ao agente. Veja a [§7 Contrato do agente](#7-contrato-do-agente).

> Constraint de implementação (web): todas as views ficam **sempre no DOM**; a troca de tela
> é só a classe `.active`. Nunca dispare lógica pela mera existência de um elemento `#view-*`
> — teste `.active` (regressão real na v0.8.0: matou a navegação por gamepad). Em stacks
> nativas o equivalente é "view ativa = estado", nunca "view existe".

---

## 1. Princípios de UX (valem para todas as stacks)

1. **Cockpit, não console.** A tela inicial é a **HOME**: saúde do sistema + métricas ao vivo
   + atalhos. O usuário "pilota" o aparelho; não é um terminal.
2. **Mestre→detalhe** nas telas densas (FS, SVC, PROCS, LOGS, CMD): lista → detalhe; **B**
   sempre volta um nível interno antes de sair da tela.
3. **Dados ao vivo** por *polling* (`/api/status` a cada 2 s) + **lazy load** ao abrir cada
   tela. Listas longas são **paginadas** (não rolam infinito) para caber em 640×480.
4. **Degradação graciosa.** A UI **sempre renderiza**, mesmo sem agente: rodapé marca
   **agente: OFF** e cada tela mostra uma caixa de erro amigável, nunca trava.
5. **Dois modos de input** (ver §3): **FOCO** (D-pad — ponteiro some, A ativa o item
   selecionado) e **PONTEIRO** (analógico esquerdo — ponteiro reaparece, A clica nele).
6. **Confirmação para ações perigosas** (restart/stop/kill/reboot/poweroff): modal em tela
   cheia; **A** confirma, **B** cancela.
7. **Paridade visual** entre stacks: mesma paleta neon, mesma fonte mono, mesmas **cores
   fixas de botão** (§2).

---

## 2. Design tokens (paridade visual)

### Paleta (do `style.css`)
| Token | Hex | Uso |
|-------|-----|-----|
| `bg`        | `#06100a` | fundo principal |
| `bg2`       | `#0a1810` | fundo alternativo |
| `panel`     | `#0b1a12` | top bar, painéis, rodapé |
| `fg`/`ok`   | `#4dff9e` | texto principal (verde neon) |
| `fg-dim`    | `#2aa869` | texto secundário |
| `muted`     | `#1a6b44` | texto apagado |
| `accent`    | `#00e0ff` | marca, aba ativa, títulos (ciano) |
| `warn`      | `#ffd23d` | aviso (amarelo) |
| `crit`      | `#ff5566` | crítico (vermelho) |
| `line`/`line2` | `#154a30` / `#0f3220` | bordas/separadores |

### Cores fixas de botão (NUNCA mudam — usadas em hints, rodapé, modais, teste de botões)
| Botão | Cor | Hex |
|-------|-----|-----|
| **A** | vermelho | `#ff5566` |
| **B** | amarelo  | `#ffd23d` |
| **X** | azul     | `#5b8cff` |
| **Y** | verde    | `#4dff9e` |
| **L1/R1/L2/R2/FN/Start/Select** e **setas ←↑→↓** | branco | `#ffffff` |

### Tipografia / tela
- Fonte: **mono** (`DejaVu Sans Mono` no aparelho — sem emoji/símbolos raros; ícones em ASCII).
- Tela fixa **640×480**, sem overflow no `<html>`; só o conteúdo central rola.
- **Escala de fonte** ajustável 70%–180% (passo 10%), persistida no agente (`/api/settings`).
- Ícones de estado em ASCII: loading `...`, vazio `[ ]`, erro `/!\`.

### Casca (shell) — comum a todas as telas
- **Top bar** (28px): marca `R36S//CYBERDECK` + **badge do TIPO de interface** (`WEB`/`NATIVE`,
  canto superior esquerdo) · host · **NET ON/OFF** · temp · bateria · relógio. Mantida **enxuta**:
  sem `load` e sem IP (só ON/OFF da rede).
  - bateria: só **%** (+ `AC` quando carregando); usa estimativa OCV (`~NN%`) quando o `capacity`
    do rk817 é duvidoso; `<25%` amarelo, `<10%` vermelho.
- **Barra de abas** (30px): uma aba por seção com `tab:true`; ativa = sublinhado ciano.
- **Conteúdo** central rolável.
- **Rodapé** (26px): hints contextuais (botões coloridos) · estado do agente · última tecla.
- **Overlays:** modal de **confirmação**, menu **FUNCTION (FN)**, **toast** efêmero (2,6 s).

---

## 3. Contrato de input (gamepad + teclado)

### Mapeamento do gamepad (odroidgo3-joypad via Gamepad API)
Índices RAW confirmados no R36S: `B=0, A=1, X=2, Y=3, L1=4, R1=5, R2=6, L2=7, ↑=8, ↓=9,
←=10, →=11, Select=12, Start=13, FN=16`. Eixos: `0/1` = analógico esq., `2/3` = analógico dir.
(Há também um mapa "standard" para navegadores que reportam `mapping==="standard"`.)

| Controle | Ação |
|----------|------|
| **D-pad ↑↓←→** | navegação **espacial 2D** do foco (vizinho mais próximo na direção); nas bordas horizontais, **troca de aba**; ↑ na borda superior → barra de abas |
| **A** | modo FOCO: ativa o item focado. modo PONTEIRO: clica no que está sob o ponteiro (senão ativa o foco). No modal: confirma |
| **B** / **Select** | volta um nível (detalhe→lista→tela→HOME); fecha o menu FN; no modal: cancela |
| **Start** | ativa o item focado |
| **L1 / R1** | troca **subpágina/página** da seção ativa (paginação ou subabas; em LOGS troca a origem) |
| **L2 + R2** (combo) | **screenshot** (`/api/screenshot`; salvo em `/root/screenshots/v<versão>/shot-NNNN.png`) |
| **FN** | abre/fecha o menu **FUNCTION** (escopo de foco passa a ser o menu) |
| **Analógico esquerdo** | move o **ponteiro REAL do X** (fora do navegador, via driver joystick do Xorg) → modo PONTEIRO; ponteiro some após ~2,8 s sem uso |
| **Analógico direito** | **scroll** vertical do conteúdo (deadzone 0,20) |
| **Volume +/−** | volume do sistema (teclas de mídia → `/api/actions` volume) |

### Teclado (USB / desenvolvimento no PC)
`←↑→↓` = foco · `Enter`/`Start` = ativar · `Esc`/`Backspace` = voltar · `Tab` = próximo focável
· `f` = FN · `[` / `]` = subpágina · `PageUp/PageDown` = scroll · `+`/`−` = escala de fonte
· `F12`/`PrintScreen` = screenshot · `AudioVolumeUp/Down/Mute` = volume.

### Modelo de foco
- Itens focáveis são marcados (`data-focus`) e **visíveis**; o D-pad move por **geometria 2D**.
- Ao trocar de seção/abrir tela, foco vai para o **primeiro focável**.
- Quando o menu **FN** está aberto, o foco fica **restrito ao menu**.

---

## 4. Menu FUNCTION (FN)

Overlay com itens (cada um focável; perigosos pedem confirmação):

| Item | Ação | Endpoint |
|------|------|----------|
| **Ajustes** | abre a tela AJUSTES (display/áudio) | — (navega) |
| **Testar botões** | abre a tela KEYS | — (navega) |
| **Auto screenshot** (ON/OFF) | captura automática a cada troca de tela | local |
| **Screenshot agora** | captura imediata | `POST /api/screenshot` |
| **ENERGIA › Recarregar UI** | recarrega a interface | `POST /api/actions {reload-ui}` |
| **ENERGIA › Reiniciar agente** | reinicia o `cyberdeck-agent` | `POST /api/actions {restart-agent}` |
| **ENERGIA › Reiniciar kiosk** ⚠ | reinicia o kiosk/render | `POST /api/actions {restart-kiosk}` |
| **ENERGIA › Reiniciar sistema** ⚠ | reboot | `POST /api/actions {reboot}` |
| **ENERGIA › Desligar** ⚠ | poweroff | `POST /api/actions {poweroff}` |

Rodapé do menu mostra a versão (`CyberDeck v<versão>`). ⚠ = confirmação obrigatória.

---

## 5. Régua de severidade (níveis ok/warn/crit)

Centralizada na UI (espelha `cyberdeck-agent/lib/health.js`):

| Métrica | warn | crit |
|---------|------|------|
| Temp (°C) | ≥ 65 | ≥ 80 |
| RAM (%) | ≥ 75 | > 90 |
| Storage (%) | ≥ 80 | > 90 |
| Tensão bateria (V) | ≤ 3,75 | < 3,55 |
| Load por core | ≥ 0,75 | > 1,25 |

Gauges: barra fica **amarela ≥70%** e **vermelha ≥90%**.

---

## 6. Inventário de telas

Ordem e metadados das seções (campo `META`): cada uma tem `id`, título, ícone, grupo
(MONITOR / SISTEMA / AÇÕES / DIAGNÓSTICO) e se aparece na **barra de abas** (`tab`).

| id | Título | Aba? | Grupo | Tela |
|----|--------|------|-------|------|
| welcome | HOME | ✓ | — | [HOME](#61-home-welcome) |
| status | STATUS | ✓ | MONITOR | [STATUS](#62-status) |
| procs | PROCS | ✓ | MONITOR | [PROCS](#63-procs) |
| network | NET | ✓ | MONITOR | [NET](#64-net-network) |
| logs | LOGS | ✓ | MONITOR | [LOGS](#65-logs) |
| device | DEVICE | ✓ | SISTEMA | [DEVICE](#66-device) |
| kernel | KERNEL | ✗ | SISTEMA | [KERNEL](#67-kernel--device-tree) |
| fs | FS | ✓ | SISTEMA | [FS](#68-fs) |
| systemd | SVC | ✓ | SISTEMA | [SVC](#69-svc-systemd) |
| cmd | CMD | ✓ | AÇÕES | [CMD](#610-cmd) |
| tools | AJUSTES | ✗ (FN) | AÇÕES | [AJUSTES](#611-ajustes-tools) |
| keys | KEYS | ✗ (FN) | DIAGNÓSTICO | [TESTE DE BOTÕES](#612-teste-de-botões-keys) |

### 6.1 HOME (welcome)
- **Propósito:** cockpit inicial; cabe em uma tela.
- **Conteúdo:**
  1. **Linha de saúde** (de `/api/health`): nível geral `SYS OK/WARN/CRIT` + `agente ON` +
     rede (IP ou "sem rede") + systemd (estado e nº de falhas).
  2. **Alertas acionáveis** (de `health.items`): clicáveis → abrem a aba alvo.
  3. **Metric tiles** (de `/api/status`): **CPU**, **RAM** (com barra %), **TEMP** (ok/alto),
     **BAT** (estimativa OCV, `AC` quando carregando), coloridos por nível.
  4. **Cards de atalho** (críticos): STATUS, PROCS, LOGS, NET, SVC, AJUSTES.
- **Live:** sim (atualiza tiles a cada status; recarrega saúde no `refresh`).
- **Endpoints:** `GET /api/health`, `GET /api/status`.

### 6.2 STATUS
- **Subpáginas (L1/R1):** `AO VIVO` · `ENERGIA` · `TENDÊNCIA`.
- **AO VIVO:** tiles CPU/RAM/TEMP/LOAD + KV MEM (`usado/total MB`), UPTIME, REDE (iface+IP).
- **ENERGIA:** minicards BAT (`est%`, "carregando"/"estimado"), TENSÃO (`V`, `mA`),
  OCV (`V`, status); KV RAW do rk817 (`capacity`, marcado "instável" se baixa confiança);
  gauge BRILHO; TEMP. **Lição:** mostrar dado bruto **e** derivado, deixar o humano julgar.
- **TENDÊNCIA:** sparklines textuais (`▁▂▃▄▅▆▇█`) de CPU/RAM/TEMP/LOAD/BAT (~2 min de histórico de sessão).
- **Endpoints:** `GET /api/status` (já no polling).

### 6.3 PROCS
- **Mestre→detalhe.** Live (refresh 4 s silencioso na lista).
- **Lista:** resumo (total/run/zumbi/~cpu%/cores) + controles numa linha: **sort** (chip que
  cicla `cpu→mem→pid→name`) + **filtros** (`ativos, all, node, chromium, cyberdeck, running, zombie`).
  Linhas: PID · CMD · barra de CPU · % · RSS. Paginada (10/pág, L1/R1).
- **Detalhe (por PID):** COMM, ESTADO, USER, PPID, THREADS, FD, RSS, EXE, CWD, CMDLINE,
  filhos, STATUS cru. Ações **SIGTERM** / **SIGKILL** (confirmação).
- **Endpoints:** `GET /api/processes`, `GET /api/processes/:pid`, `POST /api/processes/:pid/signal {signal}`.

### 6.4 NET (network)
- **Conteúdo:** estado ONLINE/OFF; INTERFACE(s) externas (ignora `lo`); IP; GATEWAY; DNS;
  SSID (+dBm). **Checklist de diagnóstico:** interface externa, link ativo, IP, gateway, DNS.
- **Ações:** `conectar` (wifi-up), `reconectar` (wifi-reconnect), `buscar redes` (scan → lista
  SSIDs), `conexões (ss)` (lista `ss`).
- **Endpoints:** `GET /api/network/summary`, `GET /api/network/connections?limit=`,
  `POST /api/network/wifi/scan`, `POST /api/actions {wifi-up|wifi-reconnect}`.

### 6.5 LOGS
- **Subpáginas/origem (L1/R1 ou subabas):** `dmesg, journal, agent, kiosk, ui`.
- **Filtro de severidade:** `all, error, warning, info`. Botão **pausar/retomar** (live, refresh 4 s).
- **Lista:** cada linha colorida por severidade (err/warn/info) e **focável**; auto-scroll ao fim
  se já estava no fim. **A** abre o **detalhe** (separa timestamp da mensagem).
- **Endpoints:** `GET /api/logs?source=&severity=&lines=`, `GET /api/logs/sources`.

### 6.6 DEVICE
- **Subpáginas (L1/R1):** `ID` · `CPU` · `DISPLAY` · `BOOT` · `INPUT`.
- **ID:** host, distro, kernel, arch, uptime, timezone, user, rootfs.
- **CPU:** minicards SoC (cores), RAM (livre), GPU (arch); freq por núcleo (2 col); temps;
  swap/zram; governor.
- **DISPLAY:** minicards FB (`virtual_size@bpp`), LUZ (`%`, `cur/max`), PAINEL (modelo, MIPI-DSI);
  ARMAZENAMENTO (dispositivos, GB, ro, modelo).
- **BOOT:** versão, modelo DT, nº de módulos (→ "detalhes em KERNEL").
- **INPUT:** dispositivos de input (joypad marcado `*`), USB.
- **Endpoint:** `GET /api/device`.

### 6.7 KERNEL & Device Tree
- **Conteúdo:** KERNEL (release, tipo, arch, host, tainted, config, nº módulos); VERSION cru;
  CMDLINE/bootargs; **DEVICE TREE** (presente?, modelo, serial, compatible, bootargs do chosen);
  **nós de topo** do device-tree (A abre o nó no **FS** em `/proc/device-tree/<nó>`);
  **módulos carregados** (nome, KB, uso).
- **Endpoint:** `GET /api/kernel`.

### 6.8 FS
- **Navegação READ-ONLY do rootfs.** Mestre→detalhe (lista de diretório → viewer de arquivo).
- **Lista:** breadcrumb (`/ a > b > c`, trunca no meio); **atalhos/bookmarks** (chips); entrada `..`;
  por item: tipo (DIR/LINK/TXT/LOG/BIN/…), nome (symlink mostra `→ alvo`), tamanho, modo.
  Paginada (10/pág, L1/R1). Mostra aviso se a listagem foi truncada.
- **Viewer:** texto em caixa (avisa se truncado por tamanho); recusa binário com mensagem.
- **B:** arquivo→diretório; subdir→pai; raiz→sai da tela.
- **Endpoints:** `GET /api/fs/list?path=`, `GET /api/fs/read?path=`, `GET /api/fs/bookmarks`.

### 6.9 SVC (systemd)
- **Mestre→detalhe.** Live (refresh na lista).
- **Lista:** painel-resumo (estado `running/degraded` + units/run/falhos; ênfase se há falhas);
  filtros `all, running, failed, cyberdeck`; **falhas sempre no topo**. Paginada (11/pág, L1/R1).
- **Detalhe (por unit):** estado (active/sub), enabled, PID, mem, "desde", descrição;
  ações **RESTART/STOP/START** (confirmação) e **LOGS** (journal, 120 linhas); STATUS cru.
- **Endpoints:** `GET /api/systemd/summary`, `GET /api/systemd/services`,
  `GET /api/systemd/service?unit=`, `GET /api/systemd/logs?unit=&lines=`,
  `POST /api/systemd/action {action,unit}`.

### 6.10 CMD
- **Comandos prontos por categoria (ALLOWLIST).** Dois níveis: categorias (cards) → comandos.
- **Comando:** tag `[SAFE]`/`[DIAG]`, descrição, linha de comando. **A** executa; saída em tela
  cheia com badge `OK/ERRO/TIMEOUT`, `$ cmd · exit N · Nms`. **B**: saída→lista→categorias.
- **Endpoints:** `GET /api/commands`, `POST /api/commands/exec {key}`.

### 6.11 AJUSTES (tools)
- **Subpáginas (L1/R1):** `DISPLAY` · `AUDIO`. Acessível pelo menu **FN**.
- **DISPLAY:** Fonte +/−/reset (persistido), Screenshot (L2+R2), ações de brilho (do agente),
  gauge BRILHO.
- **AUDIO:** gauge VOLUME + estado (mudo/controle); ações Volume +/−/Mute e **testar
  alto-falante**/**testar fone** (do agente); volume re-lido após ajuste.
- **Endpoints:** `GET /api/actions`, `POST /api/actions {key}`, `GET /api/volume`,
  `GET/POST /api/settings {fontScale}`.

### 6.12 TESTE DE BOTÕES (keys)
- **Propósito:** diagnóstico de gamepad. Acessível pelo menu **FN**.
- **Conteúdo:** id/mapa/nº de botões do gamepad; **painel de todos os botões** nomeados que
  **acendem ao pressionar** (layout imitando o físico); valores dos analógicos esq/dir; eixos e
  índices crus; última tecla do teclado.
- **Captura total:** nesta tela **nenhuma navegação dispara** (só acende células); **sai com
  Start+Select juntos**. (Implementação web exige testar `view-keys.active` — ver nota do topo.)
- **Endpoint:** nenhum (puramente local/Gamepad API).

---

## 7. Contrato do agente

Servidor HTTP em `127.0.0.1:8080`. Sucesso `{"ok":true,"data":{…}}`, erro
`{"ok":false,"error":{"code","message","details"}}`. CORS liberado (UI roda em `file://`).
**Segurança:** sem shell arbitrário — comandos/ações são **allowlist** (`execFile`, sem shell);
FS read-only saneado; unit/sinais validados. Detalhes em [`../STACK.md`](../STACK.md).

| Método | Rota | Devolve / faz |
|--------|------|---------------|
| GET | `/api/status` | CPU, RAM, load, uptime, temp, bateria, brilho, rede (poll 2 s) |
| GET | `/api/health` | nível agregado + alertas acionáveis (HOME) |
| GET | `/api/device` | identity + hardware + kernel + display + input |
| GET | `/api/kernel` | kernel detalhado + Device Tree |
| GET | `/api/fs/list?path=` · `/api/fs/read?path=` · `/api/fs/bookmarks` | navegação read-only |
| GET | `/api/systemd/{summary,services,service?unit=,logs?unit=}` | systemd |
| POST | `/api/systemd/action` `{action,unit}` | start/stop/restart |
| GET | `/api/processes` · `/api/processes/:pid` | lista e detalhe |
| POST | `/api/processes/:pid/signal` `{signal}` | SIGTERM/SIGKILL/SIGHUP/SIGINT |
| GET | `/api/network/{summary,connections?limit=}` | rede |
| POST | `/api/network/wifi/scan` | scan de SSIDs |
| GET | `/api/logs?source=&severity=&q=&lines=` · `/api/logs/sources` | logs |
| GET | `/api/commands` · `POST /api/commands/exec {key}` | comandos allowlist |
| GET | `/api/actions` · `POST /api/actions {key}` | bright±, volume±/mute, audio-test-spk/hp, wifi-up/reconnect, reload-ui, restart-agent/kiosk, reboot, poweroff |
| GET | `/api/volume` | `{pct, muted, control}` (rk817) |
| GET/POST | `/api/settings` `{fontScale}` | preferências persistentes |
| POST | `/api/screenshot` `{version}` | PNG sequencial em `/root/screenshots/v<versão>/` |
| GET | `/api/ping` | versão do agente |

---

## 8. Matriz de paridade (atualizar a cada fase)

Legenda: ✅ completo · 🟡 parcial · ❌ ausente · ➖ n/a.

Legenda extra: 🅰 = entregue na Tranche A · 🅱 = previsto p/ Tranche B.

| Recurso | web-vanilla | native-fb | web-react |
|---------|:----------:|:----------------:|:---------:|
| Casca (top bar/abas/rodapé/overlays) | ✅ | ✅ 🅰 | ❌ |
| Fonte do dado | agente (HTTP) | agente (HTTP) 🅰 | (será agente) |
| HOME cockpit (saúde+tiles+cards) | ✅ | ✅ 🅰 | ❌ |
| STATUS (live/energia/tendência) | ✅ | ✅ 🅰 | ❌ |
| PROCS (lista+detalhe+sinais) | ✅ | ✅ 🅱 | ❌ |
| NET | ✅ | ✅ 🅰 (estado+ações; scan/ss ainda não) | ❌ |
| LOGS (lista+detalhe) | ✅ | ✅ 🅱 (severidade por cor; filtro de severidade ainda não) | ❌ |
| DEVICE | ✅ | ✅ 🅰 (ID/CPU/DISPLAY/BOOT/INPUT) | ❌ |
| KERNEL & DTB | ✅ | ✅ 🅱 (campos + módulos paginados) | ❌ |
| FS (browser read-only) | ✅ | ✅ 🅱 (lista paginada + viewer) | ❌ |
| SVC (systemd) | ✅ | ✅ 🅱 (lista+detalhe+ações) | ❌ |
| CMD (allowlist) | ✅ | ✅ 🅱 (categorias→comandos→saída) | ❌ |
| AJUSTES (display/áudio) | ✅ | ✅ 🅰 (fonte ± = n/a no fb) | ❌ |
| TESTE DE BOTÕES | ✅ | ✅ 🅰 | ❌ |
| Menu FN | ✅ | ✅ 🅰 (+ Kernel) | ❌ |
| Screenshot (L2+R2) | ✅ | ✅ 🅱 (fbgrab+netpbm no build) | ❌ |
| Confirmação de ações perigosas | ✅ | ✅ 🅰🅱 (actions + systemd + sinais) | ❌ |
| Escala de fonte persistida | ✅ | ➖ (fonte fixa 8x16) | ❌ |
| Cores fixas de botão | ✅ | ✅ 🅰 | ❌ |
| Double buffering (sem flicker) | ➖ | ✅ 🅰 | ➖ |

> **native-fb — paridade essencialmente completa** (Tranche A + B): arquitetura modular
> (`fb`/`input`/`http`/`ui`/`views` + cJSON), dados via `cyberdeck-agent` (HTTP), double buffer,
> transliteração UTF-8→ASCII, master→detalhe, paginação, confirmação e as 12 telas + menu FN.
> **Pequenos gaps remanescentes:** filtro de severidade em LOGS, scan de Wi-Fi/conexões `ss` em
> NET, escala de fonte (n/a com fonte bitmap). **web-react:** reimplementar esta especificação
> com React/Webpack, mesma casca e tokens.
