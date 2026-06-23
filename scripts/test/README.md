# scripts/test — bateria de teste de UI (gamepad simulado)

Teste automatizado que **finge ser o gamepad** (via `uinput`) e percorre **todas as telas**
da `interface/native-fb` **como um usuário faria** — inclusive **escolhendo a interface no
seletor de boot**. Captura cada tela e faz smoke das rotas do `cyberdeck-agent`.

## Rodar

```bash
scripts/test/test-r36s.sh            # default r36s-cyberdeck.local
scripts/test/test-r36s.sh 192.168.x.y
```

O host compila o `cdpad`, empurra para o aparelho e dispara o runner **detached** (resistente
à instabilidade do Wi-Fi do dongle); ao fim baixa os artefatos para `artifacts/uitest/`
(`report.txt` + PNGs) e imprime o resumo PASS/FAIL.

## O que cobre
- **Seletor de boot**: o gamepad simulado move p/ NATIVE e confirma (como o usuário).
- **native-fb**: HOME, STATUS (subpáginas), PROCS (filtro X / sort Y / detalhe), NET (scan X /
  conexões Y), LOGS (severidade X / detalhe), DEVICE (subpáginas), FS (entrar / atalhos X),
  SVC (filtro X / detalhe), CMD, e via menu **FN**: AJUSTES, MEDIA, ARMAZENAMENTO, KERNEL
  (nó DTB → FS), TESTE DE BOTÕES, screenshot (L2+R2).
- **Ações seguras** apenas: brilho ±, volume ±, screenshot, tocar 1 sample, scan Wi-Fi.
  **Nunca** dispara reboot/poweroff/restart/kill/expand/troca de interface.
- **Smoke do agente**: GET em todas as rotas `/api/*` → assert `{"ok":true}`.
- Ao final religa a sessão normal (web) e confere que o Chromium subiu.

## Componentes
- `cdpad.c` — gamepad virtual (uinput), lê tokens do stdin (mantém o device vivo).
- `run-ui-tests.sh` — runner que roda **no aparelho** (escreve `/root/uitest/`).
- `test-r36s.sh` — wrapper no host (compila/empurra/dispara/coleta).
