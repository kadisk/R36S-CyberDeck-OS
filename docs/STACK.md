# Stack e Arquitetura — R36S CyberDeck OS
### (referência-base para o projeto **Meta Platform**)

Este documento descreve **o que é o projeto** e **a stack Linux + Node.js + front-end**
que o sustenta, escrito para servir de **fundação reaproveitável** em outro projeto
(Meta Platform). Não é um tutorial do R36S — é o **padrão arquitetural** por trás dele.

---

## 1. Visão geral

O **R36S CyberDeck OS** transforma um handheld Linux (Rockchip RK3326, tela 640×480,
gamepad) num **CyberDeck**: um "computador de bolso" cuja interface é uma **aplicação
web rodando em kiosk**, alimentada por um **agente local em Node.js** que expõe dados e
ações do sistema. Não é distro de jogos.

A ideia central — e o que interessa para o **Meta Platform** — é o **padrão de três
camadas desacopladas**:

```
  ┌─────────────────────────────────────────────────────────────┐
  │  FRONT-END  (HTML/CSS/JS) — a interface, em kiosk            │
  │  consome JSON via fetch / WebSocket; sem dependências        │
  └───────────────▲─────────────────────────────────────────────┘
                  │  HTTP localhost (JSON, CORS)
  ┌───────────────┴─────────────────────────────────────────────┐
  │  BACKEND  (Node.js, sem deps) — "agente local"              │
  │  lê o SO (/proc, /sys, comandos) e expõe dados + ações       │
  └───────────────▲─────────────────────────────────────────────┘
                  │  syscalls / sysfs / processos
  ┌───────────────┴─────────────────────────────────────────────┐
  │  BASE LINUX  — boot + rootfs + serviços (systemd) + display  │
  └─────────────────────────────────────────────────────────────┘
```

Cada camada é **substituível** sem reescrever as outras: o front-end não sabe de
hardware, o backend não sabe de layout, a base não sabe da UI.

---

## 2. Camada 1 — Base Linux

| Item | Escolha no R36S | Papel genérico (Meta Platform) |
|------|-----------------|-------------------------------|
| Rootfs | **Debian** (debootstrap arm64) | base previsível com `apt` |
| Boot | reaproveitado do firmware que funciona (kernel BSP) | "subir a tela é problema de hardware, não da app" |
| Display | **Xorg (fbdev)** + **Chromium `--kiosk`** | qualquer runtime web fullscreen |
| Serviços | **systemd** (`*.service`) | orquestra backend + kiosk no boot |
| Memória | **zram** | alívio em hardware com pouca RAM |

**Padrão reaproveitável:** a aplicação é entregue como **um navegador em kiosk** +
**um serviço de backend**, ambos gerenciados por **systemd**. Trocar o alvo (outro
SoC, outra distro, um PC) só muda esta camada.

Serviços do projeto (em `runtime/services/`):
- `cyberdeck-agent.service` — sobe o backend Node antes da UI.
- `cyberdeck-x.service` — sobe Xorg + Chromium kiosk apontando para a UI.

---

## 3. Camada 2 — Backend Node.js (o "agente local")

Um **servidor HTTP em Node.js, sem dependências**, escutando em `127.0.0.1:8080`.
Roda como root → lê tudo do SO e executa ações. É **modular**: um roteador fino
(`cyberdeck-agent/agent.js`) + um módulo por domínio em `cyberdeck-agent/lib/`:

```
agent.js          roteador HTTP (GET/POST → handlers) + tradução de erro p/ {ok,error}
lib/http.js       cors, ok(), fail(code), readBody — formato de resposta consistente
lib/exec.js       execFile seguro (sem shell) com timeout/maxBuffer; nunca rejeita
lib/util.js       rd/rdInt de /proc /sys, cache curto por TTL
lib/status.js     polling leve (CPU%, RAM, temp, bateria, brilho)
lib/device.js     inspeção completa (identity/hardware/kernel/display/input)
lib/fsbrowse.js   navegação READ-ONLY do rootfs (path saneado, limites, sem binário)
lib/systemd.js    summary/services/service/logs/action (unit validada, ações allowlist)
lib/processes.js  lista/detalhe via /proc, CPU% por delta, sinais (allowlist)
lib/network.js    interfaces/rotas/conexões (sysfs + ip/ss)
lib/logs.js       dmesg/journal/unidades com limite e filtro de severidade
lib/commands.js   ALLOWLIST de comandos prontos (substitui exec arbitrário)
lib/actions.js    ALLOWLIST de ações administrativas (brilho/volume/reboot/restart…)
lib/volume.js     áudio: descobre o controle do rk817, lê/ajusta volume, testa saída (tom)
lib/kernel.js     kernel detalhado + Device Tree (DTB)
lib/settings.js   preferências persistentes (fontScale) em /var/lib/cyberdeck
lib/screenshot.js captura PNG sequencial por versão da UI (fbgrab→scrot)
lib/health.js     agrega severidade (nível + alertas) p/ a HOME
```

**Princípios (transferíveis para o Meta Platform):**
1. **Só módulos nativos** (`http`, `os`, `fs`, `child_process`) → zero `node_modules`,
   deploy = copiar `agent.js` + `lib/`.
2. **Bind só em `localhost`** → superfície de ataque mínima.
3. **CORS liberado** (`Access-Control-Allow-Origin: *`) porque a UI roda em `file://`.
4. **Contrato JSON estável** — sucesso `{"ok":true,"data":{…}}`, erro
   `{"ok":false,"error":{"code","message","details"}}`. O front só conhece o formato.
5. **Três tipos de endpoint:** **polling** (`/api/status`), **lazy** (device, fs,
   systemd, processes, network, logs) e **ações** (`POST` commands/actions/signal).
6. **Sem shell arbitrário.** Toda execução é `execFile(file, args[])` (sem `exec` de
   string) e os comandos/ações são **allowlist** validadas no backend.

### Contrato de API (modelo)

| Método | Rota | Devolve / faz |
|--------|------|---------------|
| GET | `/api/status` | CPU, RAM, load, uptime, temp, bateria, brilho, rede (poll 2 s) |
| GET | `/api/device` | identity + hardware + kernel + display + input |
| GET | `/api/fs/list?path=` · `/api/fs/read?path=` | navegação read-only do rootfs |
| GET | `/api/systemd/{summary,services,service,logs}` | systemd (resumo→lista→detalhe→logs) |
| GET | `/api/processes` · `/api/processes/:pid` | lista e detalhe por PID (via `/proc`) |
| GET | `/api/network/{summary,connections}` | interfaces, rotas, DNS, conexões |
| GET | `/api/logs?source=&severity=&q=` | dmesg/journal/unidades, filtrado/limitado |
| GET | `/api/commands` · `/api/actions` | listas (allowlist) p/ a UI montar |
| POST | `/api/commands/exec` `{key}` | executa um comando **conhecido** (allowlist) |
| POST | `/api/actions` `{key}` | brilho±, volume±/mudo, **audio-test-spk/hp**, reload-ui, restart-agent/kiosk, reboot, poweroff |
| POST | `/api/systemd/action` `{action,unit}` | start/stop/restart de unit validada |
| POST | `/api/processes/:pid/signal` `{signal}` | SIGTERM/SIGKILL/SIGHUP/SIGINT |
| GET | `/api/volume` | nível de áudio atual `{pct, muted, control}` (rk817) |
| GET | `/api/kernel` · `/api/health` · `/api/ping` | kernel+DTB · severidade agregada · versão do agente |
| GET/POST | `/api/settings` `{fontScale}` | preferências persistentes |
| POST | `/api/screenshot` `{version}` | PNG sequencial em `/root/screenshots/v<versão>/` |

### Modelo de segurança (o backend **não** é um shell remoto)

- **Allowlist em vez de `exec` livre:** a UI manda só uma **chave** (`key`/`action`),
  nunca uma linha de comando. O mapa chave→`(file,args)` mora no backend.
- **FS read-only e saneado:** `path.resolve("/", p)` impede `../` escapar da raiz;
  `lstat` não segue symlink cego (reporta o alvo); limites de entradas (600) e de
  leitura (256 KiB); binário é detectado e recusado.
- **Validação estrita:** nome de unit por regex; sinais e ações por `Set`; PID inteiro.
- **Confirmação na UI** para ações perigosas (a camada de segurança real é a allowlist).

**Como a fonte de dados é obtida** (padrão que se repete para qualquer métrica):
- leitura direta de **sysfs/procfs** (`/sys/class/power_supply`, `/proc/stat`, …);
- módulo `os` do Node (`cpus`, `totalmem`, `networkInterfaces`, `loadavg`);
- **comandos** quando não há sysfs (`ip route`, `systemctl`, `dmesg`).

> Lição concreta (reaproveitável): **nunca confie cegamente num único campo do
> kernel.** No R36S o `capacity` da bateria (rk817) trava em 100%; a solução foi
> expor também tensão/corrente e uma **estimativa derivada** — o front-end mostra o
> dado bruto + o derivado e deixa o humano julgar.

---

## 4. Camada 3 — Front-end (HTML/CSS/JS)

UI **vanilla, sem framework, sem build** (`interface/web-vanilla/public/`), organizada em
módulos por `<script>` global (`window.CD`) — **sem ES modules**, porque carrega por
`file://` (o Chromium bloqueia `import` nesse esquema):

```
index.html  casca (top bar, abas, #content, modal de confirmação, menu FN, toast)
app.js      router (go/back/nextTab/focusFirst) + polling + relógio + menu FN + screenshot
js/state.js estado central (aba/subaba/página, versão)   js/api.js  cliente {ok,data}
js/ui.js    helpers de DOM + confirm()/toast + btnize     js/views.js  todas as telas
js/gamepad.js  input (teclado + Gamepad API + ponteiro REAL do X + scroll)
```

**Padrões (transferíveis):**
- **HOME com cards** como entrada; um array `META` declara as seções e dirige abas+cards.
- **Views como objetos** `{build, show, refresh, onStatus, back}` registrados num mapa;
  o router só monta/troca e chama `show()`. Telas pesadas (FS/SVC/PROCS) usam
  **mestre→detalhe** com `back()` tratando o nível interno.
- **Dados ao vivo** por `fetch` periódico (`/api/status` 2 s) + **lazy load** ao abrir
  cada aba; listas grandes são **paginadas/limitadas** no servidor para não travar.
- **Ações** = `POST` para o agente; ações perigosas passam por um **modal de
  confirmação** resolvido pela camada de input (A confirma, B cancela).
- **Degradação graciosa:** roda por `file://` e **sempre renderiza**; se o agente cair,
  o rodapé marca **agente: OFF** e cada aba mostra uma **tela de erro amigável**.
- **Camada de input abstraída** — o mesmo app responde a **teclado** e **Gamepad API**.
  O analógico esquerdo move o **ponteiro real do X** (driver `xf86-input-joystick`, fora
  do navegador); com D-pad o ponteiro some e o foco em `[data-focus]` navega por geometria
  2D. A navegação (trocar seção, mover foco, confirmar, voltar, subpáginas por L1/R1) é a
  abstração — independente da fonte de entrada.

---

## 5. Por que esta stack (decisões que valem para o Meta Platform)

- **Web como camada de UI** → iteração rápida, layout responsivo, zero compilação,
  fácil de portar entre dispositivos. O "app" é HTML servido localmente.
- **Backend local em vez de embutir lógica no front** → separa **apresentação** de
  **acesso ao sistema**; permite testar o agente isolado (curl) e trocar a UI sem
  mexer no backend.
- **Node sem dependências** → reprodutibilidade e deploy trivial (copiar `agent.js`).
- **systemd** como supervisor → reinício automático, ordem de boot, logs.
- **Localhost + CORS** em vez de servir a UI pelo Node → a UI **sempre carrega**
  (arquivo local) mesmo que o backend falhe.

---

## 6. Como replicar no Meta Platform (checklist)

1. **Base:** rootfs (Debian/qualquer) + kiosk web (Chromium/WPE) + `systemd`.
2. **Agente:** um `agent.js` Node em `127.0.0.1:PORTA`, só módulos nativos, com os
   três tipos de endpoint (polling / lazy / ações) e **contrato JSON** documentado.
3. **Front-end:** HTML/CSS/JS sem build; `fetch` para o agente; degradação graciosa;
   navegação abstraída da entrada (teclado/gamepad/touch).
4. **Serviços:** um `.service` para o agente, outro para o kiosk; agente **antes** da UI.
5. **Empacotamento:** script que monta a imagem/instala e **registra** o app — sem
   passos manuais (no R36S: `build-x11-rootfs.sh` + kit de gravação por nome de cartão).
6. **Iteração:** poder atualizar **só a UI** e **só o agente** sem reconstruir tudo
   (no R36S: `sd-update-ui.sh`).

---

## 7. Mapa do código (referência)

| Camada | Onde, no R36S CyberDeck OS |
|--------|---------------------------|
| Base Linux / boot | `scripts/build-x11-rootfs.sh`, `board/r36s/boot/`, `runtime/services/` |
| Backend Node | `cyberdeck-agent/agent.js` (roteador) + `cyberdeck-agent/lib/*.js` (domínios) |
| Front-end | `interface/web-vanilla/public/` (`index.html`, `app.js`, `style.css`, `js/*.js`) |
| Empacotar/gravar | `scripts/sdcard/` (gravação segura por nome de cartão) |
| Histórico/decisões | `docs/JORNADA.md` |

> Resumo de uma linha para o Meta Platform: **“UI web em kiosk + agente local em Node
> (JSON sobre localhost) sobre uma base Linux com systemd”** — três camadas
> desacopladas, cada uma trocável sem tocar nas outras.
