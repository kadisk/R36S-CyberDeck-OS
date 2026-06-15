# Runtime web — opções

Como executar a CyberDeck UI (HTML/CSS/JS) em fullscreen no R36S (~1 GB RAM,
Mali-G31). **Electron NÃO é a primeira opção** (pesado demais).

## Opções

| Runtime | Descrição | RAM/peso | GL/EGL | Kiosk | Veredito |
|---------|-----------|----------|--------|-------|----------|
| **WPE WebKit** | WebKit para embarcados; backend FDO/DRM; sem desktop | Leve | EGL/GLES (Mali) | Nativo | **Recomendado** |
| **WebKitGTK** | WebKit GTK; rodar sob Cage/Weston em modo kiosk | Médio | EGL via GTK | Via Cage | Boa alternativa |
| **Chromium kiosk** | `chromium --kiosk --app=...` | **Pesado** | EGL | `--kiosk` | **Fallback** |
| **Browser minimalista** (surf, luakit, ...) | WebKit fino | Leve | depende | parcial | Diagnóstico |
| **Node local + WebView** | Node serve a UI; um WebView a exibe | Médio | — | — | Útil p/ dados |
| **Electron** | Chromium+Node empacotados | **Muito pesado** | EGL | sim | ❌ evitar |

## Recomendação

- **Render:** **WPE WebKit** sob **Cage** (Wayland kiosk) — ver
  `docs/graphics/fullscreen-kiosk-stack.md`.
- **Dados do sistema:** um **agente local leve** (shell ou Node mínimo) expõe
  CPU/RAM/rede/bateria via arquivo JSON ou WebSocket; a UI consome.
- **Terminal:** pty exposto por WebSocket (ex.: `ttyd`/`xterm.js`) ou um terminal
  embutido simples.

## Servir a UI

A UI é estática (`cyberdeck-ui/public`). Opções de entrega:
- `file://` direto no WPE (mais simples; sem servidor).
- Servidor HTTP local mínimo (`busybox httpd`, `python -m http.server`, ou Node)
  quando precisar de endpoints de dados/terminal.

## A validar no aparelho

- [ ] WPE WebKit inicializa EGL no Mali-G31 do R36S.
- [ ] Consumo de RAM do runtime escolhido cabe folgado em ~1 GB.
- [ ] Gamepad chega à UI (Gamepad API ou ponte de input).
