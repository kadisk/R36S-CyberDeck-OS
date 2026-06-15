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

# 3) gravar uma imagem PELO NOME (sudo; só em cartão autorizado)
sudo scripts/sdcard/sd-flash.sh cartao-teste-r36s artifacts/test-images/r36s-cyberdeck-mainline.img

# 3b) OU só editar o boot (rw + verboso) sem regravar a imagem (sudo)
sudo scripts/sdcard/sd-edit-extlinux.sh cartao-teste-r36s

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
| `sd-flash.sh /dev/sdX img` | **sim** | grava imagem (dd) — só autorizado |
| `sd-edit-extlinux.sh /dev/sdX` | **sim** | aplica extlinux (rw+verboso) na BOOT |
| `sdcard-lib.sh` | — | biblioteca (sourced) |
