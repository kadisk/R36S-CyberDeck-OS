# cyberdeck-input — ponte joypad → teclado

Daemon minúsculo (C, aarch64 estático) que torna a **UI web navegável pelos botões**
do R36S. Lê o joypad (`odroidgo3`, `/dev/input/event*`) e injeta teclas por um
**teclado virtual via `uinput`** — que o Xorg/Chromium leem como teclado real.
Não depende do X (o teclado virtual aparece sozinho para o servidor X).

## Por que uinput (e não xdotool)
- Funciona em qualquer stack (X/Wayland/console) — é o kernel que entrega as teclas.
- Sem spawn de processo por tecla (rápido), sem depender de `DISPLAY`.
- Faz `EVIOCGRAB` no joypad: os eventos crus não chegam 2× no X.

## Mapa de botões (códigos confirmados na Fase 3)
| Botão | Tecla | Uso na UI |
|-------|-------|-----------|
| D-pad ↑↓←→ | Setas | navegar / trocar aba |
| A | Enter | confirmar |
| B | Esc | voltar |
| X | Tab | próximo foco |
| Y | Backspace | voltar (browser) |
| L1 / R1 | PageUp / PageDown | trocar seção |
| L2 / R2 | Home / End | — |
| F1 | F5 | recarregar UI |

A `cyberdeck-ui` já escuta setas/PageUp/PageDown/Enter/Esc, então a navegação
funciona direto.

## Build
```sh
./build.sh            # -> cyberdeck-input (aarch64 estático)
```

## Instalar
- **Novas imagens:** já entra no `scripts/build-x11-rootfs.sh` (compila, instala
  `/usr/local/bin/cyberdeck-input`, habilita `cyberdeck-input.service`, carrega `uinput`).
- **Cartão já gravado (sem rebuild de 4GB):**
  ```sh
  sudo scripts/sdcard/sd-install-input.sh <nome-do-cartao>
  ```

Debug no serial: `journalctl -u cyberdeck-input -b`
