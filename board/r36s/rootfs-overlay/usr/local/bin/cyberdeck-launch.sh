#!/bin/sh
# cyberdeck-launch.sh — lançado no tty1 pelo inittab.
# Roda o renderizador de framebuffer; se ele sair/faltar, cai num shell na tela
# (evita loop de respawn e dá depuração mesmo sem cabo serial).
BIN=/usr/local/bin/cyberdeck-fb
if [ -x "$BIN" ]; then
    "$BIN"
    echo
    echo "[cyberdeck] renderizador saiu (cod $?). Shell na tela; saia p/ reiniciar a UI."
fi
exec /bin/sh
