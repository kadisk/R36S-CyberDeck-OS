# Layout do cartão de teste + gravação e rollback — Fase 2

## Layout da imagem `r36s-cyberdeck-minimal.img`

Espelha o esquema validado do ArkOS (para o U-Boot encontrar tudo onde espera):

| Região / Part | Início (setor) | Tamanho | Tipo | Conteúdo |
|---------------|----------------|---------|------|----------|
| MBR | 0 | 1 setor | — | tabela de partições (nossa, via sfdisk) |
| **bootloader** | 64 | até 32767 | raw | **idbloader + U-Boot copiados do ArkOS** |
| **p1 BOOT** | 32768 | 128 MiB | FAT32 (LBA, `c`), bootable | `Image`, `uInitrd`, `rk3326-r35s-linux.dtb`, `boot.ini` |
| **p2 ROOTFS** | 294912 | 256 MiB | ext4 (`83`) | rootfs mínimo (BusyBox), UUID `c1be7dec-…-7e5b00c0de36` |
| p3 DATA (opc.) | após p2 | 256 MiB | FAT32 | vazia (só com `--with-data`) |

- Setor = 512 B. Offsets/sizes em `scripts/phase2-config.sh`.
- Imagem total ≈ **401 MiB** (pequena de propósito; cabe em qualquer microSD).

## Gerar a imagem

```bash
scripts/create-test-sd-image.sh              # gera a .img (sem p3)
scripts/create-test-sd-image.sh --with-data  # inclui p3 DATA
```

Saída: `artifacts/test-images/r36s-cyberdeck-minimal.img`
Relatório: `artifacts/test-images/reports/test-image.md`

> O script **não grava em cartão**. Só cria o arquivo `.img`.

## Gravar no microSD (você executa)

```bash
scripts/print-flash-command.sh    # mostra lsblk + o comando dd (não grava)
```

Comando recomendado (troque `/dev/sdX` pelo SEU cartão, conferido no `lsblk`):

```bash
sudo dd if=artifacts/test-images/r36s-cyberdeck-minimal.img \
        of=/dev/sdX bs=4M status=progress conv=fsync
sync
```

Depois, insira o microSD no **slot de boot** do R36S (o mesmo onde fica o cartão do
sistema) e ligue.

## ⚠️ Regras de segurança

- **Use um microSD separado, dedicado ao teste.**
- **Nunca** grave no cartão **ArkOS original** — ele é a referência de hardware.
- Mantenha a imagem ArkOS (`Backups/ArkOS/…img`) intacta, **somente leitura**.
- Confirme `/dev/sdX` com `lsblk` **antes** de cada `dd`. Gravar no disco errado
  apaga dados.
- Nenhum script do projeto grava automaticamente em `/dev/sdX`.

## Rollback — voltar ao ArkOS

O teste **não altera** o cartão ArkOS original (é outro microSD). Para voltar a
usar o R36S normalmente:

1. **Mais simples:** desligue, **troque o microSD de teste pelo cartão ArkOS
   original** e ligue. Pronto — o R36S volta ao ArkOS.
2. **Reaproveitar o cartão de teste** para ArkOS: regrave a imagem ArkOS nele:
   ```bash
   # (descomprima se necessário: gunzip -k Backups/ArkOS/...img.gz)
   sudo dd if=Backups/ArkOS/ArkOS_2.0_08232024_AeUX_backup_2026-06-03.img \
           of=/dev/sdX bs=4M status=progress conv=fsync
   sync
   ```
3. Se algo parecer estranho no hardware (nada é gravado fora do SD): o R36S não tem
   armazenamento interno gravável pelo nosso fluxo — todo o estado está no microSD.
   Trocar o cartão **sempre** restaura o estado anterior.

## Notas

- A região de bootloader vem do ArkOS; por isso o cartão de teste depende de a
  imagem ArkOS estar presente em `Backups/ArkOS/` no momento da geração (ou use
  `--no-bootloader` e um cartão que já tenha U-Boot — não recomendado p/ 1º teste).
- Para repetir o teste após mudar o rootfs/boot.ini: regenere a imagem e regrave.
