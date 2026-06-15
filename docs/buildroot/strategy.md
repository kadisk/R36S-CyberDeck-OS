# Estratégia Buildroot — R36S CyberDeck OS

## Por que Buildroot

- Gera uma **imagem de SD completa** (bootloader + kernel + rootfs) reprodutível.
- Rootfs **mínimo** (não herda o Ubuntu 19.10 do ArkOS) — só o necessário p/ o
  CyberDeck.
- BR2_EXTERNAL mantém nossos pacotes/configs **fora** da árvore do Buildroot.
- Alternativas (Yocto, buildroot custom, debootstrap) ficam como plano B; Buildroot
  é o melhor custo/benefício para um único dispositivo embarcado.

## Estrutura planejada

```
buildroot/
  configs/
    r36s_cyberdeck_defconfig     # config principal da placa
  external/                      # BR2_EXTERNAL tree
    Config.in
    external.mk
    external.desc
    package/
      cyberdeck-ui/              # empacota cyberdeck-ui/
      cyberdeck-runtime/         # serviço + scripts (runtime/)
board/
  r36s/
    boot/                        # boot.ini/extlinux, layout de SD (genimage)
    overlays/                    # device-tree overlays, se necessário
    rootfs-overlay/              # arquivos jogados no rootfs final
```

## Componentes-alvo do defconfig

- **Arch:** `aarch64` (Cortex-A35), `ARM64`.
- **Toolchain:** externa ou Buildroot interna (glibc).
- **Kernel:** compatível com `rk3326`/DTB `odroidgo3-linux` (reusar o do ArkOS como
  referência; avaliar kernel mainline + Panfrost na Fase 3+).
- **Bootloader:** U-Boot RK3326 (idbloader + u-boot.itb) espelhando o esquema ArkOS.
- **Init:** systemd (ou BusyBox init minimalista — decidir por footprint).
- **Gráficos:** libdrm, mesa3d (Panfrost) **ou** blob Mali, Wayland, **cage**.
- **Runtime web:** **WPE WebKit** (pacote `wpewebkit`/`cog`) — ou WebKitGTK.
- **Rede:** ferramentas básicas + suporte a dongle Wi-Fi USB (firmware Realtek).
- **Imagem:** `genimage` para montar p1 FAT (BOOT) + p2 ext4 (rootfs).

## Fluxo de build (planejado)

```bash
git clone buildroot
make BR2_EXTERNAL=$(pwd)/buildroot/external r36s_cyberdeck_defconfig
make
# saída: output/images/sdcard.img  ->  scripts/flash-test-sd.sh
```

## Ordem de implementação

1. defconfig mínimo que **boota até shell** no R36S (Fase 2).
2. + DRM/KMS, input (Fase 3).
3. + Cage + WPE WebKit (Fase 4).
4. + pacotes `cyberdeck-ui` e `cyberdeck-runtime` (Fase 5/6).

> O `r36s_cyberdeck_defconfig` e a `external/` tree serão criados quando a Fase 2
> começar. Hoje há só os diretórios e esta estratégia.
