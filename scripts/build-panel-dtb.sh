#!/usr/bin/env bash
# build-panel-dtb.sh — gera um DTB do R36S com o PAINEL nativo elida,kd35t133.
#
# O DTB mainline base (rk3326-gameconsole-r36s.dtb, do Arch-R) traz um painel
# placeholder (sitronix,st7703) e depende do overlay do wizard do Arch-R. Como o
# kernel mainline TEM o driver nativo `elida,kd35t133` (o painel real do nosso R36S,
# confirmado na Fase 1), trocamos o `compatible` do painel para usá-lo direto —
# sem depender da auto-detecção do Arch-R.
#
# Saída: artifacts/mainline/custom-dtb/rk3326-gameconsole-r36s.dtb
set -eu
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SELF/.." && pwd)"
ML="$REPO/artifacts/mainline"
BASE="$ML/dtb/dtbs/rk3326-gameconsole-r36s.dtb"
OUT="$ML/custom-dtb/rk3326-gameconsole-r36s.dtb"
DTS="$ML/custom-dtb/r36s-cyberdeck.dts"

log(){ echo "[panel-dtb] $*"; }
[ -f "$BASE" ] || { echo "DTB base ausente ($BASE). Rode scripts/extract-mainline-kernel.sh"; exit 1; }
mkdir -p "$ML/custom-dtb"

log "decompilando base e trocando o painel -> elida,kd35t133"
dtc -I dtb -O dts "$BASE" 2>/dev/null > "$ML/custom-dtb/base.dts"
python3 - "$ML/custom-dtb/base.dts" "$DTS" <<'PY'
import sys,re
src,out=sys.argv[1],sys.argv[2]
s=open(src).read()
i=s.index('panel@0 {'); k=s.index('port {',i)
block=s[i:k]
block=block.replace('compatible = "gameconsole,r36s-panel\\0sitronix,st7703";',
                    'compatible = "elida,kd35t133";')
if 'vcc-supply' not in block and 'iovcc-supply = <0x94>;' in block:
    block=block.replace('iovcc-supply = <0x94>;',
                        'iovcc-supply = <0x94>;\n\t\t\tvcc-supply = <0x94>;')
open(out,'w').write(s[:i]+block+s[k:])
print("ok" if 'elida,kd35t133' in open(out).read() else "FALHOU")
PY
dtc -I dts -O dtb -o "$OUT" "$DTS" 2>/dev/null
[ -s "$OUT" ] || { echo "[panel-dtb][ERRO] dtc não gerou o DTB"; exit 1; }
log "DTB gerado: $OUT ($(stat -c %s "$OUT") bytes)"
dtc -I dtb -O dts "$OUT" 2>/dev/null | grep -m1 'elida,kd35t133' && log "painel elida,kd35t133 confirmado."
