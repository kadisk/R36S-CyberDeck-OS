# Layout do cartão de teste + gravação e rollback — Fase 2

## Estratégia: clonar o boot do ArkOS (modo padrão `--clone`)

Descobrimos no teste físico que um **MBR feito do zero** (sfdisk) **impede o boot**
(tela apagada), mesmo com o bootloader idêntico — o U-Boot não acha a partição BOOT.
Por isso a imagem **clona a região de boot do ArkOS** (que já funciona) e troca só o
que é nosso.

| Região / Part | Início (setor) | Origem | Conteúdo |
|---------------|----------------|--------|----------|
| **MBR** | 0 | **clonado do ArkOS** (byte-a-byte) | tabela de partições do ArkOS |
| **bootloader** | 64..32767 | **clonado do ArkOS** | idbloader + U-Boot + trust |
| **p1 BOOT** | 32768 | **clonado do ArkOS**, com `boot.ini` trocado | `Image`, `uInitrd`, `rk3326-r35s-linux.dtb` (do ArkOS) + **nosso `boot.ini`** |
| **p2 ROOTFS** | 262144 | **nossa** | rootfs mínimo (BusyBox) ext4, UUID `c1be7dec-…-7e5b00c0de36`, montada por `root=UUID` |

- O MBR clonado declara p2/p3 com os tamanhos do ArkOS (grandes). Nossa rootfs ext4
  (256 MiB) fica no **início da p2** e é montada **por UUID** — o tamanho declarado
  no MBR não importa. No microSD de 64 GB tudo cabe.
- A imagem `.img` é pequena (~256 MiB de rootfs + 128 MiB de boot); o resto do cartão
  fica como estava.
- Setor = 512 B. Constantes em `scripts/phase2-config.sh`.

## Gerar a imagem

```bash
scripts/create-test-sd-image.sh           # modo --clone (padrão, recomendado)
scripts/create-test-sd-image.sh --fresh   # MBR/FAT do zero (referência; NÃO bootou)
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
