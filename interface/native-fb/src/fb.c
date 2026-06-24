/* fb.c — framebuffer 2D com double buffer. Ver fb.h. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/mman.h>
#include <sys/ioctl.h>
#include <linux/fb.h>
#include <linux/kd.h>

#include "fb.h"
#include "font8x16.h"

static unsigned char *g_fb = NULL;     /* /dev/fb0 mapeado */
static unsigned char *g_back = NULL;    /* backbuffer offscreen */
static struct fb_var_screeninfo vi;
static struct fb_fix_screeninfo fi;
static long g_size = 0;
static int  g_fd = -1;
static int  g_tty = -1;
static int  g_bypp = 4;

int fb_w(void) { return (int)vi.xres; }
int fb_h(void) { return (int)vi.yres; }

unsigned long fb_pack(int r, int g, int b) {
    return ((unsigned long)(r >> (8 - vi.red.length))   << vi.red.offset)
         | ((unsigned long)(g >> (8 - vi.green.length)) << vi.green.offset)
         | ((unsigned long)(b >> (8 - vi.blue.length))  << vi.blue.offset);
}

void fb_pixel(int x, int y, unsigned long c) {
    if (x < 0 || y < 0 || x >= (int)vi.xres || y >= (int)vi.yres) return;
    long off = (long)y * fi.line_length + (long)x * g_bypp;
    if (vi.bits_per_pixel == 16) *(uint16_t *)(g_back + off) = (uint16_t)c;
    else                         *(uint32_t *)(g_back + off) = (uint32_t)c;
}

void fb_fill(int x, int y, int w, int h, unsigned long c) {
    if (x < 0) { w += x; x = 0; }
    if (y < 0) { h += y; y = 0; }
    if (x + w > (int)vi.xres) w = (int)vi.xres - x;
    if (y + h > (int)vi.yres) h = (int)vi.yres - y;
    for (int j = 0; j < h; j++) {
        long off = (long)(y + j) * fi.line_length + (long)x * g_bypp;
        if (vi.bits_per_pixel == 16) { uint16_t *p = (uint16_t *)(g_back + off); for (int i = 0; i < w; i++) p[i] = (uint16_t)c; }
        else                         { uint32_t *p = (uint32_t *)(g_back + off); for (int i = 0; i < w; i++) p[i] = (uint32_t)c; }
    }
}

void fb_clear(unsigned long c) { fb_fill(0, 0, (int)vi.xres, (int)vi.yres, c); }

void fb_char(int x, int y, char ch, unsigned long fg, unsigned long bg, int show_bg) {
    unsigned char u = (unsigned char)ch;
    if (u < FONT_FIRST || u > FONT_LAST) u = '?';
    const unsigned char *g = font8x16[u - FONT_FIRST];
    for (int row = 0; row < FONT_H; row++)
        for (int col = 0; col < FONT_W; col++) {
            if (g[row] & (0x80 >> col)) fb_pixel(x + col, y + row, fg);
            else if (show_bg)           fb_pixel(x + col, y + row, bg);
        }
}

/* A fonte é ASCII 32..126. O agente devolve UTF-8 (acentos): dobramos os
 * code points latinos/pontuação comuns para ASCII; o resto vira '?'. */
static char fold_cp(unsigned cp) {
    if (cp < 0x80) return (char)cp;
    switch (cp) {
        case 0xC0: case 0xC1: case 0xC2: case 0xC3: case 0xC4: case 0xC5: return 'A';
        case 0xC7: return 'C';
        case 0xC8: case 0xC9: case 0xCA: case 0xCB: return 'E';
        case 0xCC: case 0xCD: case 0xCE: case 0xCF: return 'I';
        case 0xD1: return 'N';
        case 0xD2: case 0xD3: case 0xD4: case 0xD5: case 0xD6: return 'O';
        case 0xD9: case 0xDA: case 0xDB: case 0xDC: return 'U';
        case 0xDD: return 'Y';
        case 0xE0: case 0xE1: case 0xE2: case 0xE3: case 0xE4: case 0xE5: return 'a';
        case 0xE7: return 'c';
        case 0xE8: case 0xE9: case 0xEA: case 0xEB: return 'e';
        case 0xEC: case 0xED: case 0xEE: case 0xEF: return 'i';
        case 0xF1: return 'n';
        case 0xF2: case 0xF3: case 0xF4: case 0xF5: case 0xF6: return 'o';
        case 0xF9: case 0xFA: case 0xFB: case 0xFC: return 'u';
        case 0xFD: case 0xFF: return 'y';
        case 0xAA: case 0xBA: return 'o';
        case 0xB0: return ' ';                       /* ° */
        case 0x2026: return '.';                     /* … */
        case 0x2013: case 0x2014: return '-';        /* – — */
        case 0x2018: case 0x2019: return '\'';       /* ' ' */
        case 0x201C: case 0x201D: return '"';        /* " " */
        case 0x2022: return '*';                     /* • */
        default: return '?';
    }
}
/* decodifica UTF-8 -> ASCII dobrado, 1 char por code point. */
static void utf8_fold(const char *s, char *out, int outsz) {
    int o = 0;
    const unsigned char *p = (const unsigned char *)s;
    while (*p && o < outsz - 1) {
        unsigned cp; int n;
        if (*p < 0x80)            { cp = *p; n = 1; }
        else if ((*p & 0xE0) == 0xC0) { cp = (*p & 0x1F); n = 2; }
        else if ((*p & 0xF0) == 0xE0) { cp = (*p & 0x0F); n = 3; }
        else if ((*p & 0xF8) == 0xF0) { cp = (*p & 0x07); n = 4; }
        else { p++; continue; }
        int ok = 1;
        for (int i = 1; i < n; i++) { if ((p[i] & 0xC0) != 0x80) { ok = 0; break; } cp = (cp << 6) | (p[i] & 0x3F); }
        if (!ok) { p++; continue; }
        out[o++] = fold_cp(cp);
        p += n;
    }
    out[o] = 0;
}

void fb_text(int x, int y, const char *s, unsigned long fg, unsigned long bg, int show_bg) {
    char buf[1024]; utf8_fold(s, buf, sizeof buf);
    for (const char *q = buf; *q; q++, x += FONT_W) fb_char(x, y, *q, fg, bg, show_bg);
}

void fb_text_clip(int x, int y, const char *s, int max_chars, unsigned long fg, unsigned long bg, int show_bg) {
    char buf[1024]; utf8_fold(s, buf, sizeof buf);
    int n = (int)strlen(buf);
    if (n <= max_chars) { fb_text(x, y, buf, fg, bg, show_bg); return; }
    if (max_chars <= 1) return;
    for (int i = 0; i < max_chars - 1; i++, x += FONT_W) fb_char(x, y, buf[i], fg, bg, show_bg);
    fb_char(x, y, '~', fg, bg, show_bg);
}

int fb_text_w(const char *s) { char b[1024]; utf8_fold(s, b, sizeof b); return (int)strlen(b) * FONT_W; }

/* desenha um glyph ampliado por um fator inteiro (cada pixel vira um bloco scale×scale). */
void fb_char_scaled(int x, int y, char ch, unsigned long fg, unsigned long bg, int show_bg, int scale) {
    if (scale < 1) scale = 1;
    if (scale == 1) { fb_char(x, y, ch, fg, bg, show_bg); return; }
    unsigned char u = (unsigned char)ch;
    if (u < FONT_FIRST || u > FONT_LAST) u = '?';
    const unsigned char *g = font8x16[u - FONT_FIRST];
    for (int row = 0; row < FONT_H; row++)
        for (int col = 0; col < FONT_W; col++) {
            if (g[row] & (0x80 >> col))      fb_fill(x + col * scale, y + row * scale, scale, scale, fg);
            else if (show_bg)                fb_fill(x + col * scale, y + row * scale, scale, scale, bg);
        }
}
void fb_text_scaled(int x, int y, const char *s, unsigned long fg, unsigned long bg, int show_bg, int scale) {
    if (scale < 1) scale = 1;
    char buf[1024]; utf8_fold(s, buf, sizeof buf);
    for (const char *q = buf; *q; q++, x += FONT_W * scale) fb_char_scaled(x, y, *q, fg, bg, show_bg, scale);
}
int fb_text_w_scaled(const char *s, int scale) { return fb_text_w(s) * (scale < 1 ? 1 : scale); }

void fb_present(void) {
    if (g_fb && g_back) memcpy(g_fb, g_back, g_size);
}

int fb_init(void) {
    g_fd = open("/dev/fb0", O_RDWR);
    if (g_fd < 0) { perror("open /dev/fb0"); return 1; }
    if (ioctl(g_fd, FBIOGET_FSCREENINFO, &fi) || ioctl(g_fd, FBIOGET_VSCREENINFO, &vi)) {
        perror("ioctl fbinfo"); return 1;
    }
    g_bypp = vi.bits_per_pixel / 8;
    g_size = (long)fi.line_length * vi.yres;
    g_fb = mmap(NULL, g_size, PROT_READ | PROT_WRITE, MAP_SHARED, g_fd, 0);
    if (g_fb == MAP_FAILED) { perror("mmap"); g_fb = NULL; return 1; }
    g_back = malloc(g_size);
    if (!g_back) { perror("malloc backbuffer"); return 1; }
    memset(g_back, 0, g_size);

    /* tty1 em modo gráfico p/ o fbcon não desenhar por cima */
    g_tty = open("/dev/tty1", O_RDWR);
    if (g_tty >= 0) ioctl(g_tty, KDSETMODE, KD_GRAPHICS);
    return 0;
}

void fb_close(void) {
    if (g_back) { free(g_back); g_back = NULL; }
    if (g_fb && g_fb != MAP_FAILED) { memset(g_fb, 0, g_size); munmap(g_fb, g_size); g_fb = NULL; }
    if (g_tty >= 0) { ioctl(g_tty, KDSETMODE, KD_TEXT); close(g_tty); g_tty = -1; }
    if (g_fd >= 0) { close(g_fd); g_fd = -1; }
}
