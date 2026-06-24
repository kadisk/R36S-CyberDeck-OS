/* fb.h — framebuffer 2D do CyberDeck native-fb (com double buffer).
 * Desenho vai p/ um backbuffer offscreen; fb_present() faz o blit p/ /dev/fb0
 * (elimina flicker do render por software no RK3326). Geometria/bpp em runtime. */
#ifndef CD_FB_H
#define CD_FB_H

#define FB_FONT_W 8
#define FB_FONT_H 16

/* abre /dev/fb0, mmap, aloca backbuffer e põe o tty1 em modo gráfico. 0=ok */
int  fb_init(void);
void fb_close(void);

int  fb_w(void);
int  fb_h(void);

/* empacota um RGB no formato do framebuffer (16/32 bpp) */
unsigned long fb_pack(int r, int g, int b);

/* primitivas (escrevem no backbuffer) */
void fb_clear(unsigned long c);
void fb_fill(int x, int y, int w, int h, unsigned long c);
void fb_pixel(int x, int y, unsigned long c);
void fb_char(int x, int y, char ch, unsigned long fg, unsigned long bg, int show_bg);
void fb_text(int x, int y, const char *s, unsigned long fg, unsigned long bg, int show_bg);
/* texto truncado em max_chars (com reticências) — útil em colunas */
void fb_text_clip(int x, int y, const char *s, int max_chars, unsigned long fg, unsigned long bg, int show_bg);

int  fb_text_w(const char *s);   /* largura em px = strlen*FB_FONT_W */

/* texto ampliado por fator inteiro (cada pixel = bloco scale×scale) */
void fb_char_scaled(int x, int y, char ch, unsigned long fg, unsigned long bg, int show_bg, int scale);
void fb_text_scaled(int x, int y, const char *s, unsigned long fg, unsigned long bg, int show_bg, int scale);
int  fb_text_w_scaled(const char *s, int scale);

/* blit do backbuffer p/ o /dev/fb0 (uma vez por frame) */
void fb_present(void);

#endif
