# Input / botões — R36S

## Driver

- **`odroidgo2-joypad`** — gamepad GPIO + ADC.
- **16 botões GPIO** (sw1–sw16).
- **2 eixos analógicos** lidos via `rockchip-saradc` (`ff288000.saradc`).
  Calibração observada: adc0=824, adc1=977.
- Power key separado via **RK817** (`rk8xx_pwrkey`).

## Mapeamento típico (a confirmar no aparelho)

O R36S expõe os botões como um joystick Linux (`/dev/input/js0` e
`/dev/input/event*`). Layout físico esperado:

```
   D-pad           ABXY
   ┌─┐         (Y)
 ┌─┘ └─┐     (X)   (B)
 │     │         (A)
 └─┐ ┌─┘
   └─┘
 L1/L2          R1/R2
   SELECT  START
   F1..Fn (botões de função/atalho)
   Analógico esquerdo + direito (ADC)
   Power (via PMIC)
```

> O mapeamento exato (códigos `KEY_*`/`BTN_*`/`ABS_*`) deve ser lido no aparelho
> com `evtest` ou do `.dts` (`linux,code`). Documentar aqui após Fase 3.

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
