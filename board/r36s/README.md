# board/r36s

Arquivos específicos da placa **R36S** (RK3326) para a construção da imagem.

## Conteúdo (planejado)

| Pasta | Para quê |
|-------|----------|
| `boot/` | `boot.ini`/extlinux, layout de SD (`genimage`/`sfdisk`), U-Boot. Espelha o esquema validado do ArkOS (p1 FAT BOOT + p2 ext4 rootfs). |
| `overlays/` | Device-tree overlays, se forem necessários ajustes sobre o DTB base `rk3326-odroidgo3-linux`. |
| `rootfs-overlay/` | Arquivos jogados como estão no rootfs final (ex.: `etc/`, units systemd, `start-cyberdeck-ui.sh` em `usr/local/bin`, UI em `usr/share/cyberdeck-ui`). |

## Referência de hardware

Todo o perfil de hardware vem da inspeção read-only do ArkOS — ver
`../../docs/hardware/`. DTB ativo: `rk3326-r35s-linux.dtb`
(`compatible = rockchip,rk3326-odroidgo3-linux`).

## Estado atual

Estrutura criada; conteúdo será preenchido a partir da **Fase 2** (boot mínimo),
usando os artefatos extraídos em `../../artifacts/arkos-reference/`.
