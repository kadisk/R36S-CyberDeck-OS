# Fase 3 — Tela e Input (plano)

Objetivo: controlar a **tela** e ler o **joypad** no R36S, sem GL pesado, como base
para a CyberDeck UI. Já sabemos da Fase 2 que o **painel funciona** (fbcon mostrou
texto na tela) — então há `/dev/fb0` e o caminho de framebuffer está vivo.

## Estratégia escolhida: framebuffer direto (`/dev/fb0`)

Em vez de subir EGL/Mali (frágil) já, começamos desenhando **direto no framebuffer**
— funciona hoje, é leve, e serve de base para um renderizador 2D próprio (o
"launcher backend DRM/dumb-buffer sem GL" previsto). Depois avaliamos DRM/KMS e,
mais tarde, runtime web.

## Limitação de desenvolvimento

O R36S **não tem teclado**. O ciclo é: editar → gerar imagem → gravar microSD →
bootar → ler resultados na partição BOOT (no PC). Por isso os experimentos rodam
no boot (`/etc/init.d/phase3-probe.sh`) e gravam logs em BOOT.

> Aceleração futura (opcional): shell interativo via **USB gadget serial** (g_serial
> pela OTG) ou **teclado USB** na OTG, ou **Wi-Fi dongle + dropbear (SSH)**. Precisa
> dos módulos do kernel no rootfs (extrair do rootfs ArkOS). Fica para depois.

## Experimento 1 — probe de tela + input (`phase3-probe.sh`)

Roda uma vez (marcador `.phase3-probe-done` na BOOT) e:

1. **Loga geometria do framebuffer**: `fbset -i` e `/sys/class/graphics/fb0/`
   (resolução, bits por pixel, stride) + lista `/dev/dri`, `/dev/fb*`, `/dev/input`,
   `/proc/bus/input/devices`. → arquivo `cyberdeck-fbinfo.txt` na BOOT.
2. **Teste visível na tela**: preenche `/dev/fb0` com **ruído → preto → branco**
   (com pausas). Se a tela muda, **confirmamos controle do framebuffer**.
3. **Captura do joypad**: mostra "PRESSIONE TODOS OS BOTÕES" e grava ~30 s de
   eventos crus de cada `/dev/input/event*` em `input-eventN.bin` (+ hexdump
   `input-eventN.hex`) na BOOT. Decodificamos no PC (struct `input_event`, 24 bytes
   no kernel 64-bit: type@16, code@18, value@20) e cruzamos com o mapa do DTB
   (`odroidgo3-joypad`, ver `docs/hardware/input-buttons.md`).

### O que isso entrega

- bpp/stride reais → permite desenhar **cores corretas** no passo seguinte.
- Qual `event*` é o joypad e os **códigos reais** de cada botão (confirma o DTB).
- Base para: um renderizador 2D no framebuffer + leitor de input → primeiro
  "shell gráfico" navegável por botões (precursor da UI HTML/JS).

## Próximos passos (após o experimento 1)

1. Desenhar formas/texto no framebuffer com cores corretas (bpp conhecido).
2. Leitor de input mapeando botões → ações (navegação).
3. Avaliar `/dev/dri/card0` (KMS) para double-buffering sem tearing.
4. Só então: runtime web (WPE/Cage) ou renderizador próprio para a UI.
