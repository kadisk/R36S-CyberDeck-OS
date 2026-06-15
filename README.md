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
| **Dados** | **`cyberdeck-agent`** (servidor HTTP em C, JSON de `/proc`+`/sys`) | UI viva via `fetch`, sem deps pesadas |

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
sudo scripts/sdcard/sd-update-ui.sh <cartao>    # empurra só a UI (HTML/JS) p/ o cartão
```

Kit de SD completo em [`scripts/sdcard/`](scripts/sdcard/) (ver o README de lá): grava
por **nome do cartão** (descobre o `/dev/sdX` sozinho), recusa discos não-removíveis e
do sistema, e nunca toca no cartão do ArkOS.

---

## Controles (navegação pelo gamepad)

| Botão | Ação |
|---|---|
| **L1 / R1** e **D-pad ← →** | trocar de aba |
| **D-pad ↑ ↓** | mover foco no menu |
| **A** / **Start** | confirmar |
| **B** / **Select** | voltar pro STATUS |

A aba **TECLAS** mostra um dump ao vivo de botões/eixos (diagnóstico de input).

---

## Estrutura do repositório

```
cyberdeck-ui/    UI web (HTML/CSS/JS) — a cara do CyberDeck
cyberdeck-agent/ agente de dados do sistema (servidor HTTP em C → JSON)
cyberdeck-fb/    UI nativa alternativa (renderizador 2D em C no framebuffer)
scripts/         build-x11-rootfs.sh + inspeção do ArkOS + kit de SD (sdcard/)
runtime/         serviços systemd + scripts de inicialização (Xorg/kiosk/agent)
board/r36s/      arquivos da placa (boot.ini, overlays)
artifacts/       artefatos de referência extraídos do ArkOS (boot/DTB)
docs/            documentação + JORNADA.md (como chegamos aqui, becos sem saída)
experiments/     tentativas que NÃO entraram (Wayland/Mali, mainline, uinput)
```

Histórico em [`CHANGELOG.md`](CHANGELOG.md); jornada completa e tentativas em
[`docs/JORNADA.md`](docs/JORNADA.md).
