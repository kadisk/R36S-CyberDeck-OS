# Input / botões — R36S

## Driver

- DTB ativo (`rk3326-r35s-linux.dtb`) declara o nó **`odroidgo3-joypad`**
  (`compatible = "odroidgo3-joypad"`), `joypad-name = "GO-Super Gamepad"`,
  product `0x1100`, revision `0x100`. (Os logs de build do ArkOS, da plataforma de
  referência, mencionam o driver `odroidgo2_joypad` — a família é a mesma; o nó
  **real do R36S** é `odroidgo3-joypad`.)
- Gamepad **GPIO + ADC**: 16 botões GPIO + 2 eixos analógicos.
- Os **2 eixos analógicos** são lidos via `rockchip-saradc` (`ff288000.saradc`).
- Power key separado via **RK817** (`rk8xx_pwrkey`).

> Confirmar os códigos `linux,code` exatos no `.dts`:
> `artifacts/arkos-reference/reports/rk3326-r35s-linux.dts` (nó `odroidgo3-joypad`).

## Mapeamento real — extraído do DTB ativo

O R36S expõe os botões como um joystick Linux (`/dev/input/js0` e
`/dev/input/event*`). Tabela **confirmada** a partir do nó `odroidgo3-joypad` do
`rk3326-r35s-linux.dts` (label do DTB → `linux,code`):

| Label (DTB)     | code   | Constante input.h     | Uso na UI |
|-----------------|--------|-----------------------|-----------|
| DPAD-UP         | 0x220  | `BTN_DPAD_UP`         | foco ↑ |
| DPAD-DOWN       | 0x221  | `BTN_DPAD_DOWN`       | foco ↓ |
| DPAD-LEFT       | 0x222  | `BTN_DPAD_LEFT`       | foco ← |
| DPAD-RIGHT      | 0x223  | `BTN_DPAD_RIGHT`      | foco → |
| BTN-B           | 0x130  | `BTN_SOUTH` (A/sul)   | confirmar (A) |
| BTN-A           | 0x131  | `BTN_EAST` (B/leste)  | voltar (B) |
| BTN-X           | 0x133  | `BTN_NORTH`           | ação 3 |
| BTN-Y           | 0x134  | `BTN_WEST`            | ação 4 |
| TOP-LEFT        | 0x136  | `BTN_TL` (L1)         | aba anterior |
| TOP-RIGHT       | 0x137  | `BTN_TR` (R1)         | próxima aba |
| TOP-LEFT2       | 0x138  | `BTN_TL2` (L2)        | ação extra |
| TOP-RIGHT2      | 0x139  | `BTN_TR2` (R2)        | ação extra |
| F1              | 0x2c0  | `BTN_TRIGGER_HAPPY1`  | menu/atalho |
| F2              | 0x2c1  | `BTN_TRIGGER_HAPPY2`  | atalho |
| F3              | 0x2c2  | `BTN_TRIGGER_HAPPY3`  | atalho |
| F4              | 0x2c3  | `BTN_TRIGGER_HAPPY4`  | atalho |
| F5              | 0x2c4  | `BTN_TRIGGER_HAPPY5`  | atalho |

**17 botões GPIO** no total (4 D-pad + A/B/X/Y + L1/R1/L2/R2 + F1–F5) + **2 eixos
analógicos** (X/Y) via ADC (`invert-absx`/`invert-absy` ativos; deadzone 0x40,
fuzz/flat 0x20). Power é separado (RK817).

> Observação: o **rótulo físico não bate com o código** — o botão rotulado "A" usa
> `BTN_EAST(0x131)` e o "B" usa `BTN_SOUTH(0x130)`. Validar a sensação no aparelho
> com `evtest` antes de fixar A=confirmar / B=voltar na UI.
> START/SELECT não têm código próprio: o R36S usa as teclas **F** (TRIGGER_HAPPY).

## Implicações para a UI (HTML/JS)

A UI **precisa ser 100% navegável por botões** — não há mouse e o touch não é
garantido. Estratégia:

- Mapear o gamepad para eventos de teclado/navegação:
  - D-pad → setas (foco entre elementos).
  - A → Enter/confirmar; B → Esc/voltar.
  - L1/R1 → trocar de aba/seção.
  - Start → menu; Select → ação secundária.
- Usar a **Gamepad API** do navegador quando o runtime suportar; senão, um agente
  lê `/dev/input/js0` e injeta eventos de teclado.
- Foco visível sempre (outline forte), 1 ação primária por tela.

Detalhes de implementação em `docs/web-ui/ui-architecture.md`.

## A confirmar no R36S físico

- [ ] Dispositivos de input (`/dev/input/js0`, `event*`).
- [ ] Códigos de cada botão (`evtest`).
- [ ] Faixa/centragem dos analógicos (ADC) e zona morta.
