# Contexto do Projeto — R36S CyberDeck OS

> **Como usar:** cole este documento inteiro no início da conversa com um modelo de IA
> que **não tem acesso ao repositório**, antes de fazer perguntas. Ele é autocontido:
> descreve o que é o projeto, o hardware, a arquitetura, as decisões, o estado atual e
> as restrições. Atualizado em 2026-06-17 (UI+agente **v0.8.0**).

---

## 1. O que é

Distribuição **Linux embarcada** que transforma o handheld **R36S** (console de jogos
barato, Rockchip RK3326) num **CyberDeck portátil**: um computador de bolso cuja
interface é uma **aplicação web rodando em kiosk**, controlada pelo **gamepad**, capaz
de **inspecionar e administrar** o sistema. **Não é distro de jogos** (sem
EmulationStation, sem emuladores).

A interface (CyberDeck UI) é um painel técnico: status, dispositivo, navegação no
filesystem, serviços systemd, processos, rede, logs, comandos e ações do sistema.

---

## 2. Hardware do R36S

| Componente | Detalhe |
|---|---|
| SoC | Rockchip **RK3326** · 4× Cortex-A35 (AArch64/arm64) |
| RAM | ~1 GB (zram ativo) |
| GPU | ARM **Mali-G31** (blob proprietário antigo — **sem GL aberto utilizável**) |
| Tela | painel MIPI-DSI **`elida,kd35t133`**, **640×480**, backlight PWM |
| PMIC/Áudio | **RK817** (power, bateria, carga, codec de áudio) |
| Input | **odroidgo3-joypad** (`/dev/input/eventX`) + teclas de volume |
| Kernel | Linux **4.4.189** (BSP Rockchip, vindo do boot do ArkOS) |

- **Sem Wi-Fi/Ethernet internos** — rede só via **dongle USB**.
- A bateria via rk817 tem o `capacity` frequentemente **travado** (ex.: 100%); por isso
  a UI também mostra **tensão** e uma **estimativa por tensão** (1S LiPo) que de fato varia.

---

## 3. Como a imagem é montada (decisões-chave)

A versão que funciona combina três decisões descobertas na prática:

| Camada | Escolha | Por quê |
|---|---|---|
| **Boot** | região de boot **clonada do ArkOS** (U-Boot + **kernel BSP 4.4** + DTB `rk3326-r35s-linux.dtb`) | só o kernel+DTB BSP **acende o painel** deste lote; mainline não sobe |
| **Rootfs** | **Debian bookworm arm64** (debootstrap) | base limpa e atual, sem herdar o ArkOS |
| **Tela** | **Xorg** com driver **fbdev** em `/dev/fb0` (render por **software**) | evita Wayland/GBM do blob Mali (antigo demais) |
| **UI** | **Chromium `--kiosk`** abrindo `file://…/cyberdeck-ui/public/index.html` | navegador padrão; software rendering basta p/ UI leve |
| **Input** | **Gamepad API** do Chromium + driver **joystick do Xorg** p/ o ponteiro | dispensa teclado virtual |
| **Dados** | **`cyberdeck-agent`** (backend Node.js) servindo JSON em `127.0.0.1:8080` | alimenta todas as telas |

> O ArkOS é usado **só como referência de boot/hardware** — sua imagem é somente-leitura
> e nunca é modificada. O rootfs final é Debian.

---

## 4. Arquitetura (3 camadas desacopladas)

```
FRONT-END (HTML/CSS/JS, kiosk)  --fetch JSON-->  BACKEND (Node.js, localhost)  -->  LINUX (/proc, /sys, systemd, comandos)
```

- A UI roda por **`file://`** (origem `null`); o agente libera **CORS `*`**.
- A UI **não toca no SO direto** — tudo passa pelo agente.
- O agente roda como **root** (via systemd) → lê tudo e executa ações.

### 4a. Backend — `cyberdeck-agent/`

- **Node.js puro, sem dependências** (`http`, `os`, `fs`, `child_process`). Deploy = copiar arquivos.
- **Modular:** `agent.js` (roteador HTTP) + `lib/*.js` por domínio:
  `http, exec, util, status, device, kernel, fsbrowse, systemd, processes, network,
  logs, commands, actions, settings, screenshot, volume, health`.
- **Contrato JSON consistente:**
  - sucesso: `{ "ok": true, "data": {…} }`
  - erro: `{ "ok": false, "error": { "code", "message", "details" } }`

**Endpoints principais (GET salvo indicado):**
```
/api/status            métricas de polling (CPU, RAM, temp, bateria, brilho, rede)
/api/device            hardware+SO (identity/hardware/kernel/display/input)
/api/kernel            kernel detalhado + Device Tree (DTB)
/api/fs/list?path=     navegação read-only do rootfs
/api/fs/read?path=     leitura de arquivo de texto (limitada)
/api/systemd/{summary,services,service?unit=,logs?unit=}
POST /api/systemd/action {action,unit}
/api/processes  ·  /api/processes/:pid  ·  POST /api/processes/:pid/signal {signal}
/api/network/{summary,connections}
/api/logs?source=&severity=&q=         (dmesg/journal/unidades)
/api/commands  ·  POST /api/commands/exec {key}      (allowlist)
/api/actions   ·  POST /api/actions {key}            (brilho/volume/audio-test/reboot/… allowlist)
/api/volume                             nível de áudio atual {pct,muted,control} (rk817)
/api/health  ·  /api/ping               severidade agregada (HOME) · versão do agente
GET/POST /api/settings {fontScale}     (preferências persistentes)
POST /api/screenshot {version}          PNG sequencial em /root/screenshots/v<versão>/shot-NNNN.png
```

**Modelo de segurança (importante):**
- **Não existe execução de shell arbitrária.** A UI manda só uma **chave** conhecida;
  o mapa chave→`(arquivo, args[])` mora no backend; tudo via **`execFile`** (sem shell).
- **FS read-only**, path saneado com `path.resolve("/", p)` (sem `../` p/ fora da raiz),
  limites de entradas/tamanho e detecção de binário.
- Nome de unit (regex), sinais e ações (allowlist/Set), PID validado. PID 1 protegido.

### 4b. Front-end — `cyberdeck-ui/public/`

- **Vanilla JS, sem framework, sem build.** Carrega por `file://`, então **sem ES
  modules** — os scripts compartilham o namespace global `window.CD`, incluídos por ordem.
- Arquivos: `index.html`, `style.css`, `app.js` (router/polling/relógio + **menu FN** +
  screenshot) e `js/`: `state.js`, `api.js`, `ui.js` (helpers DOM + confirm/toast +
  **btnize**), `views.js` (todas as telas), `gamepad.js` (input).
- **Telas:** HOME (cockpit: alertas + metric tiles + cards) · STATUS (AO VIVO/ENERGIA/
  TENDÊNCIA) · DEVICE (ID/CPU/DISPLAY/BOOT/INPUT, mini-cards) · KERNEL (kernel+DTB) · FS ·
  SVC (systemd) · PROCS · NET · LOGS · CMD (allowlist) · AJUSTES (DISPLAY/AUDIO) ·
  TESTE DE BOTÕES.
- **Subpáginas/paginação por L1/R1** (minimiza scroll em 640×480). **Padrão
  mestre→detalhe** em FS/SVC/PROCS (B volta). **Menu FN** (botão Function) concentra
  Ajustes/Testar botões/Auto screenshot/Screenshot/energia. **Modal de confirmação** p/
  ações perigosas. Referências de botão com **cor fixa** (A vermelho/B amarelo/X azul/
  Y verde; resto branco) via `CD.ui.btnize`. Estados OK/warn/crit/loading e **erro
  amigável** quando o agente está offline (rodapé “agente: OFF”).
- **Versão (semver)** casada entre `CD.VERSION`, os dois `package.json` e `/api/ping`;
  os screenshots são organizados por versão (`v<versão>/`).

---

## 5. Controles (gamepad)

| Controle | Ação |
|---|---|
| D-pad ← → | trocar de aba (nas bordas) / mover foco 2D |
| D-pad ↑ ↓ | mover foco (↑ no topo alcança a barra de abas) |
| A | clica no ponteiro real (se movido há pouco) ou ativa o item focado |
| Start | ativa o item focado |
| B / Select | voltar um nível |
| Analógico esq. | move o **ponteiro REAL do X** (driver `xf86-input-joystick`) |
| Analógico dir. | scroll |
| **L1 / R1** | trocar **subpágina/página** da seção (subabas, paginação, origem do log) |
| **L2 + R2** (combo) | **screenshot** (`/root/screenshots/v<versão>/shot-NNNN.png`) |
| **FN** | abre o menu **FUNCTION** (Ajustes/Testar botões/Auto screenshot/Screenshot/energia) |
| Volume +/− | volume do sistema (via `amixer`/`lib/volume.js`) |

- O ponteiro é o **real do X11** (não um cursor desenhado). É movido por
  `xf86-input-joystick` via `/etc/X11/xorg.conf.d/60-joystick.conf` (eixos do stick →
  movimento relativo; `deadzone` + `ConstantDeceleration` p/ suavizar). JS **não move** o
  ponteiro do X — só rastreia via `mousemove` para o A clicar no lugar certo.
- Teclado (dev): setas/Enter/Esc navegam; **+/−** mudam fonte; **F12/PrintScreen** screenshot.

---

## 6. Build e deploy

- **Construir imagem:** `sudo scripts/build-x11-rootfs.sh` (debootstrap Debian arm64 +
  Xorg fbdev + Chromium + Node + UI + agente + clona boot do ArkOS + empacota `.img`,
  registra como apelido `x11`).
- **Gravar no cartão (por NOME, com allowlist de segurança):**
  `sudo scripts/sdcard/sd-update.sh <cartao> x11`.
- **Iteração rápida (sem regravar 4 GB):** `sudo scripts/sdcard/sd-update-ui.sh <cartao>`
  empurra só `cyberdeck-ui/public/` + `cyberdeck-agent/` (UI + agente). **Não instala
  pacotes apt nem aplica `xorg.conf.d`** — mudanças de sistema exigem rebuild + flash.
- **Recuperar screenshots:** `sudo scripts/sdcard/sd-get-screenshots.sh <cartao>`
  (monta rootfs read-only e copia `/root/screenshots`, organizados por `v<versão>/`).
- **Limpar screenshots do cartão:** `sudo scripts/sdcard/sd-clear-screenshots.sh <cartao>`
  (evita misturar prints de versões antigas numa nova validação).
- Serviços systemd: `cyberdeck-agent.service` (backend, sobe antes da UI) e
  `cyberdeck-x.service` (Xorg + Chromium kiosk).

---

## 7. Restrições obrigatórias (ao propor mudanças)

- **Tela 640×480** — alta densidade, contraste forte, fontes legíveis; nada de layout
  “desktop grande”; pouca animação; sem WebGL/canvas pesado (render por software).
- **Performance** (RK3326, ~1 GB) — sem libs pesadas, sem polling agressivo, paginar/
  limitar listas grandes, cache curto p/ chamadas caras.
- **Segurança** — nada de shell arbitrário; ações perigosas com confirmação; FS read-only;
  sanitizar input; allowlist no backend.
- **Front-end** — HTML/CSS/JS puro, **sem build, sem framework**, compatível com Chromium
  do Debian bookworm, funcionando por `file://` (sem ES modules).
- **Backend** — Node sem dependências (ou o mínimo absoluto); `execFile`/`spawn` (não
  `exec` de string); timeouts; JSON consistente.
- **Não quebrar** os scripts de build/rootfs/sdcard existentes.

---

## 8. Estado atual (o que está validado e o que NÃO)

- ✅ **Validado no R36S físico (via screenshots, até v0.7.1):** UI/cockpit, gamepad,
  dados ao vivo, ponteiro pelo analógico, escala de fonte persistida, screenshot
  versionado/sequencial, subpáginas/paginação (L1/R1), menu FN, foco refinado, cores dos
  botões, NET checklist, CMD allowlist, KERNEL/DTB.
- ✅ Validado **no host (PC Ubuntu)**: `node --check` em todo o backend/front; smoke test
  headless (Chrome) das telas sem exceções; endpoints com erro gracioso onde dependem do aparelho.
- ⚠️ **NÃO testado no R36S físico ainda:** o **áudio** (v0.8.0) — controle de volume e
  testes de saída alto-falante/fone dependem do controle certo do rk817 (descoberto via
  `amixer scontrols`) e do roteamento "Playback Path"; a **tela de teste de botões**
  (combo Start+Select, acender por índice). Dependem de rebuild+flash + escuta/uso real.

> **Regra do projeto:** nunca afirmar que algo foi “testado no R36S físico” se não foi.

---

## 9. Mapa do repositório

```
cyberdeck-ui/      UI web (public/index.html, style.css, app.js, js/*.js)
cyberdeck-agent/   backend Node (agent.js + lib/*.js)
cyberdeck-fb/      UI nativa alternativa (renderizador 2D em C no framebuffer) — paralela
runtime/           serviços systemd + scripts de boot (Xorg/kiosk/agent)
scripts/           build-x11-rootfs.sh + inspeção do ArkOS + kit sdcard/ (gravação segura)
board/r36s/        arquivos da placa (boot.ini, logo, overlays)
artifacts/         artefatos de referência (boot/DTB extraídos do ArkOS, imagens)
experiments/       tentativas que NÃO entraram (Wayland/Mali, mainline, uinput)
docs/              documentação: STACK.md (arquitetura), JORNADA.md (história/becos),
                   roadmap.md, hardware/, graphics/, boot/, testing/
CHANGELOG.md       histórico de mudanças
```

---

## 10. Glossário rápido

- **BSP** = kernel/DTB do fornecedor (Rockchip 4.4) que faz o painel funcionar.
- **fbdev** = driver de framebuffer do Xorg (render por software, sem GPU).
- **kiosk** = navegador em tela cheia, sem barras, como se fosse o “app”.
- **agente** = `cyberdeck-agent`, o backend Node local.
- **allowlist** = lista fechada de comandos/ações permitidos (em vez de shell livre).
