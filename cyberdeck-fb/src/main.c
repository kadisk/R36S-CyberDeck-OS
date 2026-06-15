/*
 * cyberdeck-fb — renderizador 2D no framebuffer para o R36S CyberDeck OS (Fase 3).
 *
 * Desenha uma UI estilo "cyberdeck" direto em /dev/fb0 (sem GL) e navega pelo
 * joypad (odroidgo3-joypad) lendo /dev/input/event*. Detecta geometria/bpp em
 * tempo de execução (16/32 bpp). Precursor nativo da UI HTML/JS.
 *
 * Cross-compile: aarch64-linux-gnu-gcc -O2 -static -o cyberdeck-fb src/main.c
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <fcntl.h>
#include <unistd.h>
#include <time.h>
#include <poll.h>
#include <dirent.h>
#include <signal.h>
#include <sys/mman.h>
#include <sys/ioctl.h>
#include <linux/fb.h>
#include <linux/input.h>
#include <linux/kd.h>

#include "font8x16.h"

/* Códigos do odroidgo3-joypad — CONFIRMADOS na captura (event1) e no DTB.
 * Ver docs/hardware/input-buttons.md. (Prefixo JOY_ p/ não colidir com input.h) */
#define JOY_UP     0x220
#define JOY_DOWN   0x221
#define JOY_LEFT   0x222
#define JOY_RIGHT  0x223
#define JOY_A      0x131   /* rótulo "A" no aparelho */
#define JOY_B      0x130   /* rótulo "B" */
#define JOY_X      0x133
#define JOY_Y      0x134
#define JOY_L1     0x136
#define JOY_R1     0x137
#define JOY_L2     0x138
#define JOY_R2     0x139
#define JOY_F1     0x2c0
#define JOY_F5     0x2c4   /* usado p/ sair (F6/0x2c5 não existe neste joypad) */

static unsigned char *fbmem = NULL;
static struct fb_var_screeninfo vi;
static struct fb_fix_screeninfo fi;
static long screensize = 0;
static int fbfd = -1;

/* ----- framebuffer ----- */
static unsigned long pack(int r, int g, int b) {
    return ((unsigned long)(r >> (8 - vi.red.length))   << vi.red.offset)
         | ((unsigned long)(g >> (8 - vi.green.length)) << vi.green.offset)
         | ((unsigned long)(b >> (8 - vi.blue.length))  << vi.blue.offset);
}
static void put_px(int x, int y, unsigned long c) {
    if (x < 0 || y < 0 || x >= (int)vi.xres || y >= (int)vi.yres) return;
    long off = (long)y * fi.line_length + (long)x * (vi.bits_per_pixel / 8);
    if (vi.bits_per_pixel == 16) { *(uint16_t *)(fbmem + off) = (uint16_t)c; }
    else                         { *(uint32_t *)(fbmem + off) = (uint32_t)c; }
}
static void fill(int x, int y, int w, int h, unsigned long c) {
    for (int j = 0; j < h; j++) for (int i = 0; i < w; i++) put_px(x + i, y + j, c);
}
static void draw_char(int x, int y, char ch, unsigned long fg, unsigned long bg, int show_bg) {
    if (ch < FONT_FIRST || ch > FONT_LAST) ch = '?';
    const unsigned char *g = font8x16[(int)ch - FONT_FIRST];
    for (int row = 0; row < FONT_H; row++)
        for (int col = 0; col < FONT_W; col++) {
            if (g[row] & (0x80 >> col)) put_px(x + col, y + row, fg);
            else if (show_bg)           put_px(x + col, y + row, bg);
        }
}
static void draw_text(int x, int y, const char *s, unsigned long fg, unsigned long bg, int show_bg) {
    for (; *s; s++, x += FONT_W) draw_char(x, y, *s, fg, bg, show_bg);
}

/* ----- dados do sistema ----- */
static void read_first_line(const char *path, char *buf, int n) {
    buf[0] = 0;
    FILE *f = fopen(path, "r");
    if (!f) return;
    if (fgets(buf, n, f)) { char *nl = strchr(buf, '\n'); if (nl) *nl = 0; }
    fclose(f);
}
static long meminfo_kb(const char *key) {
    FILE *f = fopen("/proc/meminfo", "r"); if (!f) return -1;
    char line[128]; long v = -1;
    while (fgets(line, sizeof line, f)) {
        if (!strncmp(line, key, strlen(key))) { sscanf(line + strlen(key), " %ld", &v); break; }
    }
    fclose(f); return v;
}
static int cpu_count(void) {
    FILE *f = fopen("/proc/cpuinfo", "r"); if (!f) return 0;
    char line[256]; int n = 0;
    while (fgets(line, sizeof line, f)) if (!strncmp(line, "processor", 9)) n++;
    fclose(f); return n;
}

/* ----- input ----- */
#define MAX_EV 16
static int ev_fds[MAX_EV]; static int ev_n = 0;
static void open_inputs(void) {
    DIR *d = opendir("/dev/input"); if (!d) return;
    struct dirent *e;
    while ((e = readdir(d)) && ev_n < MAX_EV) {
        if (strncmp(e->d_name, "event", 5)) continue;
        char p[64]; snprintf(p, sizeof p, "/dev/input/%s", e->d_name);
        int fd = open(p, O_RDONLY | O_NONBLOCK);
        if (fd >= 0) ev_fds[ev_n++] = fd;
    }
    closedir(d);
}

/* ----- UI ----- */
static const char *ITEMS[] = {
    "STATUS", "REDE", "TERMINAL", "LOGS", "FERRAMENTAS", "DEVICE"
};
#define NITEMS (int)(sizeof(ITEMS)/sizeof(ITEMS[0]))

static volatile int running = 1;
static void on_sig(int s) { (void)s; running = 0; }

int main(void) {
    fbfd = open("/dev/fb0", O_RDWR);
    if (fbfd < 0) { perror("open /dev/fb0"); return 1; }
    if (ioctl(fbfd, FBIOGET_FSCREENINFO, &fi) || ioctl(fbfd, FBIOGET_VSCREENINFO, &vi)) {
        perror("ioctl fbinfo"); return 1;
    }
    screensize = (long)fi.line_length * vi.yres;
    fbmem = mmap(NULL, screensize, PROT_READ | PROT_WRITE, MAP_SHARED, fbfd, 0);
    if (fbmem == MAP_FAILED) { perror("mmap"); return 1; }

    signal(SIGINT, on_sig); signal(SIGTERM, on_sig);
    open_inputs();

    /* Põe o tty1 em modo gráfico p/ o fbcon não desenhar por cima da UI. */
    int tty = open("/dev/tty1", O_RDWR);
    if (tty >= 0) ioctl(tty, KDSETMODE, KD_GRAPHICS);

    unsigned long BG    = pack(7, 16, 11);
    unsigned long FG    = pack(77, 255, 158);
    unsigned long DIM   = pack(31, 156, 94);
    unsigned long ACC   = pack(0, 224, 255);
    unsigned long SELBG = pack(77, 255, 158);
    unsigned long SELFG = pack(7, 16, 11);

    char model[128]; read_first_line("/proc/device-tree/model", model, sizeof model);
    if (!model[0]) strcpy(model, "Rockchip RK3326");
    int ncpu = cpu_count();

    int sel = 0;
    char last_codes[8][48]; int lc = 0;
    memset(last_codes, 0, sizeof last_codes);

    while (running) {
        /* --- render --- */
        fill(0, 0, vi.xres, vi.yres, BG);
        fill(0, 0, vi.xres, 22, pack(12, 26, 18));
        draw_text(8, 3, "R36S // CYBERDECK", ACC, BG, 0);
        /* relógio */
        time_t t = time(NULL); struct tm *tm = localtime(&t);
        char clk[16]; strftime(clk, sizeof clk, "%H:%M:%S", tm);
        draw_text(vi.xres - 8 - 8 * (int)strlen(clk), 3, clk, DIM, BG, 0);

        /* menu lateral */
        int my = 34;
        for (int i = 0; i < NITEMS; i++) {
            int y = my + i * 20;
            if (i == sel) { fill(6, y - 2, 150, 19, SELBG); draw_text(12, y, ITEMS[i], SELFG, SELBG, 0); }
            else          draw_text(12, y, ITEMS[i], FG, BG, 0);
        }

        /* painel de conteúdo */
        int px = 170, py = 34, line = py;
        char buf[160];
        draw_text(px, line, ITEMS[sel], ACC, BG, 0); line += 24;
        if (sel == 0) { /* STATUS */
            long mt = meminfo_kb("MemTotal:"), ma = meminfo_kb("MemAvailable:");
            char up[64]; read_first_line("/proc/uptime", up, sizeof up);
            double upt = atof(up);
            snprintf(buf, sizeof buf, "CPU : %d nucleos (Cortex-A35)", ncpu); draw_text(px, line, buf, FG, BG, 0); line += 18;
            if (mt > 0) { snprintf(buf, sizeof buf, "RAM : %ld/%ld MB livres", ma/1024, mt/1024); draw_text(px, line, buf, FG, BG, 0); line += 18; }
            snprintf(buf, sizeof buf, "UP  : %d s", (int)upt); draw_text(px, line, buf, FG, BG, 0); line += 18;
            snprintf(buf, sizeof buf, "HORA: %s", clk); draw_text(px, line, buf, FG, BG, 0); line += 18;
        } else if (sel == NITEMS - 1) { /* DEVICE */
            snprintf(buf, sizeof buf, "MODELO: %.20s", model); draw_text(px, line, buf, FG, BG, 0); line += 18;
            snprintf(buf, sizeof buf, "TELA  : %ux%u %ubpp", vi.xres, vi.yres, vi.bits_per_pixel); draw_text(px, line, buf, FG, BG, 0); line += 18;
            draw_text(px, line, "SoC   : Rockchip RK3326", FG, BG, 0); line += 18;
            draw_text(px, line, "GPU   : Mali-G31", FG, BG, 0); line += 18;
        } else {
            draw_text(px, line, "(em construcao - Fase 3)", DIM, BG, 0); line += 18;
        }

        /* área de debug: últimos códigos de botão lidos (confirma o mapa do joypad) */
        int dy = vi.yres - 22 - 8 * 12;
        draw_text(px, dy, "INPUT (codigos):", DIM, BG, 0); dy += 16;
        for (int i = 0; i < lc; i++) { draw_text(px, dy, last_codes[i], FG, BG, 0); dy += 14; }

        /* rodapé */
        fill(0, vi.yres - 20, vi.xres, 20, pack(12, 26, 18));
        draw_text(8, vi.yres - 17, "D-PAD: mover  A: ok  B: voltar  F6: sair", DIM, BG, 0);

        /* --- input (espera ate 500ms p/ atualizar o relogio) --- */
        struct pollfd pfd[MAX_EV];
        for (int i = 0; i < ev_n; i++) { pfd[i].fd = ev_fds[i]; pfd[i].events = POLLIN; }
        int pr = poll(pfd, ev_n, 500);
        if (pr > 0) {
            for (int i = 0; i < ev_n; i++) {
                if (!(pfd[i].revents & POLLIN)) continue;
                struct input_event ev; ssize_t r;
                while ((r = read(ev_fds[i], &ev, sizeof ev)) == sizeof ev) {
                    if (ev.type != EV_KEY || ev.value != 1) continue;
                    /* registra código p/ depuração do mapa */
                    char line2[48]; snprintf(line2, sizeof line2, "type=%u code=0x%x", ev.type, ev.code);
                    for (int k = 7; k > 0; k--) strcpy(last_codes[k], last_codes[k-1]);
                    strcpy(last_codes[0], line2); if (lc < 8) lc++;
                    switch (ev.code) {
                        case JOY_UP:   sel = (sel - 1 + NITEMS) % NITEMS; break;
                        case JOY_DOWN: sel = (sel + 1) % NITEMS; break;
                        case JOY_L1:   sel = (sel - 1 + NITEMS) % NITEMS; break;
                        case JOY_R1:   sel = (sel + 1) % NITEMS; break;
                        case JOY_F5:   running = 0; break;
                        default: break;
                    }
                }
            }
        }
    }

    /* limpa a tela e restaura o modo texto ao sair */
    if (fbmem && fbmem != MAP_FAILED) { memset(fbmem, 0, screensize); munmap(fbmem, screensize); }
    if (tty >= 0) { ioctl(tty, KDSETMODE, KD_TEXT); close(tty); }
    if (fbfd >= 0) close(fbfd);
    for (int i = 0; i < ev_n; i++) close(ev_fds[i]);
    printf("cyberdeck-fb: saiu\n");
    return 0;
}
