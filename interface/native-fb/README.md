# cyberdeck-fb — renderizador 2D no framebuffer (Fase 3)

UI nativa do R36S CyberDeck OS desenhada **direto no `/dev/fb0`** (sem GL/EGL),
navegável pelo joypad. É o **precursor nativo** da UI HTML/JS — prova a interação
completa (tela + input) no hardware, leve o bastante para o RK3326.

## Por quê

A Fase 2 confirmou que o **framebuffer funciona** (640×480, **32 bpp**, stride 2560).
Em vez de subir EGL/Mali (frágil) já, desenhamos em 2D no framebuffer: funciona hoje,
é leve e vira a base de um "shell gráfico" do cyberdeck.

## O que faz

- Detecta geometria/bpp em runtime (`FBIOGET_*SCREENINFO`, `mmap`) — 16/32 bpp.
- Desenha barra de título + relógio, menu lateral (STATUS, REDE, …, DEVICE),
  painel de conteúdo (STATUS mostra CPU/RAM/uptime/hora ao vivo; DEVICE mostra
  modelo/tela/SoC) e um painel de **debug de input** (últimos códigos lidos).
- Lê o joypad por `/dev/input/event*` (códigos **confirmados** do `odroidgo3-joypad`,
  ver `../docs/hardware/device-captures/joypad-capture-2026-06-15.txt`):
  D-pad ↑↓ move, L1/R1 também trocam, **F5 sai**.
- Põe o `tty1` em `KD_GRAPHICS` p/ o fbcon não desenhar por cima.

## Build (cross-compile aarch64, estático)

```bash
./build.sh        # ou: make
# saída: build/cyberdeck-fb  (ELF aarch64, -static)
```

Requer `aarch64-linux-gnu-gcc` (Ubuntu: `gcc-aarch64-linux-gnu`). A fonte bitmap
(`src/font8x16.h`) é gerada de uma fonte de console PSF por `tools/gen-font.py`
(versionada no repo).

## Como entra na imagem

`scripts/create-minimal-rootfs.sh` compila e instala em `/usr/local/bin/cyberdeck-fb`.
O `inittab` lança no `tty1` via `cyberdeck-launch.sh` (se o renderizador sair/faltar,
cai num shell **na tela** — depuração sem cabo serial).

## Próximos passos

- Mapear A/B/X/Y e F-keys para ações (abrir seção, voltar, brilho via
  `/sys/class/backlight/backlight/brightness`).
- Dados ao vivo nas outras seções (rede, bateria via `/sys/class/power_supply`).
- Double-buffering: usar `/dev/dri/card0` (KMS) ou pan do framebuffer p/ evitar flicker.
- Depois: decidir entre evoluir este renderizador OU subir runtime web (WPE) p/ a UI HTML/JS.
