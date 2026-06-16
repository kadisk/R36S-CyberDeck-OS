# Kit de SD card — gravação segura com allowlist

Toda ação que escreve no cartão (`sudo`) é um **script one-shot** que **só age em
cartão AUTORIZADO** e que passe nas checagens de segurança. Saídas são claras para
humano e IA (blocos `chave: valor`).

## Identidade do cartão (fingerprint)

Derivada de **serial USB + modelo + tamanho físico** (estável a reparticionar). A
allowlist fica em `authorized-cards.tsv` (local, fora do git).

> Limitação: alguns leitores USB não expõem o serial do cartão; nesse caso a
> fingerprint distingue menos. As checagens de segurança (removível, não-montado
> como sistema, tamanho) continuam protegendo contra gravar no disco errado.

## Fluxo

Depois de cadastrar, **use sempre o NOME** do cartão — os scripts descobrem o
`/dev/sdX` atual pela fingerprint (o device pode mudar a cada conexão).

```bash
# 1) ver cartões autorizados + os conectados agora (sem sudo)
scripts/sdcard/sd-cards.sh

# 2) autorizar um cartão de teste — passo humano, aponta o device físico (sem sudo)
scripts/sdcard/sd-allow.sh /dev/sdX "cartao-teste-r36s"

# (a imagem 'x11' — a versão final — é registrada pelo build-x11-rootfs.sh)
scripts/sdcard/sd-image.sh list

# 3) ATUALIZAR o cartão pela dupla de NOMES — sem dd, sem caminhos (sudo)
sudo scripts/sdcard/sd-update.sh cartao-teste-r36s x11        # grava e memoriza o vínculo
sudo scripts/sdcard/sd-update.sh cartao-teste-r36s            # da 2a vez, usa a imagem vinculada

# 3b) iterar só a UI web (HTML/JS) sem regravar a imagem (sudo)
sudo scripts/sdcard/sd-update-ui.sh cartao-teste-r36s

# 4) remover da lista quando quiser (sem sudo)
scripts/sdcard/sd-revoke.sh cartao-teste-r36s   # ou pela fingerprint
```

`<nome | /dev/sdX>`: os scripts de ação aceitam o nome cadastrado **ou** o device
direto. Encadear é seguro (cada um faz a checagem):
```bash
sudo scripts/sdcard/sd-edit-extlinux.sh cartao-teste-r36s && echo "ok, pode bootar"
```

## Segurança (o que os scripts recusam)

- device que **não é removível** (provável disco interno/sistema);
- device com partição montada em `/`, `/home`, `/boot`, ... ;
- `nvme*`/`md*`/`dm-*` ou tamanho > 256 GB;
- cartão **não cadastrado** na allowlist.

`sd-allow.sh` também recusa cadastrar disco não-removível ou de sistema.

## Scripts

| Script | sudo? | O quê |
|--------|-------|-------|
| `sd-cards.sh` | não | lista autorizados + conectados |
| `sd-allow.sh /dev/sdX "nome"` | não | autoriza um cartão |
| `sd-revoke.sh <fp\|nome>` | não | remove da lista |
| `sd-image.sh add/list/rm` | não | registra imagens por apelido |
| `sd-update.sh <cartao> [imagem]` | **sim** | grava imagem (apelido) no cartão (nome); memoriza o vínculo |
| `sd-update-ui.sh <cartao>` | **sim** | atualiza só a UI web (`cyberdeck-ui/public`) sem regravar |
| `sd-set-logo.sh <cartao>` | **sim** | troca o logo de boot (welcome) na BOOT, sem regravar |
| `sd-get-screenshots.sh <cartao> [destino]` | **sim** | copia os prints (`/root/screenshots`) p/ o host (monta rootfs **read-only**) |
| `sd-clear-screenshots.sh <cartao>` | **sim** | **apaga** os prints (`/root/screenshots/*.png`) do cartão (rootfs rw) |
| `sd-flash.sh <cartao\|/dev/sdX> img` | **sim** | grava imagem por caminho (baixo nível) |
| `sd-edit-extlinux.sh <cartao\|/dev/sdX>` | **sim** | aplica extlinux (rw+verboso) na BOOT |
| `sdcard-lib.sh` | — | biblioteca (sourced) |

**Experimentais (não usados na versão final):** `sd-apply-panel-dtb.sh`,
`sd-fix-panel-dtb.sh`, `sd-try-panel-overlay.sh`, `sd-grab-panel-overlay.sh` — foram
para forçar o painel em imagens mainline/MultiPanel (que não sobem neste lote). Ver
[`../../docs/JORNADA.md`](../../docs/JORNADA.md).

Arquivos locais (gitignored): `authorized-cards.tsv` (cartões), `images.tsv`
(apelidos de imagem), `bindings.tsv` (cartão→imagem).

## Catálogo de distros R36S (testar uma a uma)

`r36s-catalog.tsv` (versionado) lista distros candidatas com status
(`TODO/FUNCIONA/FALHA/PARCIAL`). Fluxo:
```bash
scripts/sdcard/sd-catalog.sh list            # tabela com status
scripts/sdcard/sd-catalog.sh next            # próxima TODO
scripts/sdcard/sd-catalog.sh fetch <nome>    # baixa+descomprime+registra (.gz/.xz)
sudo scripts/sdcard/sd-update.sh <cartao> <nome>   # grava
# ... boota no R36S, observa ...
scripts/sdcard/sd-catalog.sh result <nome> FUNCIONA "tela+input ok"
```
Para URLs que não são link direto (.img), baixe manual e use
`scripts/sdcard/sd-image.sh add <nome> <arquivo.img>`.
