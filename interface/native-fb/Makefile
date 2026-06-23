# cyberdeck-fb — renderizador 2D no framebuffer (aarch64 estático)
CC      ?= aarch64-linux-gnu-gcc
CFLAGS  ?= -O2 -static -Wall -Wno-format-truncation -Wno-misleading-indentation -Isrc
OUT      = build/cyberdeck-fb
SRCS     = src/main.c src/fb.c src/input.c src/http.c src/ui.c src/views.c src/cjson/cJSON.c

$(OUT): $(SRCS) src/font8x16.h
	@mkdir -p build
	$(CC) $(CFLAGS) -o $@ $(SRCS)
	@file $@

src/font8x16.h:
	python3 tools/gen-font.py > src/font8x16.h

clean:
	rm -rf build

.PHONY: clean
