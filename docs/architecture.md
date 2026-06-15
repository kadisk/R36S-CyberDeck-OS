# Arquitetura — R36S CyberDeck OS

## Visão em camadas

```
┌─────────────────────────────────────────────┐
│  Bootloader (U-Boot / boot.ini do esquema    │
│  RK3326, espelhando o fluxo do ArkOS)        │
└───────────────┬─────────────────────────────┘
                ↓
┌─────────────────────────────────────────────┐
│  Kernel + DTB R36S                            │
│  (rk3326, compatible odroidgo3-linux)         │
└───────────────┬─────────────────────────────┘
                ↓
┌─────────────────────────────────────────────┐
│  Rootfs mínimo (Buildroot)                    │
│  init = systemd OU init minimalista           │
└───────────────┬─────────────────────────────┘
                ↓
┌─────────────────────────────────────────────┐
│  Stack gráfico fullscreen/kiosk               │
│  DRM/KMS direto  OU  Wayland + Cage/Weston    │
└───────────────┬─────────────────────────────┘
                ↓
┌─────────────────────────────────────────────┐
│  Runtime Web (WPE WebKit / WebKitGTK / ...)   │
│  serve e renderiza a UI                       │
└───────────────┬─────────────────────────────┘
                ↓
┌─────────────────────────────────────────────┐
│  CyberDeck UI (HTML / CSS / JavaScript)       │
│  640×480, navegação por botões/teclado        │
└─────────────────────────────────────────────┘
```

## Princípios de design

1. **Hardware como referência, não como base.** Toda decisão de kernel/DTB/painel
   vem da inspeção read-only do ArkOS (`docs/hardware/`), mas o rootfs final é
   construído do zero (Buildroot), sem herdar o Ubuntu 19.10 do ArkOS.

2. **UI desacoplada do sistema.** A interface é uma app web. O sistema expõe
   dados (CPU, RAM, rede, bateria) via uma camada fina (arquivos `/proc`/`/sys`,
   um pequeno agente local, ou um servidor Node/estático). Isso permite iterar a
   UI sem recompilar a distro.

3. **Mínimo de dependências pesadas.** Sem Electron como primeira opção. O alvo
   tem ~1 GB de RAM e GPU Mali-G31. Preferir runtime web embarcado (WPE WebKit)
   ou, na pior hipótese, Chromium kiosk como fallback.

4. **Gráficos: caminho que funciona no R36S físico.** QEMU não emula Mali/painel
   DSI fielmente (ver memória do projeto). A validação final é sempre no aparelho.

## Componentes do repositório → camada

| Camada            | Onde no repo                          |
|-------------------|---------------------------------------|
| Boot / DTB        | `board/r36s/boot`, `docs/boot/`       |
| Rootfs / Buildroot| `buildroot/`, `docs/buildroot/`       |
| Stack gráfico     | `docs/graphics/`, `board/r36s/overlays`|
| Runtime web       | `runtime/`, `docs/web-ui/`            |
| UI                | `cyberdeck-ui/`                       |
| Referência ArkOS  | `artifacts/arkos-reference/`, `docs/hardware/` |

## Fluxo de dados da UI (planejado)

```
/proc, /sys, ip, batería(rk817) ──► agente local (sh/node) ──► JSON/IPC ──► UI JS
                                                                   │
                                          terminal  ◄── pty/websocket ┘
```

Detalhes de runtime em `docs/web-ui/ui-architecture.md`.
