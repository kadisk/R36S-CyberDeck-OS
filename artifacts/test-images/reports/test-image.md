# Imagem de teste — R36S CyberDeck OS (Fase 2)

> Gerada por `scripts/create-test-sd-image.sh --clone` em 2026-06-15T01:33:11-03:00.

- Arquivo: `/home/kadisk/Workspaces/Workspace_RS36S/R36S-CyberDeck-OS/artifacts/test-images/r36s-cyberdeck-minimal.img`
- Tamanho: 403701760 bytes
- sha256: `27d46cd96bcc95e361f2620a19d5c322a4bbd9a87aa8e46c7f3a8a0d3030e612`
- Estratégia de boot: MBR+bootloader+FAT clonados do ArkOS (byte-a-byte); boot.ini e rootfs trocados
- rootfs UUID: `c1be7dec-0de0-4a17-9f3a-7e5b00c0de36` (casa com root=UUID do boot.ini)
- rootfs gravada no setor: 262144

## Partições (MBR)
```
Disco /home/kadisk/Workspaces/Workspace_RS36S/R36S-CyberDeck-OS/artifacts/test-images/r36s-cyberdeck-minimal.img: 385 MiB, 403701760 bytes, 788480 setores
Unidades: setor de 1 * 512 = 512 bytes
Tamanho de setor (lógico/físico): 512 bytes / 512 bytes
Tamanho E/S (mínimo/ótimo): 512 bytes / 512 bytes
Tipo de rótulo do disco: dos
Identificador do disco: 0xc9f931c9
Dispositivo                                                                                                 Inicializar   Início       Fim  Setores Tamanho Id Tipo
/home/kadisk/Workspaces/Workspace_RS36S/R36S-CyberDeck-OS/artifacts/test-images/r36s-cyberdeck-minimal.img1                32768    262143   229376    112M  b FAT32 W95
/home/kadisk/Workspaces/Workspace_RS36S/R36S-CyberDeck-OS/artifacts/test-images/r36s-cyberdeck-minimal.img2               262144  13983743 13721600    6,5G 83 Linux
/home/kadisk/Workspaces/Workspace_RS36S/R36S-CyberDeck-OS/artifacts/test-images/r36s-cyberdeck-minimal.img3             13983744 102399999 88416256   42,2G  7 HPFS/NTFS/exFAT
```

## Como gravar (NÃO executado automaticamente)
```
sudo dd if=/home/kadisk/Workspaces/Workspace_RS36S/R36S-CyberDeck-OS/artifacts/test-images/r36s-cyberdeck-minimal.img of=/dev/sdX bs=4M status=progress conv=fsync
```
