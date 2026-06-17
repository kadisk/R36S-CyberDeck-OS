# JORNADA — como o R36S CyberDeck OS chegou à versão que funciona

Registro honesto de **tudo que foi tentado**, o que funcionou, o que falhou e
**por quê** — para futuros testes e melhorias, e para entender o caminho. A
arquitetura final está no [`../README.md`](../README.md). A versão final (Fase 5) tem
doc de resultado em [`testing/results/`](testing/results/).

> **Objetivo do projeto:** transformar o R36S (Rockchip RK3326) num CyberDeck com
> **UI em HTML/JS** (não é distro de jogos, não é EmulationStation), rodando no
> aparelho físico e navegável pelos botões.

---

## Linha do tempo (resumo)

| Fase | O que | Resultado |
|------|-------|-----------|
| 1 | Inventário do ArkOS / hardware | ✅ base de conhecimento |
| 2 | Boot mínimo próprio | ✅ booto confirmado no aparelho |
| 3 | Tela + input (renderizador nativo C) | ✅ UI nativa navegável |
| 4 | Web acelerado (Wayland + blob Mali) | ⛔ bloqueado (GBM antigo) |
| 5b | Kernel mainline + Panfrost | ⛔ painel não sobe |
| **5** | **Web por X11 (BSP) + Chromium + Gamepad API + agente** | ✅ **VERSÃO FINAL** |

---

## Fase 1 — Inventário (✅)
Localizada a imagem ArkOS de referência (somente leitura). Extraídos kernel/DTB/boot
configs (`mtools`, sem sudo). Confirmado pelo DTB real: `rockchip,rk3326-odroidgo3-linux`,
kernel **4.4.189**, painel **`elida,kd35t133` (640×480 MIPI-DSI)**, PMIC **RK817**,
joypad **`odroidgo3-joypad`** (mapa dos 17 botões). Docs: [`hardware/`](hardware/).

## Fase 2 — Boot mínimo (✅)
**Meta:** bootar uma rootfs própria reusando o boot conhecido do ArkOS.

- **Tentativa 1 (MBR/FAT do zero, `sfdisk`):** ❌ **tela apagada**. Comparando setor
  a setor, só o **MBR** diferia — o MBR feito por `sfdisk` impedia o U-Boot de achar a
  BOOT. ArkOS bootava no mesmo slot (aparelho ok).
- **Correção (modo `--clone`, definitivo):** clonar a região de boot do ArkOS
  (MBR + bootloader + FAT BOOT, byte-a-byte) e trocar **só** o `boot.ini` (nosso,
  `root=UUID` + `console=tty1`) e a **rootfs ext4**. ✅ **Boot confirmado** (banner
  "ROOTFS OK", kernel 4.4.189, shell BusyBox na tela).

**Aprendizado-chave:** **nunca recriar o MBR** — clonar o do ArkOS. Imagem gerada por
script, sem root, sem gravar em `/dev/sdX`.

## Fase 3 — Tela e input (✅, caminho nativo)
Probe no aparelho: tela **640×480 32bpp** (`/dev/fb0`), joypad em **`/dev/input/event1`**
("GO-Super Gamepad"), códigos batendo com o DTB.

- **`cyberdeck-fb/`** — renderizador 2D em C (aarch64 estático) desenhando a UI direto
  no framebuffer, lendo o joypad e navegando. **Funciona** — backlight (L2/R2) e
  bateria (RK817) inclusos. É a **UI nativa alternativa** (leve), mantida no repo.

Mas o objetivo do projeto é **UI web (HTML/JS)** — daí as Fases 4/5.

## Fase 4 — Web acelerado por Wayland + blob Mali (⛔ beco sem saída)
**Plano:** rootfs Debian + `cog`/WPE WebKit renderizando no DRM com EGL/GLES da
Mali-G31 (blob `libMali.so` do ArkOS).

- Debian arm64 bootou; Mali EGL conectado; **`cog --platform=drm` inicializa e a
  `index.html` chega a carregar**.
- ❌ Mas **segfalta no swap de buffer**; `cage`/wlroots nem carrega
  (`undefined symbol: gbm_bo_get_offset`).
- **Causa (objdump nos blobs):** o **GBM do blob Mali (2020) é antigo demais** (24
  símbolos, sem `gbm_bo_get_offset`) para o WPE/wlroots do bookworm. **Nenhuma flag
  resolve.**

**Conclusão:** web acelerada neste hardware exigiria driver Mali **aberto e moderno**.
Scripts em [`../experiments/`](../experiments/).

## Fase 5b — Kernel mainline + Panfrost + Mesa (⛔ beco sem saída)
**Ideia:** trocar BSP 4.4 + blob Mali por **mainline 6.x + Panfrost + Mesa** (GBM/EGL
modernos), reusando kernel+DTB de distros R36S mainline (Arch-R, ROCKNIX, nixos-r36s).

- ❌ O **painel deste lote de R36S não acende no mainline** — nem com Arch-R original,
  nem com overlays de timing (R36S-V12_Panel_0), nem com MultiPanel. Backlight liga,
  mas a tela fica preta.
- Forçar **só o DTB BSP** dentro de imagens de outro kernel **também falha**: kernel e
  DTB são **acoplados**.

**Conclusão central de hardware:** **somente o kernel+DTB BSP do ArkOS dirige o painel
`elida,kd35t133` deste aparelho.** Scripts em [`../experiments/`](../experiments/).

Distros prontas testadas no painel (todas ❌ exceto o caminho BSP): armbian, knulli,
ROCKNIX, Arch-R original, arkos-r3xs.

## Fase 5 — Web por X11 sobre o BSP (✅ VERSÃO FINAL)
A virada: **abandonar a aceleração** e usar o que funciona.

```
U-Boot + kernel 4.4 BSP + DTB rk3326-r35s-linux.dtb (clone do boot ArkOS) → PAINEL ACENDE
   ↓ root=UUID
Rootfs Debian bookworm arm64
   ↓
Xorg (driver fbdev em /dev/fb0, render por software)   ← sem GBM/Wayland
   ↓
Chromium --kiosk --app=file://…/cyberdeck-ui/public/index.html
```

Funciona porque **contorna os dois muros**: usa o **painel que funciona** (BSP) e o
**X11 (sem GBM)**, com render por software — a UI é leve, então basta. Detalhe:
[`testing/results/phase5-x11-2026-06-15.md`](testing/results/phase5-x11-2026-06-15.md).

### Input — resolvido pela Gamepad API (não pelo uinput)
Primeiro foi tentada uma **ponte uinput** (daemon C → teclado virtual). Mas:
- ❌ o módulo `uinput` provavelmente não está no kernel BSP (rootfs Debian sem
  `/lib/modules` da 4.4);
- ✅ **o Chromium expõe o joypad direto pela Gamepad API** — então a UI navega sem
  teclado virtual.

A ponte uinput foi para [`../experiments/cyberdeck-input/`](../experiments/cyberdeck-input/).
Mapa do joypad **confirmado no aparelho** (aba TECLAS, dump ao vivo):

| Botão | índice | · | Botão | índice |
|---|---|---|---|---|
| B | 0 | | ↑ | 8 |
| A | 1 | | ↓ | 9 |
| X | 2 | | ← | 10 |
| Y | 3 | | → | 11 |
| L1 | 4 | | Select | 12 |
| R1 | 5 | | Start | 13 |
| R2 | 6 | | Fn | 16 |

Navegação: L1/R1 e D-pad ←→ trocam aba; ↑↓ movem foco; A/Start confirmam; B/Select voltam.

### Dados ao vivo — `cyberdeck-agent`
Servidor HTTP minúsculo em C (`127.0.0.1:8080`) que lê `/proc` + `/sys` (rk817) e
devolve JSON (CPU/RAM/load/uptime/temp/bateria/brilho/rede) com CORS liberado. A UI
faz `fetch` a cada 2 s. Roda por `file://` (sempre renderiza; se o agente cair, só
para de atualizar).

---

## Lições que valem para o futuro
1. **Boot:** clonar a região de boot do ArkOS; nunca recriar o MBR.
2. **Painel:** só o **kernel+DTB BSP** acende este painel — qualquer caminho web tem
   que rodar sobre o BSP.
3. **Web acelerado (Wayland/Mali):** bloqueado pelo GBM antigo do blob; só destravaria
   com Mesa/Panfrost — que por sua vez depende do painel subir no mainline (não sobe).
4. **X11 + software rendering** é suficiente para uma UI leve — foi o que destravou.
5. **Input:** a Gamepad API do Chromium já vê o joypad; não precisa de uinput.
6. **Iteração:** dá para atualizar só a UI (`sd-update-ui.sh`) ou só a imagem
   (`sd-update.sh`) por **nome do cartão**, sem `dd` manual.
