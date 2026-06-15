# Relatório de inspeção da imagem ArkOS (referência R36S)

> Gerado por `scripts/inspect-arkos-image.sh` em 2026-06-14T21:44:27-03:00.
> A imagem ArkOS é tratada como **somente leitura** — fonte de verdade de hardware.

## Imagem

- Arquivo: `/home/kadisk/Workspaces/Workspace_RS36S/Backups/ArkOS/ArkOS_2.0_08232024_AeUX_backup_2026-06-03.img`
- Tamanho: 52428800000 bytes
- Comprimida (.gz): não

## Partições

```
# Layout de partições — gerado em 2026-06-14T21:44:27-03:00
# Fonte: /home/kadisk/Workspaces/Workspace_RS36S/Backups/ArkOS/ArkOS_2.0_08232024_AeUX_backup_2026-06-03.img  (somente leitura)

Disco /home/kadisk/Workspaces/Workspace_RS36S/Backups/ArkOS/ArkOS_2.0_08232024_AeUX_backup_2026-06-03.img: 48,83 GiB, 52428800000 bytes, 102400000 setores
Unidades: setor de 1 * 512 = 512 bytes
Tamanho de setor (lógico/físico): 512 bytes / 512 bytes
Tamanho E/S (mínimo/ótimo): 512 bytes / 512 bytes
Tipo de rótulo do disco: dos
Identificador do disco: 0xc9f931c9

Dispositivo                                                                                          Inicializar   Início       Fim  Setores Tamanho Id Tipo
/home/kadisk/Workspaces/Workspace_RS36S/Backups/ArkOS/ArkOS_2.0_08232024_AeUX_backup_2026-06-03.img1                32768    262143   229376    112M  b FAT32 W95
/home/kadisk/Workspaces/Workspace_RS36S/Backups/ArkOS/ArkOS_2.0_08232024_AeUX_backup_2026-06-03.img2               262144  13983743 13721600    6,5G 83 Linux
/home/kadisk/Workspaces/Workspace_RS36S/Backups/ArkOS/ArkOS_2.0_08232024_AeUX_backup_2026-06-03.img3             13983744 102399999 88416256   42,2G  7 HPFS/NTFS/exFAT
```

## Offsets

```
# Offsets de partição (bytes) — gerado em 2026-06-14T21:44:27-03:00
# offset = início_em_setores * 512

p1: start_sector=32768 offset_bytes=16777216 size_bytes=117440512  (32768 262143 229376 112M b FAT32 W95)
p2: start_sector=262144 offset_bytes=134217728 size_bytes=7025459200  (262144 13983743 13721600 6,5G 83 Linux)
p3: start_sector=13983744 offset_bytes=7159676928 size_bytes=45269123072  (13983744 102399999 88416256 42,2G 7 HPFS/NTFS/exFAT)
```

## Partição BOOT

```
# Conteúdo da partição BOOT (p1, FAT) — gerado em 2026-06-14T21:44:27-03:00
# offset: 16777216

## Listagem (mtools, somente leitura):
 Volume in drive : is BOOT       
 Volume Serial Number is 8B25-5227
Directory for ::/

IMAGE         10895368 2025-07-09  10:54  Image
RK3326~1 DTB     89630 2025-05-26  11:36  rk3326-r35s-linux.dtb
RG351M~1 DTB     61363 2025-05-26  11:26  rg351mp-kernel.dtb
RG351P~1 DTB     61363 2025-05-26  11:26  rg351p-kernel.dtb
LOGO     BMP    921654 2025-01-22  20:20  logo.bmp
autorun  inf       106 2024-03-06  21:49 
R36SV5~1 TXT         0 2024-03-06  21:47  R36S V5.txt
R36S     ico     16958 2023-10-10  16:38 
BOOT     INI       953 2023-05-18  20:39  boot.ini
WHERE_~1 TXT       838 2020-12-24   1:23  WHERE_ARE_MY_ROMS.txt
UINITRD       13194771 2020-03-16   0:24  uInitrd
       11 files          25 243 004 bytes

Directory for ::/System Volume Information

.            <DIR>     2023-09-30  11:52 
..           <DIR>     2023-09-30  11:52 
INDEXE~1            76 2023-09-30  11:52  IndexerVolumeGuid
WPSETT~1 DAT        12 2023-12-08  16:30  WPSettings.dat
        4 files                  88 bytes

Total files listed:
       15 files          25 243 092 bytes
                         90 366 976 bytes free

```

## Próximos passos

- `scripts/mount-arkos-readonly.sh` — montar p1/p2 read-only (precisa sudo).
- `scripts/extract-arkos-boot-artifacts.sh` — copiar kernel/dtb/boot configs.
- `scripts/identify-r36s-dtb.sh` — decodificar DTBs e extrair model/compatible.
