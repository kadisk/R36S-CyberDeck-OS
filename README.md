# R36S CyberDeck OS

Distribuição Linux embarcada que transforma o **handheld R36S** (Rockchip RK3326)
num **CyberDeck portátil** — com uma interface em **HTML/CSS/JavaScript** rodando em
**kiosk** direto no aparelho. **Não é distro de jogos**, não usa EmulationStation,
não depende de emuladores.

> ✅ **Funciona no R36S físico:** a UI web renderiza na tela e é **navegável pelo
> gamepad**, com dados do sistema **ao vivo** (CPU, RAM, bateria, rede).

A história de como se chegou aqui — e **as outras tentativas/imagens que não deram
certo** — está em [`docs/JORNADA.md`](docs/JORNADA.md).

---

## O que é

- Uma distro Linux enxuta para o R36S, cuja cara é uma **UI web própria** (640×480).
- Um **CyberDeck**: status do sistema, rede, ferramentas, logs — não um console.
- A UI ([`cyberdeck-ui/`](cyberdeck-ui/)) é HTML/JS sem dependências, em modo kiosk.

## Base e como ela foi montada

A versão que funciona combina **três decisões** descobertas na prática (ver
[`docs/JORNADA.md`](docs/JORNADA.md) para o porquê de cada uma):

| Camada | Escolha | Por quê |
|--------|---------|---------|
| **Boot** | Região de boot **clonada do ArkOS** (U-Boot + **kernel BSP 4.4** + `rk3326-r35s-linux.dtb`) | **Só o kernel+DTB BSP acende o painel** deste lote (mainline não sobe) |
| **Rootfs** | **Debian bookworm arm64** (debootstrap) | base limpa e atual, sem herdar o ArkOS |
| **Tela** | **Xorg** com driver **fbdev** em `/dev/fb0` (render por software) | evita Wayland/GBM do blob Mali (antigo demais) |
| **UI** | **Chromium `--kiosk`** abrindo `file://…/cyberdeck-ui` | navegador padrão, software rendering basta p/ UI leve |
| **Input** | **Gamepad API** do Chromium (joypad direto) | dispensa uinput/teclado virtual |
| **Dados** | **`cyberdeck-agent`** (backend **Node.js** modular, sem deps) servindo JSON de `/proc`+`/sys`+comandos allowlist | alimenta TODAS as abas (hardware, SO, FS, systemd, processos, rede, logs, ações) |

Pipeline de construção ([`scripts/build-x11-rootfs.sh`](scripts/build-x11-rootfs.sh)):

```
debootstrap Debian bookworm arm64 (2 estágios, qemu-aarch64-static)
  → instala xserver-xorg (fbdev) + chromium + zram + a cyberdeck-ui
  → compila e instala cyberdeck-agent (dados do sistema)
  → clona a região de boot do ArkOS (MBR + bootloader + FAT) byte-a-byte
  → escreve nosso boot.ini (root=UUID, console=tty1) + DTB do painel
  → empacota .img (ext4 por UUID) e registra a imagem como 'x11'
```

> ⚠️ O ArkOS é usado **somente como referência de boot/hardware** — a imagem é
> **somente leitura** e nunca é modificada. O rootfs final é Debian, não ArkOS.

---

## Hardware do R36S (resumo — ver [`docs/hardware/`](docs/hardware/))

| Componente | Detalhe |
|---|---|
| SoC | Rockchip **RK3326** · 4× Cortex-A35 (AArch64) |
| RAM | ~1 GB (zram ativo p/ alívio) |
| GPU | ARM **Mali-G31** (blob antigo — sem GL aberto utilizável) |
| Display | Painel MIPI-DSI **`elida,kd35t133`**, **640×480**, backlight PWM |
| PMIC / Áudio | **RK817** (power, bateria, carga) · `rk817-codec` |
| Input | **odroidgo3-joypad** (`/dev/input/event1`) |
| Kernel | Linux **4.4.189** (BSP Rockchip, do boot ArkOS) |

Sem Wi-Fi/Ethernet internos — rede só via **dongle USB**.

---

## Como construir e gravar

Pré-requisitos no host: `debootstrap`, `qemu-aarch64-static` (+binfmt),
`aarch64-linux-gnu-gcc`, `mtools`. As ações que mexem em cartão são **scripts
`sudo` separados** e seguras (allowlist + fingerprint do cartão).

```bash
# 1) Construir a imagem (usa todos os cores do host)
sudo scripts/build-x11-rootfs.sh          # gera a .img e registra a imagem 'x11'

# 2) Autorizar seu microSD DE TESTE (uma vez) e gravar por NOME
sudo scripts/sdcard/sd-allow.sh           # registra o cartão na allowlist
sudo scripts/sdcard/sd-update.sh <cartao> x11   # grava a imagem 'x11' no cartão
```

Iteração rápida (sem regravar 4 GB):

```bash
sudo scripts/sdcard/sd-update-ui.sh <cartao>          # empurra só a UI (HTML/JS) p/ o cartão
sudo scripts/sdcard/sd-get-screenshots.sh <cartao>    # recupera os prints (/root/screenshots) p/ o host
```

Kit de SD completo em [`scripts/sdcard/`](scripts/sdcard/) (ver o README de lá): grava
por **nome do cartão** (descobre o `/dev/sdX` sozinho), recusa discos não-removíveis e
do sistema, e nunca toca no cartão do ArkOS.

---

## Controles (navegação pelo gamepad)

| Controle | Ação |
|---|---|
| **D-pad ↑↓←→** | navegação **espacial 2D** do foco (grid/listas); nas bordas horizontais, troca de aba |
| **A** | ativa o item **selecionado** (modo D-pad) ou clica no ponteiro (modo analógico) |
| **Start** | ativar o item focado |
| **B** / **Select** | voltar um nível |
| **Analógico esq.** | move o **ponteiro REAL do X** |
| **Analógico dir.** | **scroll** vertical |
| **L1 + R1** (combo) | **screenshot** (salvo em `/root/screenshots/`) |
| **Volume + / −** | volume do sistema (via `amixer`) |

Atalhos de teclado (dev/USB): **+ / −** mudam o tamanho da fonte · **F12** ou
**PrintScreen** tiram screenshot · **AudioVolumeUp/Down/Mute** controlam o volume.
O tamanho da fonte também tem botões em **TOOLS → DISPLAY/UI** (persistido no agente).

> **Dois modos de input:** ao usar o **D-pad**, o ponteiro **some** e o **A ativa o item
> selecionado** (não depende do mouse); ao mexer no **analógico**, o ponteiro **reaparece**,
> faz *hover-select* e o A clica nele; sem uso por alguns segundos, o ponteiro some de novo.
>
> O **analógico esquerdo move o ponteiro de verdade do X** (não um cursor desenhado):
> isso é feito pelo driver `xserver-xorg-input-joystick` (`/etc/X11/xorg.conf.d/60-joystick.conf`),
> fora do navegador. O ponteiro do X fica **visível**. O clique do analógico não existe
> neste joypad, então **A clica** onde o ponteiro está. L1/R1 não trocam de aba.
>
> ⚠️ Índices de eixo/deadzone do `60-joystick.conf` podem precisar de ajuste no aparelho
> (use `evtest`/`xinput`) — **ainda não validado no R36S físico**.
>
> **Sensibilidade do ponteiro (suavidade):** o `60-joystick.conf` já vem com `deadzone`
> grande + `ConstantDeceleration` p/ um ponteiro lento e fácil de controlar. Para ajustar
> **ao vivo, sem reflashar** (via SSH/serial, com `DISPLAY=:0`):
> ```bash
> xinput --list                                   # achar o nome do joypad
> # maior = mais lento/suave:
> DISPLAY=:0 xinput --set-prop "<joypad>" "Device Accel Constant Deceleration" 4.0
> ```
> Para deixar permanente, mude `ConstantDeceleration` no `60-joystick.conf` (e/ou aumente
> `deadzone`) e rebuild/flash.

Padrão **mestre→detalhe** nas abas FS, SVC e PROCS: **A** abre o detalhe/arquivo,
**B** volta um nível (detalhe→lista, arquivo→diretório, subdir→pai). Ações perigosas
(restart/stop de serviço, kill de processo, reboot/poweroff) abrem uma **tela de
confirmação** — só executam com **A**; **B** cancela.

A aba **KEYS** mostra um dump ao vivo de botões/eixos (diagnóstico de input).

## Abas da UI (alimentadas pelo `cyberdeck-agent`)

A tela inicial é a **HOME**, com **cards agrupados por semântica**: **MONITOR** (ao vivo:
STATUS/PROCS/NET/LOGS), **SISTEMA** (inspeção: DEVICE/KERNEL/FS/SVC), **AÇÕES** (CMD/TOOLS)
e **DIAGNÓSTICO** (KEYS). A barra de abas segue a mesma ordem.

| Aba | Mostra |
|---|---|
| **HOME** | painel inicial com cards de todas as seções + resumo (host, uptime, cores) |
| **STATUS** | CPU, RAM, brilho, load, uptime, temp, bateria — ao vivo (2 s). Bateria: % bruto do rk817 **+ estimativa por OCV** (tabela 1S LiPo, compensada por I·R) — o `capacity` do rk817 é instável e é marcado quando duvidoso |
| **DEVICE** | identidade, hardware (freq/core, temps, mem/zram), kernel/boot, tela/backlight, input (joypad/USB) |
| **FS** | navegação **read-only** do rootfs: lista, permissões, tamanho, symlinks; viewer de texto; atalhos |
| **SVC** | systemd: resumo + lista filtrável → detalhe (status, unit file, logs) + ações (start/stop/restart) |
| **PROCS** | processos via `/proc`: resumo, ordenação/filtro, → detalhe por PID + sinais (SIGTERM/SIGKILL) |
| **NET** | interfaces (estado, IPs, MAC, RX/TX), gateway, DNS, SSID/sinal, conexões (`ss`) |
| **LOGS** | dmesg / journal / unidades (agent, kiosk, ui) com filtro de severidade, busca e pausa |
| **CMD** | comandos prontos por categoria (**allowlist**); saída em tela cheia, B volta |
| **TOOLS** | DISPLAY/UI (fonte ±, screenshot) + ações: brilho/volume ±, recarregar UI, reiniciar agente/kiosk, reboot, poweroff |
| **KERNEL** | kernel detalhado (version, cmdline, taint, módulos carregados) + **Device Tree** (modelo, compatible, bootargs, nós) — card na HOME |
| **KEYS** | diagnóstico de input (teclas/botões/eixos ao vivo) — acessível por card na HOME |

### Endpoints do agente (`127.0.0.1:8080`, JSON `{ok,data}` / `{ok,error}`)

```
GET  /api/status                 GET  /api/fs/list?path=     GET  /api/processes
GET  /api/device                 GET  /api/fs/read?path=     GET  /api/processes/:pid
GET  /api/network/summary        GET  /api/fs/bookmarks      POST /api/processes/:pid/signal {signal}
GET  /api/network/connections    GET  /api/systemd/summary   GET  /api/logs?source=&severity=&q=
GET  /api/systemd/services       GET  /api/systemd/service?unit=   GET /api/logs/sources
GET  /api/systemd/logs?unit=     POST /api/systemd/action {action,unit}
GET  /api/commands               POST /api/commands/exec {key}
GET  /api/actions                POST /api/actions {key}    (inclui volume-up/down/mute)
GET  /api/kernel                 GET/POST /api/settings {fontScale}
GET  /api/device                 POST /api/screenshot       -> /root/screenshots/*.png
```

**Modelo de segurança:** o agente roda em `127.0.0.1` e **não expõe execução de shell
arbitrária**. Comandos (`CMD`) e ações (`TOOLS`, `SVC`) são **allowlist** validadas no
backend; tudo via `execFile` (sem shell). FS é **read-only** com path saneado (sem
`../` para fora da raiz), limites de tamanho/entradas e detecção de binário. Nomes de
unit e sinais são validados por regex/allowlist. Detalhes em [`docs/STACK.md`](docs/STACK.md).

### Validação local (host)

```bash
find cyberdeck-agent -name '*.js' -exec node --check {} \;   # sintaxe do backend
node cyberdeck-agent/agent.js 8080 &                          # sobe o agente
( cd cyberdeck-ui/public && python3 -m http.server 8090 )     # serve a UI
# abra http://localhost:8090  (640x480) — ou index.html#procs p/ ir direto numa aba
```

> Sem o agente, a UI mostra **agente: OFF** no rodapé e uma tela de erro amigável por
> aba (não trava). `dmesg`/journal completos dependem de rodar como root (no R36S o
> `cyberdeck-agent` roda como root via systemd).

---

## Estrutura do repositório

```
cyberdeck-ui/    UI web (HTML/CSS/JS, public/js/*) — a cara do CyberDeck (HOME + abas)
cyberdeck-agent/ backend Node.js modular (agent.js + lib/*.js) — JSON de hw/SO/FS/systemd/procs/rede/logs
cyberdeck-fb/    UI nativa alternativa (renderizador 2D em C no framebuffer)
scripts/         build-x11-rootfs.sh + inspeção do ArkOS + kit de SD (sdcard/)
runtime/         serviços systemd + scripts de inicialização (Xorg/kiosk/agent)
board/r36s/      arquivos da placa (boot.ini, overlays)
artifacts/       artefatos de referência extraídos do ArkOS (boot/DTB)
docs/            documentação + JORNADA.md (como chegamos aqui, becos sem saída)
experiments/     tentativas que NÃO entraram (Wayland/Mali, mainline, uinput)
```

Histórico em [`CHANGELOG.md`](CHANGELOG.md); jornada completa e tentativas em
[`docs/JORNADA.md`](docs/JORNADA.md). **Arquitetura e stack** (Linux + Node.js +
front-end) como referência reaproveitável em [`docs/STACK.md`](docs/STACK.md).
