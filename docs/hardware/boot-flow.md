# Fluxo de boot — R36S (referência ArkOS)

## Esquema de partição (confirmado por `fdisk -l` da imagem)

| Part | Início (setor) | Offset (bytes) | Tipo | Rótulo | Conteúdo |
|------|----------------|----------------|------|--------|----------|
| p1   | 32768          | 16777216       | FAT32 | BOOT  | kernel, DTBs, `boot.ini`, `uInitrd` |
| p2   | 262144         | 134217728      | ext4  | rootfs| Ubuntu 19.10 arm64 (no ArkOS) |
| p3   | 13983744       | 7159676928     | exFAT | roms  | dados/ROMs (não usado no CyberDeck) |

Setor = 512 bytes. (Relatório completo: `artifacts/arkos-reference/reports/`.)

## Cadeia de boot do RK3326 (ArkOS) — CONFIRMADO

```
BootROM (RK3326)
   ↓ carrega SPL/U-Boot do início do cartão (antes da p1)
SPL / U-Boot  (config "odroidgoa-uboot-config")
   ↓ lê a partição BOOT (FAT) como "mmc 1:1"
boot.ini  ──► load Image, uInitrd, rk3326-r35s-linux.dtb + bootargs ; booti
   ↓
Kernel Linux 4.4.189 (#192 SMP 2025-07-09, gcc Linaro 7.3) + DTB rk3326
   ↓ root=UUID=e139ce78-... (a p2 ext4)
rootfs (ext4) → init (systemd no ArkOS)
```

### `boot.ini` real (extraído — `artifacts/arkos-reference/boot/boot.ini`)

```
setenv bootargs "root=UUID='e139ce78-9841-40fe-8823-96a304a09859' rootwait rw \
  fsck.repair=yes net.ifnames=0 fbcon=rotate:0 console=/dev/ttyFIQ0 quiet splash \
  plymouth.ignore-serial-consoles consoleblank=0"
setenv loadaddr        "0x02000000"
setenv initrd_loadaddr "0x01100000"
setenv dtb_loadaddr    "0x01f00000"
load mmc 1:1 ${loadaddr}        Image
load mmc 1:1 ${initrd_loadaddr} uInitrd
load mmc 1:1 ${dtb_loadaddr}    rk3326-r35s-linux.dtb
booti ${loadaddr} ${initrd_loadaddr} ${dtb_loadaddr}
```

Pontos para o CyberDeck OS:
- **Console de debug é `/dev/ttyFIQ0`** (FIQ debugger do RK3326), **não** `ttyS1`.
  Para ver o boot no serial, manter `console=/dev/ttyFIQ0`.
- **`fbcon=rotate:0`** — sem rotação do console de framebuffer (painel já na
  orientação correta para o fbcon).
- **`root=UUID=...`** — usar UUID evita depender de `mmcblk0`/`mmcblk1` (a ordem de
  enumeração dos 2 slots pode variar). O CyberDeck deve seguir o mesmo padrão.
- **`quiet splash` + plymouth** — remover no desenvolvimento para ver mensagens.
- Kernel/initrd/DTB carregados de `mmc 1:1` (a partição BOOT FAT).

### Artefatos de boot extraídos (read-only, via mtools)

| Arquivo | Tamanho | Detalhe |
|---------|---------|---------|
| `Image` | 10.9 MB | Linux 4.4.189 ARM64, build `#192` 2025-07-09 |
| `uInitrd` | 13.2 MB | uImage U-Boot, RAMDisk gzip (2020-03-16) |
| `rk3326-r35s-linux.dtb` | 89 KB | **DTB ativo** — `odroidgo3-linux` |
| `rg351mp-kernel.dtb` / `rg351p-kernel.dtb` | 61 KB | DTBs de outras placas (não usados no R36S) |

Decodificação completa do DTB ativo: `artifacts/arkos-reference/reports/rk3326-r35s-linux.dts`.

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

## Estado da extração

- [x] Conteúdo exato de `boot.ini` (cmdline, kernel/DTB/initrd) — ver acima.
- [x] Só há `boot.ini` (estilo Amlogic/odroid `setenv`+`booti`); **não** há
      `extlinux.conf` na BOOT.
- [x] Versão do kernel: **4.4.189** (#192, 2025-07-09).
- [x] Formato do `uInitrd`: uImage U-Boot (RAMDisk gzip).
- [ ] Origem/offset exato do U-Boot/idbloader (na região antes da p1) — pendente
      (precisa ler os primeiros setores do cartão; não afeta a Fase 1).

Reprodução (sem sudo, via mtools sobre a p1 FAT):
```bash
scripts/inspect-arkos-image.sh              # lista a BOOT (mdir)
scripts/extract-arkos-boot-artifacts.sh     # copia via mcopy
scripts/identify-r36s-dtb.sh                # decodifica os DTBs
```
