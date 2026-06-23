/*
 * chooser.c — seletor de interface no boot do R36S CyberDeck OS.
 * Desenha duas opções (WEB / NATIVE) no /dev/fb0, navega pelo joypad, confirma com
 * A/Start e tem timeout (~6 s) que cai na ÚLTIMA escolha. Persiste em
 * /var/lib/cyberdeck/interface (texto: "web" | "fb") e imprime a escolha no stdout —
 * o cyberdeck-session.sh lê o stdout e lança a interface escolhida.
 *
 * Autocontido: linka só fb.c + input.c (sem http/views/cjson).
 * Cross-compile: ver interface/native-fb/build.sh (binário cyberdeck-chooser).
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <time.h>
#include <sys/stat.h>

#include "fb.h"
#include "input.h"

#define PREF_DIR  "/var/lib/cyberdeck"
#define PREF_FILE "/var/lib/cyberdeck/interface"
#define TIMEOUT_S 6

static int read_pref(void) {   /* 0 = web, 1 = fb */
    FILE *f = fopen(PREF_FILE, "r");
    if (!f) return 0;
    char b[16] = {0}; if (!fgets(b, sizeof b, f)) b[0] = 0; fclose(f);
    return strncmp(b, "fb", 2) == 0 ? 1 : 0;
}
static void write_pref(int sel) {
    mkdir(PREF_DIR, 0755);
    FILE *f = fopen(PREF_FILE, "w");
    if (f) { fputs(sel ? "fb\n" : "web\n", f); fclose(f); }
}

int main(void) {
    if (fb_init() != 0) { printf("web\n"); return 0; }   /* sem fb: cai no default web */
    input_open();

    unsigned long BG   = fb_pack(0x06, 0x10, 0x0a);
    unsigned long FG   = fb_pack(0x4d, 0xff, 0x9e);
    unsigned long DIM  = fb_pack(0x2a, 0xa8, 0x69);
    unsigned long MUT  = fb_pack(0x1a, 0x6b, 0x44);
    unsigned long ACC  = fb_pack(0x00, 0xe0, 0xff);
    unsigned long SELBG = fb_pack(0x4d, 0xff, 0x9e);
    unsigned long SELFG = fb_pack(0x06, 0x10, 0x0a);
    unsigned long LINE = fb_pack(0x15, 0x4a, 0x30);

    int sel = read_pref();          /* começa na última escolha */
    int W = fb_w(), H = fb_h();
    long start = time(NULL);
    int confirmed = -1;

    const char *NAMES[2] = { "WEB", "NATIVE" };
    const char *SUBS[2]  = { "HTML / Chromium", "C / framebuffer" };

    while (confirmed < 0) {
        long elapsed = time(NULL) - start;
        int remain = TIMEOUT_S - (int)elapsed;
        if (remain <= 0) { confirmed = sel; break; }

        fb_clear(BG);
        /* título */
        const char *t1 = "R36S // CYBERDECK OS";
        fb_text((W - fb_text_w(t1)) / 2, 70, t1, ACC, BG, 0);
        const char *t2 = "escolha a interface";
        fb_text((W - fb_text_w(t2)) / 2, 110, t2, DIM, BG, 0);

        /* dois cards lado a lado */
        int cw = 220, ch = 120, gap = 40;
        int total = cw * 2 + gap, x0 = (W - total) / 2, y0 = 180;
        for (int i = 0; i < 2; i++) {
            int x = x0 + i * (cw + gap);
            int on = (i == sel);
            fb_fill(x, y0, cw, ch, on ? SELBG : BG);
            /* borda */
            fb_fill(x, y0, cw, 2, on ? SELBG : LINE);
            fb_fill(x, y0 + ch - 2, cw, 2, on ? SELBG : LINE);
            fb_fill(x, y0, 2, ch, on ? SELBG : LINE);
            fb_fill(x + cw - 2, y0, 2, ch, on ? SELBG : LINE);
            unsigned long namec = on ? SELFG : FG;
            unsigned long subc  = on ? SELFG : MUT;
            fb_text(x + (cw - fb_text_w(NAMES[i])) / 2, y0 + 38, NAMES[i], namec, on ? SELBG : BG, 0);
            fb_text(x + (cw - fb_text_w(SUBS[i])) / 2, y0 + 70, SUBS[i], subc, on ? SELBG : BG, 0);
        }

        /* rodapé: controles + contagem */
        const char *hint = "<- ->: mover    A/Start: confirmar";
        fb_text((W - fb_text_w(hint)) / 2, 340, hint, DIM, BG, 0);
        char cd[64];
        snprintf(cd, sizeof cd, "iniciando %s em %ds...", NAMES[sel], remain);
        fb_text((W - fb_text_w(cd)) / 2, 372, cd, MUT, BG, 0);

        fb_present();

        cd_event ev;
        if (input_next(&ev, 200) && ev.value == 1) {
            switch (ev.btn) {
                case CDB_LEFT:  sel = 0; start = time(NULL); break;   /* mexer reinicia o timeout */
                case CDB_RIGHT: sel = 1; start = time(NULL); break;
                case CDB_A: case CDB_START: confirmed = sel; break;
                default: break;
            }
        }
    }

    write_pref(confirmed);
    fb_close();
    input_close();
    printf("%s\n", confirmed ? "fb" : "web");
    return 0;
}
