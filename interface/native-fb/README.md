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

`scripts/build-x11-rootfs.sh` cross-compila e instala `cyberdeck-fb` **e** o seletor de boot
`cyberdeck-chooser` em `/usr/local/bin` (imagem única Debian). No boot, o
`cyberdeck-session.service` roda o seletor e lança a interface escolhida (web ou native-fb).
A native-fb consome o `cyberdeck-agent` (HTTP) — a mesma fonte de dados da web.

## Estado

Em **paridade** com a `web-vanilla` (ver [`../../docs/interface/FEATURES.md`](../../docs/interface/FEATURES.md)):
arquitetura modular (`fb`/`input`/`http`/`ui`/`views` + cJSON), double buffering, navegação por
joypad, mestre→detalhe, confirmação de ações, screenshot (fbgrab) e as 12 telas + menu FN.
Gaps menores: filtro de severidade em LOGS, scan Wi-Fi/`ss` em NET.
