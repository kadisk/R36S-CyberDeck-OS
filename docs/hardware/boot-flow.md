# Fluxo de boot — R36S (referência ArkOS)

## Esquema de partição (confirmado por `fdisk -l` da imagem)

| Part | Início (setor) | Offset (bytes) | Tipo | Rótulo | Conteúdo |
|------|----------------|----------------|------|--------|----------|
| p1   | 32768          | 16777216       | FAT32 | BOOT  | kernel, DTBs, `boot.ini`, `uInitrd` |
| p2   | 262144         | 134217728      | ext4  | rootfs| Ubuntu 19.10 arm64 (no ArkOS) |
| p3   | 13983744       | 7159676928     | exFAT | roms  | dados/ROMs (não usado no CyberDeck) |

Setor = 512 bytes. (Relatório completo: `artifacts/arkos-reference/reports/`.)

## Cadeia de boot do RK3326 (ArkOS)

```
BootROM (RK3326)
   ↓ carrega de mmcblk0
SPL / U-Boot (idbloader, no início do cartão, antes da p1)
   ↓ lê a partição BOOT (FAT)
boot.ini  ──► define kernel (Image), DTB (rk3326-r35s-linux.dtb), uInitrd, cmdline
   ↓
Kernel Linux 4.4.189 (BSP Rockchip) + DTB rk3326
   ↓ cmdline aponta root=/dev/mmcblk0p2
rootfs (ext4) → init (systemd no ArkOS)
```

## O que o CyberDeck OS reaproveita

- **Mesmo esquema de partição** (p1 BOOT FAT / p2 rootfs ext4) — ver
  `scripts/create-sd-layout.sh`.
- **Mesmo DTB / compatible** (`rk3326-odroidgo3-linux`) para garantir que painel,
  joypad, PMIC e microSD funcionem.
- **Mesma região de SPL/U-Boot** (antes da p1) para o BootROM aceitar o cartão.

## O que o CyberDeck OS substitui

- **rootfs**: Ubuntu 19.10 do ArkOS → rootfs mínimo (Buildroot).
- **init/UI**: EmulationStation → runtime web + CyberDeck UI.
- (Opcional, futuro) kernel próprio se mantivermos compatibilidade de DTB.

## A confirmar / extrair

- [ ] Conteúdo exato de `boot.ini` (cmdline, nome do kernel/DTB/initrd).
- [ ] Se há `extlinux.conf` ou só `boot.ini`.
- [ ] Versão/origem do U-Boot (offset do idbloader).
- [ ] Formato do `uInitrd` (U-Boot wrapped) vs `initrd.img`.

Extrair com:
```bash
sudo scripts/mount-arkos-readonly.sh
sudo scripts/extract-arkos-boot-artifacts.sh
```
