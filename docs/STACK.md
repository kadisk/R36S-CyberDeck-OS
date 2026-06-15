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

Um **servidor HTTP minúsculo em Node.js, sem dependências** (`cyberdeck-agent/agent.js`),
escutando em `127.0.0.1:8080`. Roda como root → lê tudo do SO e executa ações.

**Princípios (transferíveis para o Meta Platform):**
1. **Só módulos nativos** (`http`, `os`, `fs`, `child_process`) → zero `node_modules`,
   build trivial, deploy = copiar um arquivo.
2. **Bind só em `localhost`** → superfície de ataque mínima; a UI e o agente vivem no
   mesmo aparelho.
3. **CORS liberado** (`Access-Control-Allow-Origin: *`) porque a UI roda em `file://`
   (origem `null`).
4. **Contrato JSON estável** — o front-end só conhece o formato, não a fonte.
5. **Três tipos de endpoint:**
   - **polling** (estado que muda sempre): `GET /api/status`
   - **lazy** (dados sob demanda ao abrir uma tela): `GET /api/device`, `/api/network`,
     `/api/systemd`, `/api/logs`
   - **ações** (efeitos colaterais): `POST /api/exec`, `POST /api/action`

### Contrato de API (modelo)

| Método | Rota | Devolve / faz |
|--------|------|---------------|
| GET | `/api/status` | CPU, RAM, load, uptime, temp, bateria, brilho, rede (poll 2 s) |
| GET | `/api/device` | hardware + SO (modelo, SoC, CPU, GPU, RAM, kernel, distro…) |
| GET | `/api/network` | interfaces, IP, MAC, gateway, SSID, DNS, rotas |
| GET | `/api/systemd` | estado, tempo de boot, serviços rodando/falhos |
| GET | `/api/logs` | `dmesg` / `journalctl` |
| POST | `/api/exec` | `{cmd}` → roda e devolve a saída (terminal) |
| POST | `/api/action` | `{action}` → brilho±, reload, reboot, poweroff |

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

UI **vanilla, sem framework, sem build** (`cyberdeck-ui/public/`): `index.html` +
`app.js` + `style.css`. Cabe em qualquer navegador embarcado e itera sem toolchain.

**Padrões (transferíveis):**
- **Abas = seções** declaradas no HTML; um array `SECTIONS` no JS dirige a navegação.
- **Dados ao vivo** por `fetch` periódico (`/api/status` a cada 2 s) + **lazy load**
  ao abrir cada aba (busca só o que aquela tela precisa).
- **Ações** = `POST` para o agente; a UI nunca toca no SO direto.
- **Degradação graciosa:** a UI roda por `file://` e **sempre renderiza**; se o agente
  cair, os campos só param de atualizar (indicador "agente: ON/OFF").
- **Camada de input abstraída** — o mesmo app responde a **teclado** e a **Gamepad
  API** (joypad). Como não há mouse, a UI desenha o **próprio cursor virtual** movido
  pelo analógico (o ponteiro do SO fica escondido). Para o Meta Platform: a entrada é
  um detalhe plugável; a navegação (trocar seção, focar item, confirmar) é a abstração.

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
| Backend Node | `cyberdeck-agent/agent.js` |
| Front-end | `cyberdeck-ui/public/` (`index.html`, `app.js`, `style.css`) |
| Empacotar/gravar | `scripts/sdcard/` (gravação segura por nome de cartão) |
| Histórico/decisões | `docs/JORNADA.md` |

> Resumo de uma linha para o Meta Platform: **“UI web em kiosk + agente local em Node
> (JSON sobre localhost) sobre uma base Linux com systemd”** — três camadas
> desacopladas, cada uma trocável sem tocar nas outras.
