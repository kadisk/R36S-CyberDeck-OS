# R36S CyberDeck OS

Uma distribuição Linux embarcada que transforma o **handheld R36S** (Rockchip
RK3326) em um **CyberDeck portátil** — não em um console de jogos.

A interface principal é uma aplicação **HTML/CSS/JavaScript** rodando em
**fullscreen/kiosk** diretamente sobre o hardware, sem desktop tradicional e sem
EmulationStation.

---

## O que este projeto **é**

- Uma distro Linux mínima e embarcada para o R36S.
- Um **CyberDeck**: terminal, status do sistema, rede, scripts e ferramentas.
- Uma UI feita em **HTML/JS**, renderizada em modo kiosk (640×480).
- Pensada para bootar no **R36S físico** como alvo final.

## O que este projeto **NÃO é**

- ❌ Não é uma distro de jogos / emulação.
- ❌ Não usa EmulationStation.
- ❌ Não depende de emuladores ou cores RetroArch.
- ❌ Não usa o ArkOS como rootfs final.
- ❌ Não é o projeto `arkos-r36s-dev-lab` (laboratório separado, preservado).

## Por que não é uma distro de jogos

O objetivo é um dispositivo de **uso geral portátil** (cyberdeck): ferramentas de
sistema, rede, scripts e uma UI própria. Jogos não são o foco; o hardware do R36S
(tela pequena, gamepad, 2 slots microSD) é aproveitado para uma experiência de
"computador de bolso hacker", não de console.

## Por que o ArkOS é usado **apenas como referência**

O R36S não tem documentação aberta completa. O ArkOS é uma distro que **já boota
corretamente** neste hardware. Por isso ele é usado como **fonte de verdade sobre
o hardware** — kernel, DTB, painel, input, PMIC, áudio, partições e fluxo de boot.

> ⚠️ A imagem ArkOS é **somente leitura**. Nunca é modificada. Apenas inspecionada.

A imagem de referência usada está em:

```
Backups/ArkOS/ArkOS_2.0_08232024_AeUX_backup_2026-06-03.img
```

---

## Hardware do R36S (resumo — ver `docs/hardware/`)

| Componente   | Detalhe |
|--------------|---------|
| SoC          | Rockchip **RK3326** |
| CPU          | 4× ARM Cortex-A35 (AArch64) |
| RAM          | ~1 GB |
| GPU          | ARM **Mali-G31** (Bifrost) |
| Display      | Painel **MIPI-DSI** `elida,kd35t133`, **640×480**, backlight PWM |
| PMIC         | **RK817** (power-key, gpio, áudio, bateria, carga) |
| Áudio        | `rk817-codec` |
| Input        | **odroidgo2-joypad** (16 botões GPIO + 2 analógicos via SARADC) |
| Armazenamento| 2× microSD (`mmcblk0` SO + `mmcblk1` dados) via dwmmc_rockchip |
| DTB ativo    | `rk3326-r35s-linux.dtb` → `rockchip,rk3326-odroidgo3-linux` |
| Kernel ArkOS | Linux 4.4.189 (BSP Rockchip) |

> Sem Wi-Fi/Ethernet internos — rede só via dongle USB (OTG/dwc2).

---

## Plano técnico (resumo — ver `docs/architecture.md` e `docs/roadmap.md`)

```
Bootloader → Kernel + DTB R36S → Rootfs mínimo →
DRM/KMS / Wayland kiosk → Runtime Web → CyberDeck UI (HTML/JS)
```

Base de construção planejada: **Buildroot** (ver `docs/buildroot/strategy.md`).

## Alvo final

O **R36S físico**. QEMU é usado **apenas** como ferramenta auxiliar de
desenvolvimento — nunca como alvo final (limitações documentadas em
`docs/testing/`).

---

## Como inspecionar a imagem ArkOS (read-only)

```bash
# 1) Layout de partições + relatório (não precisa sudo, não monta)
scripts/inspect-arkos-image.sh

# 2) Montar p1/p2 somente leitura (precisa sudo)
sudo scripts/mount-arkos-readonly.sh
#    ... inspecionar mnt/arkos/boot e mnt/arkos/rootfs ...
sudo scripts/mount-arkos-readonly.sh umount

# 3) Extrair kernel/DTB/boot configs para artifacts/
sudo scripts/extract-arkos-boot-artifacts.sh

# 4) Decodificar DTBs -> docs/hardware/device-tree-analysis.md
scripts/identify-r36s-dtb.sh
```

## Fase 2 — boot mínimo experimental (gerar cartão de teste)

Prova de que um **rootfs nosso** boota no R36S, reutilizando o boot do ArkOS
(kernel/uInitrd/DTB/U-Boot) mas com `root=` apontando para uma p2 ext4 própria
(BusyBox + shell). Sem UI/WPE/Cage ainda.

```bash
# Gera artifacts/test-images/r36s-cyberdeck-minimal.img (não grava em cartão)
scripts/create-test-sd-image.sh

# Mostra lsblk + o comando dd recomendado (também não grava)
scripts/print-flash-command.sh
```

Depois, **você** grava em um microSD **de teste** (nunca o ArkOS):

```bash
sudo dd if=artifacts/test-images/r36s-cyberdeck-minimal.img of=/dev/sdX bs=4M status=progress conv=fsync
```

Detalhes: `docs/boot/minimal-rootfs-boot-plan.md`,
`docs/boot/sd-card-test-layout.md`, `docs/testing/phase2-boot-checklist.md`.
A imagem ArkOS permanece **somente leitura** (dela só copiamos a região de
bootloader RK3326).

## Estrutura do repositório

```
docs/          documentação (hardware, boot, gráficos, web-ui, buildroot, testing)
scripts/       inspeção da imagem ArkOS + utilitários de SD/flash
artifacts/     artefatos extraídos do ArkOS (referência) + relatórios
board/r36s/    arquivos específicos da placa (boot, overlays, rootfs-overlay)
buildroot/     defconfig + external tree (planejado)
cyberdeck-ui/  aplicação web (HTML/CSS/JS) — a interface do CyberDeck
runtime/       serviço systemd + scripts de inicialização da UI
```

Ver `CHANGELOG.md` para o histórico e `docs/roadmap.md` para as próximas fases.
