# Stack gráfico fullscreen / kiosk

Objetivo: renderizar a CyberDeck UI (HTML/JS) em tela cheia, 640×480, sem desktop,
no R36S físico (GPU Mali-G31, painel MIPI-DSI via DRM/KMS).

## Opções avaliadas

| Stack | Como funciona | Prós | Contras | Veredito |
|-------|---------------|------|---------|----------|
| **DRM/KMS direto** | App desenha direto na VOP (sem servidor de janelas) | Mais leve; menor latência/RAM | Mais trabalho; runtime web precisa suportar EGLDevice/GBM | Caminho-base preferido |
| **Wayland + Cage** | `cage` = compositor kiosk (1 app fullscreen) sobre Wayland | Simples, feito p/ kiosk; integra WPE/WebKit | Depende de Wayland/EGL ok no Mali | **Recomendado** p/ runtime web |
| **Weston (kiosk-shell)** | Compositor de referência Wayland | Robusto, bem testado | Mais pesado que Cage | Alternativa a Cage |
| **WPE WebKit (fdo backend)** | WebKit p/ embarcados, render via EGL sem compositor | Feito p/ exatamente este caso | Setup do backend | Forte candidato (ver web-ui) |
| **Framebuffer (`/dev/fb0`)** | Render 2D puro, sem GL | Sempre funciona, sem Mali | Sem aceleração; runtime web limitado | **Fallback** garantido |

## Recomendação

1. **Primário:** `Cage` (Wayland kiosk) + **WPE WebKit/WebKitGTK** → UI fullscreen.
2. **Se EGL/Mali não cooperar:** WPE WebKit com backend DRM/GBM direto (sem Cage).
3. **Fallback duro:** runtime web sobre framebuffer / software rendering — a UI é
   leve (texto, listas, gauges), então software rendering é aceitável.

> ⚠️ Lição do laboratório (memória do projeto): no **QEMU**, o blob Mali não existe
> e Mesa antigo não inicializa EGL na virtio-gpu. **A validação de EGL/Mali é só no
> R36S físico.** No PC, desenvolver a UI no navegador comum e validar o caminho
> kiosk no aparelho.

## Decisões a validar (Fase 3/4)

- [ ] Mali-G31 via **blob** (libMali) ou **Mesa/Panfrost**? Qual inicializa EGL no
      painel DSI do R36S.
- [ ] Cage roda sobre o DRM do RK3326 sem X.
- [ ] Rotação do painel correta sob Wayland/KMS.
