# Plano DRM/KMS — R36S

## Hardware DRM

- Driver: **rockchip-drm** (VOP `ff460000.vop`).
- Conector: **MIPI-DSI** (`ff450000.dsi`) → painel `elida,kd35t133` (640×480).
- GPU de render: **Mali-G31** (Bifrost) — render separado do display (VOP só faz
  scanout; GL/EGL é na GPU via GBM).

## Modelo split render/scanout

```
Mali-G31 (render, GBM/EGL)  ──►  buffers (dmabuf)  ──►  VOP (scanout, KMS)  ──► painel DSI
```

- **GBM** aloca buffers; **EGL** (Mali ou Mesa/Panfrost) renderiza; **KMS**
  (`drmModeSetCrtc`/atomic) apresenta na VOP.

## Caminhos de inicialização

1. **Wayland (Cage/Weston):** o compositor cuida de KMS+GBM+EGL; a app web só fala
   Wayland. **Mais simples.**
2. **DRM direto:** o runtime web (ex.: WPE com backend DRM) faz KMS+GBM+EGL ele
   mesmo. **Mais leve**, mais setup.
3. **Software/dumb-buffer:** sem GL — alocar *dumb buffer* KMS e fazer `drmModeSetCrtc`.
   Útil para o **fallback** e para diagnósticos (provado funcionar sem Mali no
   laboratório QEMU com virtio-gpu).

## Verificações no aparelho

```bash
# nós DRM presentes?
ls /dev/dri/                       # card0, renderD128
modetest -M rockchip              # conectores/modos (640x480?)
cat /sys/class/backlight/*/brightness
```

## Riscos / notas

- O blob **Mali** do ArkOS é linkado a libs específicas; para o CyberDeck preferir
  **Mesa/Panfrost** (mainline) se a versão do kernel/DTB permitir. Decidir na Fase 3.
- Rotação do painel pode exigir `plane`/`CRTC` rotation ou rotação na UI (CSS).
- QEMU **não** reproduz esse caminho (sem Mali/DSI) — validar só no R36S.
