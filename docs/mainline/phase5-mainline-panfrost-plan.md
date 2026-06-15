# Fase 5 — Kernel mainline + Panfrost + Mesa (web runtime de verdade)

Objetivo: substituir o stack **kernel 4.4 BSP + blob Mali** (que tem GBM antigo,
incompatível com o WPE/wlroots modernos) por **kernel mainline 6.x + Panfrost +
Mesa**, onde o GBM/EGL/GLES são modernos (têm `gbm_bo_get_offset` etc.) — e aí o
`cog`/`cage` renderiza a UI HTML/JS.

## Por que (achado da Fase 4)

O blob Mali do ArkOS (2020) exporta só **24 símbolos `gbm_*`** (ABI ~Mesa 2016),
**sem `gbm_bo_get_offset`** que o `wlroots`/`cog` do Debian bookworm exigem →
`symbol lookup error`. Não dá pra usar GBM do Mesa com esse kernel porque o Mesa
precisa de um driver de GPU (Panfrost) que **só existe em kernel mainline**. Logo,
para web acelerada: **mainline + Panfrost**. É o que as distros open-source de R36S
fazem (sem blobs).

## Caminho trilhado (referências)

- **Arch-R** (arch-r.io / github archr-linux/Arch-R): distro R36S, **kernel 6.12 LTS
  + Mesa Panfrost**, sem blobs proprietários.
- **nixos-r36s** (github icefirex/nixos-r36s): mainline **6.19+**, Panfrost, DTB
  `rk3326-gameconsole-r36s.dtb` (de `rk3326-r36s.dts`), U-Boot Armbian no setor 64,
  `boot.ini` carrega `boot/Image` + `boot/uInitrd` + `boot/dtb/rockchip/rk3326-gameconsole-r36s.dtb`.
- **immo2n/R36S-K36-DTB-PATCH**: patches de DTB p/ variantes/clones.

## Arquitetura alvo

```
U-Boot (reusar o do ArkOS — já faz booti Image+dtb; OU blob Armbian)
   ↓  boot.ini (mainline): carrega Image + rk3326-r36s.dtb (+ initrd) ; booti
Kernel mainline 6.x  +  DTB R36S (painel kd35t133, gpio-keys + adc-joystick, rk817)
   ├─ Panfrost (DRM) -> /dev/dri (render moderno)
   └─ rockchip DRM/VOP + panel-elida-kd35t133 (mainline tem esse painel)
   ↓ root=UUID
Rootfs Debian arm64  +  Mesa Panfrost (libgbm/libEGL/libGLESv2 do Mesa, ABI moderna)
   ↓  (SEM blob Mali; remove /opt/mali)
cage (wlroots) + cog --platform=wl  ->  cyberdeck-ui (HTML/JS)  ✅
```

## Diferenças de hardware (BSP → mainline)

| Item | BSP (Fases 2–4) | Mainline (Fase 5) |
|------|------------------|-------------------|
| GPU userspace | blob libMali | **Panfrost (Mesa)** |
| Joypad | `odroidgo3-joypad` (event1) | **`gpio-keys` + `adc-joystick`** (nomes/codes podem mudar!) |
| Painel | DTB BSP | `panel-elida-kd35t133` (mainline) |
| Console serial | `ttyFIQ0` | provavelmente **`ttyS2`** (mainline RK3326) |
| Áudio/PMIC | rk817 (BSP) | rk817 (mainline) |

> ⚠️ O **device tree** é o ponto crítico e não-testável aqui — reusar um DTB de
> R36S **comprovadamente funcional** (Arch-R/nixos-r36s/ROCKNIX) é o caminho de
> menor risco. O mapa do joypad muda (mainline usa gpio-keys/adc-joystick) — o
> `cyberdeck-fb` e a ponte de input precisarão re-confirmar os codes.

## Estratégia recomendada: REUSAR kernel+DTB de uma distro R36S mainline

Em vez de compilar/depurar um kernel do zero (não-testável aqui), **extrair de uma
imagem R36S mainline open-source** (Arch-R é o candidato — kernel 6.12 LTS):
- `Image` (kernel mainline arm64)
- `rk3326-r36s.dtb` (ou `rk3326-gameconsole-r36s.dtb`)
- `/lib/modules/<versão>` (módulos: panfrost se for módulo, mmc, ext4, etc.)
- (opcional) o `uInitrd`/initrd dessa distro

Alternativa (mais trabalho, mais controle): compilar mainline 6.x com
`aarch64-linux-gnu-gcc` (já no host) + `rockchip_linux_defconfig`/`defconfig` +
`CONFIG_DRM_PANFROST` + o DTS do R36S (de nixos-r36s/`rk3326-r36s.dts`).

## Passos de integração (alto nível)

1. **Obter** Image + DTB R36S + módulos (reuso) → `artifacts/mainline/`.
2. **BOOT**: na partição BOOT (clone do ArkOS), substituir/adicionar `Image` +
   `dtb/.../rk3326-r36s.dtb`; reescrever `boot.ini` com bootargs mainline
   (`root=UUID=… rootfstype=ext4 rw console=ttyS2,1500000 console=tty1 …`).
   Testar se o **U-Boot do ArkOS** boota o kernel mainline (provável). Se não,
   gravar o blob U-Boot Armbian no setor 64.
3. **Rootfs**: no Debian, **remover `/opt/mali`** e instalar Mesa Panfrost
   (`libgbm1`, `libegl-mesa0`, `libgles2`, `mesa-libgallium`/dri panfrost). Copiar
   `/lib/modules/<versão>` do kernel mainline. Garantir `depmod`.
4. **cage + cog**: agora com Mesa, `cage -- cog --platform=wl` deve achar
   `gbm_bo_get_offset` e renderizar. Validar no aparelho (log em BOOT).
5. **Input**: re-capturar o mapa do joypad (mainline = gpio-keys/adc-joystick) com o
   `phase3-probe.sh` e ajustar `cyberdeck-fb`/ponte de input.

## Riscos

- **U-Boot do ArkOS x kernel mainline**: deve bootar (booti é genérico), mas pode
  precisar do blob U-Boot Armbian. Mitigável.
- **DTB**: usar um R36S comprovado. Variações de painel entre lotes (ver
  troubleshooting do r36s.org) podem exigir o DTB do lote certo.
- **Módulos/versão**: o rootfs precisa dos módulos da MESMA versão do kernel.
- **Mesa Panfrost no G31**: maduro, mas a versão do Mesa importa (bookworm tem
  Panfrost; Mesa novo é melhor — pode-se usar backports).

## Resultado esperado

Stack 100% aberto (sem blob), GBM/EGL/GLES modernos, `cog`/WPE renderizando a UI
HTML/JS no R36S. É a base correta também para a UI definitiva do CyberDeck.

## Fontes

- Arch-R: https://arch-r.io/ · https://github.com/archr-linux/Arch-R
- nixos-r36s: https://github.com/icefirex/nixos-r36s
- DTB patches: https://github.com/immo2n/R36S-K36-DTB-PATCH
