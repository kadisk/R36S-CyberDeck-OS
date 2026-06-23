# cyberdeck-web-react

Interface web do CyberDeck OS em **React + TypeScript + Webpack**, consumindo o mesmo
`cyberdeck-agent` que as outras interfaces. Roda em Chromium kiosk por `file://` no R36S
(640×480), com paridade visual com a `web-vanilla` e a `native-fb`.

## Por que Webpack (e não Vite)
O kiosk abre a UI por `file://` e o Chromium **bloqueia ES modules** nesse esquema. O Webpack
gera **um bundle único** (`dist/bundle.js`) com `publicPath: './'` e CSS injetado (style-loader)
— funciona por `file://`. O build do Vite usa `<script type=module>`, que quebraria.

## Estado (1º corte — fundação)
Prontas: **HOME, STATUS** (AO VIVO/ENERGIA/TENDÊNCIA), **REDE**, **LOGS** (origem/severidade/
detalhe), **APAR.** (DEVICE: ID/CPU/DISPLAY/BOOT/INPUT). Casca completa: top bar (badge **REACT**),
abas, rodapé, menu **FN**, confirmação e toast. Camada de **input** (Gamepad API + teclado +
ponteiro/scroll dos analógicos) portada da `web-vanilla`. 2ª leva: PROCS, FS, SVC, CMD, KERNEL,
AJUSTES, MEDIA, STORAGE, KEYS.

## Estrutura
```
src/index.tsx  App.tsx  store.ts  sections.ts  types.ts  styles.css
src/lib/        api.ts (cliente do agente)  format.ts  history.ts  useAgentPoll.ts
src/input/      useInput.ts (Gamepad API + teclado + foco 2D no DOM [data-focus])
src/components/ TopBar Tabs Footer FnMenu Confirm Toast  ui (Tile/Gauge/KV/Badge/SubBar/Focusable)
src/screens/    Home Status Net Logs Device  + registry.ts
```

## Desenvolver
```bash
npm install
npm run dev         # webpack --watch (gera dist/)
npm run typecheck   # tsc --noEmit
npm run build       # bundle de produção em dist/
```
Para testar com dados reais, suba o agente (`node ../../cyberdeck-agent/agent.js`) e abra
`dist/index.html` no Chromium.

## No aparelho
- O `scripts/build-x11-rootfs.sh` instala `dist/` em `/usr/share/cyberdeck-web-react/`
  (é preciso ter rodado `./build.sh` antes — o bundle é gerado no host).
- O **seletor de boot** (`cyberdeck-chooser`) oferece WEB / **REACT** / NATIVE; a escolha vai p/
  `/var/lib/cyberdeck/interface` (`react`) e o `cyberdeck-kiosk.sh` carrega este bundle.
- Deploy rápido em dev: `scripts/deploy-r36s.sh <host> react`.
