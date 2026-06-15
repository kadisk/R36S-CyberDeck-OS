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

```bash
# 1) ver cartões autorizados + os conectados agora (sem sudo)
scripts/sdcard/sd-cards.sh

# 2) autorizar um cartão de teste (passo humano deliberado; sem sudo)
scripts/sdcard/sd-allow.sh /dev/sdX "cartao-teste-r36s"

# 3) gravar uma imagem (sudo; só em cartão autorizado)
sudo scripts/sdcard/sd-flash.sh /dev/sdX artifacts/test-images/r36s-cyberdeck-mainline.img

# 3b) OU só editar o boot (rw + verboso) sem regravar a imagem (sudo)
sudo scripts/sdcard/sd-edit-extlinux.sh /dev/sdX

# 4) remover da lista quando quiser (sem sudo)
scripts/sdcard/sd-revoke.sh "cartao-teste-r36s"   # ou pela fingerprint
```

Encadear (exemplo do pedido): cada script já faz a checagem de autorização sozinho,
então é seguro encadear:
```bash
sudo scripts/sdcard/sd-edit-extlinux.sh /dev/sdX && echo "ok, pode bootar"
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
