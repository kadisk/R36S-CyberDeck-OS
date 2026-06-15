#!/usr/bin/env bash
# sd-catalog.sh — catálogo de distros R36S, com status de teste E de download.
# Catálogo: scripts/sdcard/r36s-catalog.tsv (versionado).  status: TODO|TESTANDO|FUNCIONA|FALHA|PARCIAL|SKIP
#
# Uso:
#   sd-catalog.sh list                 # tabela: status + baixado?
#   sd-catalog.sh validate             # checa se os links são imagens reais
#   sd-catalog.sh fetch <nome>         # baixa+descomprime+registra UMA
#   sd-catalog.sh fetch-all            # tenta baixar TODAS as não-SKIP; lista o que falhou
#   sd-catalog.sh next | add | result  # (ver README)
set -eu
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SELF/sdcard-lib.sh"
REPO="$(cd "$SELF/../.." && pwd)"
CAT="$SELF/r36s-catalog.tsv"
DL="$REPO/artifacts/test-images/downloads"

cat_init(){ [ -f "$CAT" ] || printf '# nome\tstatus\turl\tnotas\ttestado_em\n' > "$CAT"; }
cat_get(){ grep -vE '^#' "$CAT" 2>/dev/null | awk -F'\t' -v n="$1" '$1==n{print; exit}'; }
cat_set(){ local tmp; tmp="$(mktemp)"; awk -F'\t' -v n="$1" 'NR==1 || $1!=n' "$CAT" > "$tmp"
           printf '%s\t%s\t%s\t%s\t%s\n' "$1" "$2" "$3" "$4" "$5" >> "$tmp"; mv "$tmp" "$CAT"; }
icon(){ case "$1" in FUNCIONA) echo "✅";; FALHA) echo "❌";; PARCIAL) echo "🟡";; TESTANDO) echo "🔄";; SKIP) echo "⛔";; *) echo "⬜";; esac; }
# baixado? imprime caminho se a imagem está registrada e o arquivo existe
dlpath(){ local p; p="$("$SELF/sd-image.sh" list 2>/dev/null | awk -v n="$1" '$1==n{print $NF}')"; [ -n "$p" ] && [ -f "$p" ] && echo "$p"; }

# resolve a URL do catálogo -> "DIRECT<TAB>url<TAB>arquivo" ou "MANUAL<TAB>motivo"
resolve(){ # $1 = url
python3 - "$1" <<'PY'
import sys,urllib.request,json,re
url=sys.argv[1]
def U(u,m='GET'): return urllib.request.urlopen(urllib.request.Request(u,method=m,headers={'User-Agent':'curl/8'}),timeout=30)
EXT=('.img','.img.gz','.img.xz','.7z','.zip')
def out(k,a,b=''): print(f"{k}\t{a}\t{b}"); sys.exit(0)
try:
    if 'mediafire.com/file/' in url:
        h=U(url).read().decode('utf-8','ignore')
        m=re.findall(r'href="(https://download[^"]+\.mediafire\.com/[^"]+)"',h)
        if m: out('DIRECT',m[0],m[0].split('/')[-1].split('?')[0])
        out('MANUAL','MediaFire: link direto não encontrado (baixar no navegador)')
    if 'mediafire.com' in url: out('MANUAL','MediaFire (baixar no navegador)')
    m=re.match(r'https://github.com/([^/]+)/([^/]+)/releases(?:/latest)?/?$',url)
    if m:
        d=json.load(U(f"https://api.github.com/repos/{m[1]}/{m[2]}/releases/latest"))
        a=[x for x in d.get('assets',[]) if x['name'].lower().endswith(EXT)]
        if a: a=sorted(a,key=lambda x:-x['size'])[0]; out('DIRECT',a['browser_download_url'],a['name'])
        out('MANUAL','GitHub sem asset de imagem (link externo na descrição)')
    if 'releases/download/' in url and url.lower().endswith(EXT): out('DIRECT',url,url.split('/')[-1])
    if 'archive.org/details/' in url:
        aid=url.split('/details/')[1].split('/')[0]
        d=json.load(U(f"https://archive.org/metadata/{aid}"))
        f=[x for x in d.get('files',[]) if x['name'].lower().endswith(EXT)]
        if f: f=sorted(f,key=lambda x:-int(x.get('size',0) or 0))[0]; out('DIRECT',f"https://archive.org/download/{aid}/{f['name']}",f['name'])
        out('MANUAL','archive.org sem imagem')
    if url.lower().endswith(EXT): out('DIRECT',url,url.split('/')[-1])
    out('MANUAL','página (não é link direto) — baixar manual')
except Exception as e:
    out('MANUAL',f'erro ao resolver: {str(e)[:50]}')
PY
}

# baixa+descomprime+registra. retorna 0=ok, 2=manual, 1=erro. NÃO usa die (p/ fetch-all).
do_fetch(){ # $1 = nome
    local n="$1" row url; row="$(cat_get "$n")" || true
    [ -n "$row" ] || { echo "  ✗ $n: não está no catálogo"; return 1; }
    if [ -n "$(dlpath "$n")" ]; then echo "  = $n: já baixado/registrado"; return 0; fi
    url="$(printf '%s' "$row" | cut -f3)"
    [ -n "$url" ] && [ "${url:0:1}" != "(" ] || { echo "  — $n: sem URL (local)"; return 2; }
    local r; r="$(resolve "$url")"; local kind dlurl file
    kind="$(printf '%s' "$r" | cut -f1)"; dlurl="$(printf '%s' "$r" | cut -f2)"; file="$(printf '%s' "$r" | cut -f3)"
    if [ "$kind" != "DIRECT" ]; then echo "  ⤓ $n: MANUAL — $dlurl"; return 2; fi
    mkdir -p "$DL"; local f="$DL/${file:-$(basename "$dlurl")}"
    if [ ! -f "$f" ]; then echo "  ↓ $n: baixando $file ..."
        curl -fL --retry 2 -C - --progress-bar -o "$f" "$dlurl" || { echo "  ✗ $n: download falhou"; return 1; }
    else echo "  = $n: já baixado ($file)"; fi
    local img="$f"
    case "$f" in
      *.gz)  img="${f%.gz}"; [ -f "$img" ] || gunzip -kc "$f" > "$img";;
      *.xz)  img="${f%.xz}"; [ -f "$img" ] || { command -v unxz >/dev/null && unxz -kc "$f" > "$img" || { echo "  ✗ $n: sem unxz"; return 1; }; };;
      *.zip) img="$(python3 -c "import zipfile;z=zipfile.ZipFile('$f');m=[i for i in z.infolist() if i.filename.lower().endswith('.img')];print(sorted(m,key=lambda x:-x.file_size)[0].filename if m else '')")"
             [ -n "$img" ] && { python3 -c "import zipfile;zipfile.ZipFile('$f').extract('$img','$DL')"; img="$DL/$img"; } || { echo "  ✗ $n: zip sem .img"; return 1; };;
    esac
    case "$img" in *.img) "$SELF/sd-image.sh" add "$n" "$img" >/dev/null && echo "  ✓ $n: pronto (sd-update <cartao> $n)"; return 0;;
                   *) echo "  ✗ $n: formato não reconhecido ($img)"; return 1;; esac
}

cat_init
cmd="${1:-list}"
case "$cmd" in
  list|"")
    say "============================ CATÁLOGO DE IMAGENS R36S ============================"
    printf '  %-2s %-9s %-9s %-16s %s\n' "" "STATUS" "BAIXADO" "NOME" "NOTAS"
    grep -vE '^#' "$CAT" | while IFS=$'\t' read -r n st url notas data; do
        if [ "$st" = SKIP ]; then dl="—";
        elif [ -n "$(dlpath "$n")" ]; then dl="✓ sim";
        elif [ "${url:0:1}" = "(" ]; then dl="local";
        else dl="✗ não"; fi
        printf '  %-2s %-9s %-9s %-16s %.46s\n' "$(icon "$st")" "$st" "$dl" "$n" "${notas:-}"
    done
    echo
    say "  ✓=baixado (pronto p/ sd-update)  ✗=falta baixar  —=SKIP  | fetch-all baixa todas"
    ;;
  next)
    n="$(grep -vE '^#' "$CAT" | awk -F'\t' '$2=="TODO"{print $1; exit}')"
    [ -n "$n" ] && say "Próxima a testar: $n" || say "Nenhuma TODO."
    ;;
  add)
    [ -n "${2:-}" ] && [ -n "${3:-}" ] || die "uso: $0 add <nome> <url> [notas]"
    cat_set "$2" "TODO" "$3" "${4:-}" ""; ok "candidata '$2' adicionada."
    ;;
  result)
    [ -n "${2:-}" ] && [ -n "${3:-}" ] || die "uso: $0 result <nome> <FUNCIONA|FALHA|PARCIAL> \"notas\""
    row="$(cat_get "$2")"; [ -n "$row" ] || die "'$2' não está no catálogo."
    cat_set "$2" "$3" "$(printf '%s' "$row"|cut -f3)" "${4:-$(printf '%s' "$row"|cut -f4)}" "$(date -Iseconds)"
    ok "$(icon "$3") '$2' = $3."
    ;;
  fetch)
    [ -n "${2:-}" ] || die "uso: $0 fetch <nome>"
    rc=0; do_fetch "$2" || rc=$?
    [ $rc -eq 2 ] && say "  (use download manual + scripts/sdcard/sd-image.sh add $2 <arquivo.img>)"
    ;;
  fetch-all)
    say "=== fetch-all: tentando baixar todas as candidatas (exceto SKIP) ==="
    okl=""; manl=""; errl=""
    for n in $(grep -vE '^#' "$CAT" | awk -F'\t' '$2!="SKIP"{print $1}'); do
        rc=0; do_fetch "$n" || rc=$?
        case $rc in 0) okl="$okl $n";; 2) manl="$manl $n";; *) errl="$errl $n";; esac
    done
    echo; say "================= RESUMO DO FETCH-ALL ================="
    say "✓ baixadas/prontas:$okl"
    say "⤓ MANUAL (baixar no navegador):$manl"
    say "✗ ERRO de download:$errl"
    say "Veja 'scripts/sdcard/sd-catalog.sh list' (coluna BAIXADO)."
    ;;
  validate)
    say "=== validando links (resolve cada URL) ==="
    grep -vE '^#' "$CAT" | while IFS=$'\t' read -r n st url notas data; do
        [ "$st" = SKIP ] && { printf '  ⛔ %-16s SKIP\n' "$n"; continue; }
        [ "${url:0:1}" = "(" ] && { printf '  📁 %-16s LOCAL\n' "$n"; continue; }
        r="$(resolve "$url")"; printf '  %-16s %s\n' "$n" "$(printf '%s' "$r" | cut -f1-2 | tr '\t' ' ')"
    done
    ;;
  *) die "comando inválido: $cmd (use list|next|add|fetch|fetch-all|result|validate)";;
esac
