# Plano de teste no R36S físico

O R36S é o **alvo final**. QEMU só serve para iterar a UI no PC; não valida
Mali/painel/joypad/PMIC (ver "Limitações"). Tudo abaixo é testado no aparelho.

## Pré-requisitos

- 1 microSD dedicado para teste (não o do ArkOS de produção).
- Adaptador USB-serial opcional para console de debug (`ttyS1`, 1500000 8N1 típico
  no RK3326) — muito útil quando a tela ainda não funciona.
- Imagem gerada (Buildroot) ou layout manual (`scripts/create-sd-layout.sh`).

## Checklist por fase

### Boot (Fase 2)
- [ ] Cartão é reconhecido pelo BootROM (SPL/U-Boot carrega).
- [ ] `boot.ini`/extlinux carrega kernel + DTB rk3326.
- [ ] Kernel imprime no console serial.
- [ ] Chega a um shell de login (serial e/ou tty).
- [ ] `cat /proc/device-tree/model` mostra o modelo rk3326 esperado.

### Tela e input (Fase 3)
- [ ] `/dev/dri/card0` presente; `modetest` lista 640×480.
- [ ] Painel acende com imagem (orientação correta).
- [ ] Backlight controlável (`/sys/class/backlight/*/brightness`).
- [ ] `/dev/input/js0` existe; `evtest` mostra os 16 botões + 2 analógicos.

### Runtime web (Fase 4)
- [ ] Cage sobe em fullscreen sobre o DRM.
- [ ] WPE WebKit renderiza `index.html`.
- [ ] EGL/GLES inicializa no Mali-G31 (ou cai p/ software sem travar).

### UI CyberDeck (Fase 5)
- [ ] Todas as seções abrem.
- [ ] Navegação **só com botões** funciona (sem mouse).
- [ ] CPU/RAM/rede/bateria/relógio mostram dados reais.
- [ ] Terminal abre e executa comandos.
- [ ] Bateria (RK817) lê carga e status de charging.

### Energia / robustez (Fase 8)
- [ ] Tempo de boot medido.
- [ ] Botão power (RK817) desliga/suspende como esperado.
- [ ] Remover energia não corrompe o rootfs (read-mostly / fsck).

## Registro de resultados

Anotar cada execução em `docs/testing/results/<data>-<fase>.md` (criar quando
houver testes reais), com: versão da imagem, comportamento, logs de serial.

## Limitações do QEMU (não substitui o aparelho)

- QEMU **não** emula RK3326/Mali/RK817/painel DSI/joypad fielmente.
- Útil só para: desenvolver a UI no navegador, validar lógica do agente de dados,
  testar scripts de userspace via chroot aarch64.
- Render acelerado, input do gamepad, bateria e brilho: **só no R36S**.
