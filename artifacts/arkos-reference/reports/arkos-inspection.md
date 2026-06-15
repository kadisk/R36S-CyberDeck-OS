# Relatório de inspeção da imagem ArkOS (referência R36S)

> Gerado por `scripts/inspect-arkos-image.sh` em 2026-06-14T21:40:56-03:00.
> A imagem ArkOS é tratada como **somente leitura** — fonte de verdade de hardware.

## Imagem

- Arquivo: `/home/kadisk/Workspaces/Workspace_RS36S/Backups/ArkOS/ArkOS_2.0_08232024_AeUX_backup_2026-06-03.img`
- Tamanho: 52428800000 bytes
- Comprimida (.gz): não

## Partições

```
# Layout de partições — gerado em 2026-06-14T21:40:56-03:00
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
# Offsets de partição (bytes) — gerado em 2026-06-14T21:40:56-03:00
# offset = início_em_setores * 512

p1: start_sector=32768 offset_bytes=16777216 size_bytes=117440512  (32768 262143 229376 112M b FAT32 W95)
p2: start_sector=262144 offset_bytes=134217728 size_bytes=7025459200  (262144 13983743 13721600 6,5G 83 Linux)
p3: start_sector=13983744 offset_bytes=7159676928 size_bytes=45269123072  (13983744 102399999 88416256 42,2G 7 HPFS/NTFS/exFAT)
```

## Partição BOOT

```
# Conteúdo da partição BOOT (p1, FAT) — gerado em 2026-06-14T21:40:56-03:00
# offset: 16777216

mtools (mdir/mcopy) não instalado — não foi possível ler a FAT sem montar.
Opções:
  - Instale mtools:  sudo apt-get install mtools
  - OU monte read-only:  sudo scripts/mount-arkos-readonly.sh
    e liste mnt/arkos/boot/
```

## Próximos passos

- `scripts/mount-arkos-readonly.sh` — montar p1/p2 read-only (precisa sudo).
- `scripts/extract-arkos-boot-artifacts.sh` — copiar kernel/dtb/boot configs.
- `scripts/identify-r36s-dtb.sh` — decodificar DTBs e extrair model/compatible.
