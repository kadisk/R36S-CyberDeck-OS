# cyberdeck-ui

Interface do **R36S CyberDeck OS** — HTML/CSS/JavaScript, 640×480, fullscreen/kiosk,
navegável **só por botões**. v1 sem dependências nem build.

## Desenvolver no PC

```bash
cd cyberdeck-ui
npm run dev        # ou: python3 -m http.server 8080 --directory public
# abra http://localhost:8080  (redimensione p/ 640x480)
```

Teclas que emulam o gamepad do R36S durante o desenvolvimento:
- ← / → (ou PageUp/PageDown): trocar de aba (L1/R1)
- Enter: A (confirmar) · Esc: B (voltar)

## Estrutura

```
public/
  index.html   layout + seções
  style.css    tema terminal 640x480
  app.js       navegação, relógio, dados (stub)
src/           (reservado p/ evolução; v2+ se precisar de bundler)
```

## No aparelho

Renderizada por **WPE WebKit** sob **Cage** (Wayland kiosk) — ver
`../docs/web-ui/runtime-options.md` e `../docs/graphics/fullscreen-kiosk-stack.md`.
Iniciada por `../runtime/scripts/start-cyberdeck-ui.sh` via
`../runtime/services/cyberdeck.service`.

## Seções

terminal · status (CPU/RAM/load/temp) · rede · bateria · relógio · logs ·
comandos rápidos · ferramentas · dispositivo.

> Dados reais virão de um agente local (Fase 5). Hoje há valores de demonstração.
