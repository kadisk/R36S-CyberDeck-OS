# cyberdeck-fb — renderizador 2D no framebuffer (aarch64 estático)
CC      ?= aarch64-linux-gnu-gcc
CFLAGS  ?= -O2 -static -Wall -Wno-format-truncation
OUT      = build/cyberdeck-fb

$(OUT): src/main.c src/font8x16.h
	@mkdir -p build
	$(CC) $(CFLAGS) -o $@ src/main.c
	@file $@

src/font8x16.h:
	python3 tools/gen-font.py > src/font8x16.h

clean:
	rm -rf build

.PHONY: clean
