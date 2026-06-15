# Inventário de hardware do R36S (referência ArkOS)

> Consolidado a partir da inspeção **somente leitura** da imagem ArkOS
> `ArkOS_2.0_08232024_AeUX_backup_2026-06-03.img` e dos logs/device-tree contidos
> nela. Dados de DT são confiáveis (descrevem o SoC do R36S); dados de logs de
> userspace do ArkOS são marcados quando vêm do host de build, não do aparelho.

## SoC e núcleo

| Componente | Detalhe | Origem |
|------------|---------|--------|
| Modelo / DT | `ODROID-GO2 for linux based on Rockchip rk3326` | device-tree |
| compatible  | `rockchip,rk3326-odroidgo3-linux` | DTB ativo |
| SoC         | Rockchip **RK3326** | DT |
| CPU         | 4× ARM **Cortex-A35** (AArch64, `410fd042`) | DT/boot |
| RAM         | **~1 GB** (`~900 MB` disponível) | boot `Memory:` |
| Kernel      | **Linux 4.4.189** (`#192 SMP 2025-07-09`, gcc Linaro 7.3) | banner do `Image` |
| Console dbg | **`/dev/ttyFIQ0`** (FIQ debugger RK3326) | `boot.ini` |
| Nº de série | `0e0e2dee6de7344f` | rockchip-cpuinfo |

## Gráficos

| Componente | Detalhe |
|------------|---------|
| GPU        | ARM **Mali-G31** (Bifrost) em `ff400000.gpu`, `arch 7.0.9 r0p0` |
| Display    | Rockchip DRM **VOP** `ff460000.vop` |
| Painel     | **MIPI-DSI** `ff450000.dsi`, painel `elida,kd35t133` (640×480) |
| Backlight  | **PWM** 3.3 V (`vcc_backlight`) |
| Driver Mali| Userspace ArkOS usa **blob Mali** (`libMali.so`). Para CyberDeck, avaliar Mesa/Panfrost. |

## Energia / PMIC

| Componente | Detalhe |
|------------|---------|
| PMIC       | **RK817** (`pmic@20` em `i2c@ff180000`) |
| Power key  | `rk8xx_pwrkey` |
| GPIO       | `rk817-gpio` |
| Bateria    | `rk817-battery` (fuel-gauge) |
| Carga      | `rk817-charger` |

## Áudio

| Componente | Detalhe |
|------------|---------|
| Codec      | `rk817-codec` → `card0 "rockchip,rk817-codec"` |
| Detecção   | input `rockchip,rk817-codec Headphones` (fone) |

## Input / controles

| Componente | Detalhe |
|------------|---------|
| Gamepad    | DTB ativo: **`odroidgo3-joypad`** ("GO-Super Gamepad") — **17 botões GPIO** + 2 eixos analógicos. Mapa completo em `input-buttons.md`. |
| ADC        | `rockchip-saradc` `ff288000.saradc` (lê os analógicos; cal adc0=824, adc1=977) |

## Armazenamento

| Componente | Detalhe |
|------------|---------|
| Controlador| **dwmmc_rockchip** `ff370000` (UHS SDR50) |
| Slot 1     | `mmcblk0` — cartão do SO, partições **p1 p2 p3** |
| Slot 2     | `mmcblk1` — 2º slot microSD (dados/ROMs no ArkOS) |

## Conectividade / USB

| Componente | Detalhe |
|------------|---------|
| USB        | **dwc2** `ff300000.usb` (OTG→host) + EHCI 2.0 / OHCI 1.1 |
| Wi-Fi/Eth  | **Não há internos.** Só via dongle USB. (Adaptadores Realtek vistos nos logs eram do host de build do ArkOS, não do aparelho.) |

## Térmico / serial

| Componente | Detalhe |
|------------|---------|
| Sensor     | `rockchip-thermal` `ff280000.tsadc` |
| UART       | `ttyS1` 16550A em `ff158000`; **o console de debug do boot é `/dev/ttyFIQ0`** (FIQ), conforme `boot.ini` |

## Implicações para o CyberDeck OS

- **Tela alvo: 640×480** — toda a UI deve caber e ser navegável nesse tamanho.
- **GPU Mali-G31** — preferir runtime web com aceleração via Mesa/Panfrost; cair
  para software rendering se necessário (UI é leve).
- **Sem rede interna** — UI de rede deve assumir dongle USB opcional.
- **Bateria via RK817** — leitura de carga vem do PMIC (`/sys/class/power_supply`).
- **Input por gamepad** — a UI precisa ser 100% navegável por botões (ver
  `docs/hardware/input-buttons.md`).
