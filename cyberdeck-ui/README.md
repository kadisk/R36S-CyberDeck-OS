# cyberdeck-ui

Interface do **R36S CyberDeck OS** — HTML/CSS/JavaScript puro, 640×480, fullscreen/kiosk,
navegável **só por gamepad**. Sem framework, sem build, sem dependências.

## Desenvolver no PC

```bash
cd cyberdeck-ui
npm run dev        # ou: python3 -m http.server 8080 --directory public
# abra http://localhost:8080  (redimensione p/ 640x480)
# precisa do agente p/ dados: node ../cyberdeck-agent/agent.js 8080
```

Atalho de teste: `index.html#procs` (ou `#device`, `#systemd`, …) abre direto numa aba.

Teclado que emula o gamepad durante o desenvolvimento:
- **← / →**: trocar de aba · **↑ / ↓** (ou Tab): mover foco
- **Enter**: A (confirmar/abrir) · **Esc / Backspace**: B (voltar um nível)
- **PageUp/PageDown**: scroll do conteúdo

## Estrutura

```
public/
  index.html     casca: top bar, abas, #content, modal de confirmação, cursor virtual
  style.css      tema cyberdeck 640x480 (alta densidade, contraste forte)
  app.js         bootstrap + router (go/back/nextTab) + polling de status + relógio
  js/
    state.js     namespace CD + estado central (aba ativa, modos por-view)
    api.js       cliente do agente: desempacota {ok,data}, marca agente ON/OFF, timeout
    ui.js        helpers de DOM (h/kv/gauge/badge), formatação, toast, confirm()
    views.js     todas as telas (HOME/STATUS/DEVICE/FS/SVC/PROCS/NET/LOGS/CMD/TOOLS/KEYS)
    gamepad.js   input: teclado, Gamepad API, cursor virtual (analóg. esq.), scroll (dir.)
```

> Carregada por `file://`, então **sem ES modules** — os scripts compartilham o
> namespace global `window.CD` e são incluídos por ordem em `index.html`.

## Telas

**HOME** (cards) · **STATUS** · **DEVICE** · **FS** (read-only) · **SVC** (systemd) ·
**PROCS** · **NET** · **LOGS** · **CMD** (allowlist) · **TOOLS** (ações) · **KEYS** (debug).

Padrão **mestre→detalhe** em FS/SVC/PROCS: A abre, B volta um nível. Ações perigosas
pedem confirmação em tela cheia.

## No aparelho

Renderizada por **Chromium `--kiosk`** sob **Xorg fbdev** (`/dev/fb0`), iniciada por
`../runtime/scripts/cyberdeck-kiosk.sh`. Dados ao vivo do **`cyberdeck-agent`**
(`127.0.0.1:8080`). Ver `../README.md` e `../docs/STACK.md`.
