# Imagem de teste — R36S CyberDeck OS (Fase 2)

> Gerada por `scripts/create-test-sd-image.sh` em 2026-06-15T00:06:43-03:00.

- Arquivo: `/home/kadisk/Workspaces/Workspace_RS36S/R36S-CyberDeck-OS/artifacts/test-images/r36s-cyberdeck-minimal.img`
- Tamanho: 420478976 bytes (401 MiB)
- sha256: `49b5ae43cf3500dc032f5feef4097cfc60434b8f2703da3f7339cb8396afa15d`
- Bootloader RK3326 (do ArkOS): incluído
- rootfs UUID: `c1be7dec-0de0-4a17-9f3a-7e5b00c0de36` (casa com root=UUID do boot.ini)

## Partições
```
Disco /home/kadisk/Workspaces/Workspace_RS36S/R36S-CyberDeck-OS/artifacts/test-images/r36s-cyberdeck-minimal.img: 401 MiB, 420478976 bytes, 821248 setores
Unidades: setor de 1 * 512 = 512 bytes
Tamanho de setor (lógico/físico): 512 bytes / 512 bytes
Tamanho E/S (mínimo/ótimo): 512 bytes / 512 bytes
Tipo de rótulo do disco: dos
Identificador do disco: 0x8b7290e3

Dispositivo                                                                                                 Inicializar Início    Fim Setores Tamanho Id Tipo
/home/kadisk/Workspaces/Workspace_RS36S/R36S-CyberDeck-OS/artifacts/test-images/r36s-cyberdeck-minimal.img1 *            32768 294911  262144    128M  c W95 FAT32 (LBA)
/home/kadisk/Workspaces/Workspace_RS36S/R36S-CyberDeck-OS/artifacts/test-images/r36s-cyberdeck-minimal.img2             294912 819199  524288    256M 83 Linux
```

## BOOT (p1) — conteúdo
```
 Volume in drive : is BOOT       
 Volume Serial Number is C3CE-22AB
Directory for ::/

IMAGE         10895368 2026-06-15   0:06  Image
UINITRD       13194771 2026-06-15   0:06  uInitrd
RK3326~1 DTB     89630 2026-06-15   0:06  rk3326-r35s-linux.dtb
boot     ini      1576 2026-06-15   0:06 
        4 files          24 181 345 bytes
                        107 952 128 bytes free

```

## Como gravar (NÃO executado automaticamente)
```
sudo dd if=/home/kadisk/Workspaces/Workspace_RS36S/R36S-CyberDeck-OS/artifacts/test-images/r36s-cyberdeck-minimal.img of=/dev/sdX bs=4M status=progress conv=fsync
```
Ver `scripts/print-flash-command.sh` e `docs/boot/sd-card-test-layout.md`.
