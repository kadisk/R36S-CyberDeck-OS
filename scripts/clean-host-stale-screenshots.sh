#!/usr/bin/env bash
# clean-host-stale-screenshots.sh — remove os screenshots SOLTOS na raiz de uma pasta
# de screenshots já puxada para o host (ex.: ~/cyberdeck-screenshots/<cartao>/), que
# foram gerados pelo agente PRÉ-fix (nomes por data). Preserva as pastas v<ver>/.
# NÃO precisa de sudo (mexe só em arquivos do usuário no host).
#
# Uso:  scripts/clean-host-stale-screenshots.sh [pasta]
#       (default: ~/cyberdeck-screenshots/sandisk-extreme-64gb-1)
set -eu

DIR="${1:-$HOME/cyberdeck-screenshots/sandisk-extreme-64gb-1}"
[ -d "$DIR" ] || { echo "[host-clean][ERRO] pasta não existe: $DIR" >&2; exit 1; }

COUNT="$(find "$DIR" -maxdepth 1 -type f -name 'shot-*.png' | wc -l)"
if [ "$COUNT" -eq 0 ]; then
    echo "✓ nada a limpar — sem screenshots soltos na raiz de $DIR"
    exit 0
fi

echo "Serão removidos $COUNT arquivo(s) solto(s) em $DIR:"
find "$DIR" -maxdepth 1 -type f -name 'shot-*.png' -printf '   %f\n'
find "$DIR" -maxdepth 1 -type f -name 'shot-*.png' -delete

KEPT="$(find "$DIR" -mindepth 2 -type f -name '*.png' | wc -l)"
echo "✓ removidos $COUNT solto(s); preservados $KEPT print(s) em pastas de versão."
