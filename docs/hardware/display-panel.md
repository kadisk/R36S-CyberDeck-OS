# Display / painel — R36S

## Resumo

| Item | Valor |
|------|-------|
| Resolução | **640 × 480** |
| Interface | MIPI-DSI |
| Painel | `elida,kd35t133` |
| Controller | Rockchip VOP `ff460000.vop` |
| DSI host | `ff450000.dsi` |
| Backlight | PWM 3.3 V (`vcc_backlight`) |
| GPU | ARM Mali-G31 (Bifrost) `ff400000.gpu` |

## Implicações para a UI

- **Design para 640×480.** Densidade alta; fontes legíveis (≥ 14–16 px), poucos
  elementos por tela, navegação vertical.
- **Orientação:** confirmar no aparelho (alguns RK3326 montam o painel rotacionado;
  o ArkOS aplica rotação via DT/`rotate`). Verificar ao validar Fase 3.
- **Backlight controlável** via `/sys/class/backlight/*/brightness` — a UI pode
  expor um controle de brilho.

## Caminho gráfico planejado

1. **DRM/KMS direto** sobre a VOP — sem X11. Ver `docs/graphics/drm-kms-plan.md`.
2. Runtime web desenha via EGL/GLES (Mali) ou software, em fullscreen.
3. Sem compositor pesado: **Cage** (Wayland kiosk) ou render direto.

## A confirmar no R36S físico

- [ ] Nó exato do painel e timings no `.dts` (via `identify-r36s-dtb.sh`).
- [ ] Rotação correta do framebuffer.
- [ ] Caminho de backlight em `/sys/class/backlight`.
- [ ] Mali via Mesa/Panfrost vs blob — qual inicializa EGL no painel.
