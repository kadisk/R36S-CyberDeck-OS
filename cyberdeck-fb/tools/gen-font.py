#!/usr/bin/env python3
# gen-font.py — gera src/font8x16.h a partir de uma fonte de console PSF (8x16).
# Uso: python3 tools/gen-font.py [/caminho/Lat15-VGA16.psf.gz] > src/font8x16.h
# Extrai os glifos ASCII 32..126 (95 chars), 8x16 (16 bytes/char).
import sys, gzip, struct

DEFAULT = "/usr/share/consolefonts/Lat15-VGA16.psf.gz"

def load(path):
    data = gzip.open(path, "rb").read() if path.endswith(".gz") else open(path, "rb").read()
    if data[:2] == b"\x36\x04":          # PSF1
        charsize = data[3]
        glyphs = data[4:]
        return glyphs, charsize, 8
    if data[:4] == b"\x72\xb5\x4a\x86":   # PSF2
        (ver, hdr, flags, length, charsize, height, width) = struct.unpack("<IIIIIII", data[4:32])
        return data[hdr:], charsize, width
    raise SystemExit("formato PSF desconhecido")

def main():
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT
    glyphs, charsize, width = load(path)
    if charsize < 16:
        raise SystemExit(f"fonte não é 16px de altura (charsize={charsize})")
    out = []
    out.append("/* Gerado por tools/gen-font.py a partir de %s */" % path)
    out.append("/* ASCII 32..126, 8x16, MSB = pixel da esquerda. */")
    out.append("#ifndef FONT8X16_H\n#define FONT8X16_H")
    out.append("#define FONT_FIRST 32")
    out.append("#define FONT_LAST  126")
    out.append("#define FONT_W 8\n#define FONT_H 16")
    out.append("static const unsigned char font8x16[%d][16] = {" % (126 - 32 + 1))
    for c in range(32, 127):
        g = glyphs[c * charsize : c * charsize + 16]
        row = ", ".join("0x%02x" % b for b in g)
        out.append("  { %s }, /* %d '%s' */" % (row, c, chr(c) if c != 92 else "\\\\"))
    out.append("};")
    out.append("#endif")
    print("\n".join(out))

if __name__ == "__main__":
    main()
