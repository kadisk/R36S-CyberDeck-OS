# Plano de boot do rootfs mínimo — Fase 2

Objetivo: **provar que conseguimos bootar um rootfs nosso no R36S físico**,
reutilizando o boot funcional do ArkOS (kernel + uInitrd + DTB + U-Boot), mas com
`root=` apontando para uma partição rootfs experimental controlada pelo projeto.

Sem UI, sem WPE/Cage/Weston, sem Node, sem EmulationStation. Só BusyBox + shell.

## Estratégia

```
BootROM RK3326
   ↓ (idbloader + U-Boot copiados do ArkOS, setores 64..32767)
U-Boot  ── lê mmc 1:1 (p1 FAT) ──► boot.ini de TESTE
   ↓ load Image + uInitrd + rk3326-r35s-linux.dtb ; booti
Kernel 4.4.189 + DTB rk3326  (idênticos ao ArkOS)
   ↓ uInitrd (initramfs do ArkOS) lê root=UUID=<nosso> do cmdline
   ↓ monta a p2 ext4 e faz switch_root para /sbin/init
NOSSO rootfs mínimo (BusyBox)
   ↓ /sbin/init -> /etc/inittab -> /etc/init.d/rcS
Banner "R36S CyberDeck OS minimal rootfs" + shell em ttyFIQ0 e tty1
```

### Por que reutilizar kernel/uInitrd/DTB do ArkOS

São o caminho **comprovadamente funcional** neste hardware. Trocamos só o rootfs.
Isolar uma variável por vez: se não bootar, o problema está no nosso rootfs ou no
`root=`, não no kernel/painel/SoC.

### O que muda no `boot.ini` de teste (`board/r36s/boot/boot.ini`)

| Item | ArkOS | Teste CyberDeck | Motivo |
|------|-------|-----------------|--------|
| `quiet` | sim | **removido** | ver log do kernel |
| `splash`/plymouth | sim | **removido** | ver mensagens, não a splash |
| `console=/dev/ttyFIQ0` | sim | **mantido** | console serial real do RK3326 |
| `fbcon=rotate:0` | sim | **mantido** | console de tela sem rotação |
| `consoleblank=0` | sim | **mantido** | tela não apaga |
| `root=` | `UUID=e139ce78…` (ArkOS) | `UUID=c1be7dec-0de0-4a17-9f3a-7e5b00c0de36` (nosso) | montar NOSSO rootfs |
| `init=` | (implícito) | `init=/sbin/init` | explícito (BusyBox) |
| `rootfstype` | — | `ext4` | acelera/garante o mount |
| `loglevel` | — | `7` | logs detalhados |

A UUID do `root=` **precisa casar** com a da partição rootfs gerada
(`scripts/phase2-config.sh: R36S_ROOTFS_UUID`). O `mke2fs` fixa essa UUID.

## A região de bootloader (crítico)

O BootROM do RK3326 carrega o **idbloader (SPL+TPL)** do **setor 64** e o **U-Boot**
de ~setor 16384 — **antes** da partição p1. Uma imagem recém-criada não tem isso.
`create-test-sd-image.sh` **copia os setores 64..32767 da imagem ArkOS** (somente
leitura) para a imagem de teste, preservando nosso MBR (setor 0). Sem essa região,
**o R36S não inicia**.

## O initramfs do ArkOS (uInitrd)

- Formato: uImage U-Boot encapsulando um **cpio newc comprimido em LZ4 (legacy
  frame, magic `02 21 4c 18`)**. Para inspecionar: instalar `lz4`, remover o
  cabeçalho de 64 bytes, `lz4 -d`, depois `cpio -idmv`.
- **Premissa:** como todo initramfs de distro, ele lê `root=` do cmdline, aguarda
  o dispositivo (`rootwait`), monta e faz `switch_root` para `/sbin/init`. Por isso
  basta trocar a UUID. (Premissa a confirmar no 1º boot físico.)

### Plano B (se o uInitrd não fizer switch_root para o nosso rootfs)

1. **Sem uInitrd:** remover a linha `load ... uInitrd` e o argumento de initrd do
   `booti` — depende do kernel ter mmc/dwmmc + ext4 *built-in* (provável em BSP
   RK3326). Testar.
2. **initramfs próprio:** gerar um cpio mínimo (BusyBox) que monta `root=UUID` e
   `switch_root` — controle total, remove a dependência do blob do ArkOS.
3. **`root=/dev/mmcblk0p2`** em vez de UUID, caso a resolução por UUID falhe no
   initramfs do ArkOS.

Esses planos ficam para a iteração seguinte **se** o caminho principal falhar.

## Conteúdo do rootfs mínimo

Fonte versionada: `board/r36s/rootfs-overlay/` + BusyBox aarch64 (baixado pelo
script). Montado por `create-minimal-rootfs.sh`:

- `/bin/busybox` (aarch64 static, 1.36.1) + symlinks de todos os applets;
- `/sbin/init` → `/bin/busybox`; `/init` → idem (caso o initramfs procure `/init`);
- `/etc/inittab` (BusyBox init): `rcS` + shells em `ttyFIQ0`, `tty1` e console genérico;
- `/etc/init.d/rcS`: monta proc/sys/devtmpfs/devpts/run, `busybox --install -s`, banner;
- `/etc/fstab`, `/etc/issue`, `/etc/os-release`;
- nós de `/dev`: `console` (5:1), `null` (1:3), `tty` (5:0), `tty1` (4:1) — via
  `fakeroot` (devtmpfs cria o resto no boot);
- tudo `root:root` (via `fakeroot`).

## Critério de sucesso (no R36S físico)

- Serial `ttyFIQ0` mostra o log do kernel e o **banner do nosso rootfs**.
- A tela mostra o log/banner ou um shell.
- `cat /etc/os-release` → "R36S CyberDeck OS".
- `cat /proc/device-tree/model` → modelo rk3326.
- Shell interativo responde.

Checklist detalhado: `docs/testing/phase2-boot-checklist.md`.
