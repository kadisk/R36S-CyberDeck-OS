# Contexto do Projeto — R36S CyberDeck OS

> **Como usar:** cole este documento inteiro no início da conversa com um modelo de IA
> que **não tem acesso ao repositório**, antes de fazer perguntas. Ele é autocontido:
> descreve o que é o projeto, o hardware, a arquitetura, as decisões, o estado atual e
> as restrições. Atualizado em 2026-06-23 (**três interfaces oficiais** em paridade +
> seletor de boot; áudio/vídeo; gerenciador de armazenamento).

---

## 1. O que é

Distribuição **Linux embarcada** que transforma o handheld **R36S** (console de jogos
barato, Rockchip RK3326) num **CyberDeck portátil**: um computador de bolso, controlado
pelo **gamepad**, capaz de **inspecionar e administrar** o sistema. **Não é distro de
jogos** (sem EmulationStation, sem emuladores).

A interface é um **painel técnico**: status, dispositivo, navegação no filesystem,
serviços systemd, processos, rede, logs, kernel/DTB, comandos, ações, **teste de A/V** e
**gerenciador de armazenamento**.

**Três interfaces oficiais em paridade**, escolhidas num **seletor no boot** e
consumindo o **mesmo backend** (`cyberdeck-agent`):
- **web-vanilla** — HTML/CSS/JS puro (sem build), Chromium kiosk. Referência.
- **native-fb** — C desenhando direto no `/dev/fb0` (sem X/Chromium). Leve.
- **web-react** — React + TypeScript + Webpack, Chromium kiosk (bundle `file://`).

Trocáveis em runtime (menu FN → Trocar interface) e no seletor de boot (WEB/REACT/NATIVE,
pref em `/var/lib/cyberdeck/interface`).

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
| **Interface** | **seletor no boot** → web-vanilla/web-react (**Chromium `--kiosk`**, `file://`) ou native-fb (**`/dev/fb0`** direto) | uma stack por gosto; web = SW render basta, native-fb = sem X/Chromium |
| **Input** | **Gamepad API** do Chromium (web) · **evdev** direto (native-fb) | dispensa teclado virtual |
| **Dados** | **`cyberdeck-agent`** (backend Node.js) servindo JSON em `127.0.0.1:8080` | alimenta as três interfaces |

> O ArkOS é usado **só como referência de boot/hardware** — sua imagem é somente-leitura
> e nunca é modificada. O rootfs final é Debian.

---

## 4. Arquitetura (3 camadas desacopladas)

```
INTERFACE (web kiosk OU native-fb)  --HTTP JSON-->  AGENTE (Node.js, localhost)  -->  LINUX (/proc, /sys, systemd, comandos)
```

- A camada de **interface é trocável** (web-vanilla / native-fb / web-react); o **agente é
  o mesmo** para as três. Adicionar uma interface = falar HTTP com o agente.
- As UIs **web** rodam por **`file://`** (origem `null`) → o agente libera **CORS `*`**; a
  **native-fb** fala HTTP direto (sem navegador).
- Nenhuma interface **toca no SO direto** — tudo passa pelo agente, que roda como **root**
  (via systemd) → lê tudo e executa ações (allowlist).

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
/api/actions   ·  POST /api/actions {key}            (brilho/volume/audio-test/wifi-*/expand-rootfs/interface-web|react|fb/reboot/… allowlist)
/api/media     ·  POST /api/media/{play,stop}        (lista /root/media + 2º cartão; toca via mpv)
/api/storage   ·  POST /api/storage/{mount,unmount}  (rootfs/partições/expandir/2º cartão)
/api/volume                             nível de áudio atual {pct,muted,control} (rk817)
/api/network/wifi/scan (POST)           SSIDs visíveis (dongle USB)
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

### 4b. Front-end — três interfaces em `interface/` (uma stack por subpasta)

Especificação stack-agnóstica (telas, contrato de input, design tokens, matriz de
paridade) em **`docs/interface/FEATURES.md`**. As três consomem o mesmo agente e têm o
**mesmo visual** (640×480, paleta verde/terminal, mesmos tokens):

- **`interface/web-vanilla/`** — Vanilla JS, **sem framework/build**, por `file://` (**sem
  ES modules**; namespace global `window.CD`). `app.js` (router/polling/FN/screenshot) +
  `js/`: `state.js`, `api.js`, `ui.js` (helpers+confirm/toast+**btnize**), `views.js`
  (todas as telas), `gamepad.js` (input). **Referência.**
- **`interface/native-fb/`** — C estático, sem libs, desenha no `/dev/fb0` (double buffer);
  módulos `fb/input/http/ui/views` + cJSON vendorizado. Lê o joypad por **evdev**.
  Controles secundários (filtros/sort/severidade/scan) mapeados em **X/Y**.
- **`interface/web-react/`** — **React + TypeScript + Webpack**; bundle único `file://`-safe
  (publicPath `./`, CSS via style-loader; Vite quebraria por ES modules no kiosk). Camada de
  input portada da `gamepad.js`; store via `useSyncExternalStore`.

**Telas (em todas):** HOME (alertas + metric tiles + cards) · STATUS (AO VIVO/ENERGIA/
TENDÊNCIA) · PROCS · NET · LOGS · DEVICE · FS · SVC · CMD · e, pelo **menu FN**: KERNEL
(kernel+DTB, nós→FS) · AJUSTES (DISPLAY/AUDIO) · TESTE A/V · ARMAZENAMENTO · TESTE DE BOTÕES.
**Subpáginas/paginação por L1/R1**, **mestre→detalhe** (B volta), **modal de confirmação**
p/ ações perigosas, cor fixa dos botões (A vermelho/B amarelo/X azul/Y verde; resto branco),
e **erro amigável** quando o agente está offline ("agente: OFF").

**Seletor de boot** (`cyberdeck-chooser`, C/framebuffer): 3 cards WEB/REACT/NATIVE; o
`cyberdeck-session` lê a escolha e lança a interface; timeout cai na última.

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
- **No boot**, o seletor mostra WEB/REACT/NATIVE (←→ + A/Start; timeout cai na última).
- A **native-fb** não tem ponteiro analógico; ela mapeia os controles secundários da web
  (filtros/ordenação/severidade/scan/atalhos) nos botões **X/Y** (indicados no rodapé).

---

## 6. Build e deploy

- **Construir imagem:** `sudo scripts/build-x11-rootfs.sh` (debootstrap Debian arm64 +
  Xorg fbdev + Chromium + Node + mpv/ffmpeg + **as 3 interfaces** + seletor/sessão + agente
  + clona boot do ArkOS + empacota `.img`, apelido `x11`). A **web-react** precisa do bundle
  pré-buildado no host: `(cd interface/web-react && ./build.sh)` antes do build (senão a opção
  REACT não é instalada; a imagem segue válida com WEB+NATIVE).
- **Gravar no cartão (por NOME, allowlist de segurança):** `sudo scripts/sdcard/sd-update.sh <cartao> x11`.
- **Atualizar por SSH (sem regravar):** `scripts/update-r36s.sh <host>` (tudo) ou
  `scripts/deploy-r36s.sh <host> [ui|react|fb|agent|…]` — empurra componentes e reinicia
  serviços; `--reboot` opcional. (Mudanças de pacote apt / `xorg.conf.d` / kernel/partições
  ainda exigem rebuild + flash.)
- **Bateria de teste automatizada:** `scripts/test/test-r36s.sh <host>` — finge ser o
  gamepad (uinput→evdev), navega todas as telas da native-fb, captura via `fbgrab` e baixa
  os artefatos. Foi a fonte dos screenshots da galeria.
- **Recuperar/limpar screenshots do cartão:** `sd-get-screenshots.sh` / `sd-clear-screenshots.sh`.
- Serviços systemd: `cyberdeck-agent.service` (backend) e **`cyberdeck-session.service`**
  (roda o seletor `cyberdeck-chooser` e lança a interface escolhida — web=Xorg+Chromium,
  fb=native). `cyberdeck-growfs`/`cyberdeck-mountcard` (armazenamento) e `cyberdeck-net` (Wi-Fi).
  Caminhos no device: `/usr/share/cyberdeck-ui` (vanilla), `/usr/share/cyberdeck-web-react`
  (react), `/usr/local/bin/cyberdeck-fb` (native).

---

## 7. Restrições obrigatórias (ao propor mudanças)

- **Tela 640×480** — alta densidade, contraste forte, fontes legíveis; nada de layout
  “desktop grande”; pouca animação; sem WebGL/canvas pesado (render por software).
- **Performance** (RK3326, ~1 GB) — sem libs pesadas, sem polling agressivo, paginar/
  limitar listas grandes, cache curto p/ chamadas caras.
- **Segurança** — nada de shell arbitrário; ações perigosas com confirmação; FS read-only;
  sanitizar input; allowlist no backend.
- **Interfaces** — manter **paridade** (spec em `docs/interface/FEATURES.md`) e os mesmos
  tokens/visual. `web-vanilla`: HTML/CSS/JS puro, **sem build/sem framework/sem ES modules**
  (roda por `file://`). `web-react`: React+TS+**Webpack** (bundle único `file://`-safe;
  **não usar Vite** — ES modules quebram no kiosk). `native-fb`: **C sem libs** (estático).
- **Backend** — Node sem dependências (ou o mínimo absoluto); `execFile`/`spawn` (não
  `exec` de string); timeouts; JSON consistente.
- **Não quebrar** os scripts de build/rootfs/sdcard existentes.

---

## 8. Estado atual (o que está validado e o que NÃO)

- ✅ **Validado no R36S físico:** seletor de boot (3 opções, gamepad), **as três
  interfaces** rodando (web-vanilla, native-fb com navegação automatizada por todas as
  telas + X/Y, web-react); dados ao vivo, paginação/subpáginas (L1/R1), menu FN, confirmação,
  cores dos botões, KERNEL/DTB (nós→FS), **expansão do rootfs** no 1º boot (3.9→6.5 G), layout
  de partições, screenshot via `fbgrab`. Galeria em `docs/screenshots/` extraída do `/dev/fb0`.
- ✅ Validado **no host (PC)**: `node --check` no backend; `tsc --noEmit` + build do web-react;
  smoke headless (Chrome) consumindo o agente.
- ⚠️ **Pendências conhecidas:** **flash limpo** da imagem unificada validado ponta a ponta
  (o cartão de dev foi atualizado por SSH, ainda com partição antiga); **2º cartão** testado
  com um cartão real; e o **dongle Wi-Fi RTL8188 é instável** (erros `fw read cmd failed` —
  hardware; o console do kernel foi silenciado p/ não poluir a tela). A escuta real do áudio
  no alto-falante depende de uso manual.

> **Regra do projeto:** nunca afirmar que algo foi “testado no R36S físico” se não foi.

---

## 9. Mapa do repositório

```
interface/         interfaces gráficas oficiais (uma stack por subpasta) — ver interface/README.md
  web-vanilla/     UI web (public/index.html, style.css, app.js, js/*.js) — referência
  native-fb/       UI nativa em C no framebuffer (src/*.c, chooser.c, cJSON) — leve
  web-react/       UI React + TypeScript + Webpack (src/*.tsx) — em paridade
cyberdeck-agent/   backend Node (agent.js + lib/*.js) — compartilhado pelas 3 interfaces
runtime/           serviços systemd + scripts de boot (seletor/sessão/Xorg/kiosk/agent/net/growfs)
scripts/           build-x11-rootfs.sh + update-r36s.sh/deploy-r36s.sh (SSH) + test/ (bateria gamepad) + kit sdcard/
board/r36s/        arquivos da placa (boot.ini, logo, overlays)
artifacts/         artefatos de referência (boot/DTB do ArkOS); uitest/ (capturas, gitignored)
experiments/       tentativas que NÃO entraram (Wayland/Mali, mainline, uinput)
docs/              STACK.md, JORNADA.md, roadmap.md, interface/FEATURES.md (spec), screenshots/, hardware/…
CHANGELOG.md       histórico de mudanças
```

---

## 10. Glossário rápido

- **BSP** = kernel/DTB do fornecedor (Rockchip 4.4) que faz o painel funcionar.
- **fbdev** = driver de framebuffer do Xorg (render por software, sem GPU).
- **kiosk** = navegador em tela cheia, sem barras, como se fosse o “app”.
- **agente** = `cyberdeck-agent`, o backend Node local (compartilhado pelas 3 interfaces).
- **seletor** = `cyberdeck-chooser`, tela de boot que escolhe WEB/REACT/NATIVE.
- **native-fb / web-react** = interfaces alternativas (C no framebuffer / React+TS+Webpack).
- **allowlist** = lista fechada de comandos/ações permitidos (em vez de shell livre).
