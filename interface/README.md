# interface/ — opções de interface gráfica do R36S CyberDeck OS

O CyberDeck OS é **uma base Linux + um backend** ([`cyberdeck-agent/`](../cyberdeck-agent/),
Node, JSON em `127.0.0.1:8080`) sobre o qual roda **uma interface gráfica intercambiável**.
Cada subpasta aqui é **uma stack diferente** para a mesma experiência — mesmas telas, mesma
navegação por gamepad, mesmo contrato com o agente. O usuário escolhe qual usar (no boot, a
partir da Fase 3 do roadmap).

A especificação completa e **stack-agnóstica** do que cada interface deve fazer está em
[`../docs/interface/FEATURES.md`](../docs/interface/FEATURES.md) — é a fonte da verdade para
manter as interfaces em **paridade visual e funcional**.

## Opções

| Pasta | Stack | Render | Status | Observações |
|-------|-------|--------|--------|-------------|
| [`web-vanilla/`](web-vanilla/) | HTML/CSS/JS puro (sem build) | Chromium `--kiosk` sobre Xorg/fbdev | **Oficial / referência** | A "cara" atual do CyberDeck; valida-se nela primeiro. Build: `scripts/build-x11-rootfs.sh`. |
| [`native-fb/`](native-fb/) | C, sem libs (estático) | Desenho 2D direto em `/dev/fb0` (sem X) | **Oficial alternativa (em paridade)** | Leve, boota sem Xorg/Chromium. Compilada e instalada pelo `scripts/build-x11-rootfs.sh` (imagem única); escolhida no boot pelo **seletor** (`cyberdeck-session`). |
| [`web-react/`](web-react/) | React + TypeScript + Webpack | Chromium `--kiosk` (bundle único `file://`) | **Oficial (em paridade)** | Mesma especificação/visual da `web-vanilla`, com todas as telas. Selecionável no boot (WEB/REACT/NATIVE). Build no host: `interface/web-react/build.sh`. |

## Princípios comuns

- **Backend único:** todas consomem o mesmo `cyberdeck-agent` (contrato `{ok,data}` /
  `{ok,error}`). A interface **não** acessa hardware direto — pede ao agente.
- **Paridade pela especificação:** mudanças de comportamento/UX entram primeiro em
  [`../docs/interface/FEATURES.md`](../docs/interface/FEATURES.md), depois nas interfaces.
- **Navegação por gamepad** idêntica entre stacks (D-pad, A/B, Start/Select, L1/R1, L2+R2, FN).
- **Paridade visual:** mesma paleta neon, mesma fonte/escala, mesmas cores fixas de botão
  (A vermelho · B amarelo · X azul · Y verde).

## Compartilhado (fora desta pasta)

- [`../cyberdeck-agent/`](../cyberdeck-agent/) — backend de dados/ações (Node, sem deps).
- [`../runtime/`](../runtime/) — serviços systemd + scripts de inicialização (Xorg/kiosk/agente).
- [`../scripts/`](../scripts/) — build de imagem, deploy/update via SSH e kit de cartão SD.
