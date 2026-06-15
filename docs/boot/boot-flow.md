# Boot — visão do projeto

> O detalhamento de hardware do boot está em
> [`../hardware/boot-flow.md`](../hardware/boot-flow.md). Este arquivo registra as
> **decisões de boot do CyberDeck OS** (o que reusar do ArkOS, o que trocar).

## Decisões

- **Reusar** do ArkOS (referência): esquema de partição (p1 FAT BOOT / p2 ext4),
  região de SPL/U-Boot, DTB rk3326 (`odroidgo3-linux`), formato de `boot.ini`.
- **Trocar**: rootfs (Buildroot mínimo, não Ubuntu 19.10), init/UI (web kiosk, não
  EmulationStation).
- **Console serial** (`ttyS1`) habilitado para debug enquanto a tela não funciona.

## Artefatos a extrair (Fase 1→2)

`scripts/extract-arkos-boot-artifacts.sh` copia para `artifacts/arkos-reference/`:
kernel `Image`, `rk3326-*.dtb`, `boot.ini`/extlinux, `uInitrd`. A partir deles,
`board/r36s/boot/` será montado.

## Pendências

- [ ] Confirmar cmdline do `boot.ini` real.
- [ ] Decidir: reusar kernel 4.4 BSP (compatível garantido) **ou** mainline +
      Panfrost (Mali aberto) — impacta `docs/graphics/`.
