# Análise de Device Tree — R36S

> Placeholder estruturado. O conteúdo **gerado automaticamente** será produzido
> por `scripts/identify-r36s-dtb.sh` após `scripts/extract-arkos-boot-artifacts.sh`
> (precisa montar a imagem read-only com sudo). Abaixo, o que já se sabe da
> inspeção anterior do workspace.

## DTB ativo (confirmado)

- Arquivo: `rk3326-r35s-linux.dtb` (na partição BOOT, apontado pelo `boot.ini`).
- `compatible` (raiz): `rockchip,rk3326-odroidgo3-linux`
- `model`: `ODROID-GO2 for linux based on Rockchip rk3326`
- sha256: `893d6026bacf0752a56661c21ed8584aab4a9baf8841dc5e5900969e597611db`
- Classificação: **R36S/R35S compatível com ArkOS comum** (não-clone).

## Keywords de hardware a confirmar no .dts

`scripts/identify-r36s-dtb.sh` procura e conta estas referências em cada DTB:

`rk3326`, `r35s`, `r36s`, `odroidgo`, `mipi`, `panel`, `backlight`, `mali`,
`rk817`, `joypad`, `saradc`, `dwmmc`, `cortex-a35`, `kd35t133`, `elida`, `vop`,
`dsi`, `battery`, `charger`.

## Nós de interesse esperados

| Nó | Função |
|----|--------|
| `gpu@ff400000` | Mali-G31 |
| `vop@ff460000` | display controller (VOP) |
| `dsi@ff450000` | MIPI-DSI host |
| `panel` (`elida,kd35t133`) | painel 640×480 |
| `backlight` (PWM) | brilho |
| `pmic@20` (`rk817`) | energia/bateria/carga/áudio |
| `saradc@ff288000` | leitura dos analógicos |
| `*joypad*` (`odroidgo2-joypad`) | gamepad |
| `dwmmc@ff370000` | microSD |

## Como (re)gerar este documento

```bash
sudo scripts/mount-arkos-readonly.sh
sudo scripts/extract-arkos-boot-artifacts.sh   # copia DTBs p/ artifacts/.../dtb
sudo scripts/mount-arkos-readonly.sh umount
scripts/identify-r36s-dtb.sh                    # sobrescreve este arquivo
```
