/*
 * main.c — CyberDeck native-fb (Tranche A): shell gráfico no /dev/fb0 que espelha
 * a web-vanilla, consumindo o cyberdeck-agent por HTTP. Ver docs/interface/FEATURES.md.
 *
 * Loop: poll de input (joypad) -> navegação; poll de /api/status a cada 2 s;
 * render do frame no backbuffer -> blit (double buffer). L2+R2 = screenshot, F5 sai.
 *
 * Cross-compile: aarch64-linux-gnu-gcc -O2 -static (ver build.sh / Makefile).
 */
#include <stdlib.h>
#include <signal.h>
#include <time.h>

#include "fb.h"
#include "ui.h"
#include "input.h"
#include "http.h"
#include "views.h"

static volatile int g_sig = 0;
static void on_sig(int s) { (void)s; g_sig = 1; }

static long now_ms(void) {
    struct timespec ts; clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * 1000L + ts.tv_nsec / 1000000L;
}

int main(int argc, char **argv) {
    int port = (argc > 1) ? atoi(argv[1]) : 8080;
    signal(SIGINT, on_sig); signal(SIGTERM, on_sig); signal(SIGPIPE, SIG_IGN);

    if (fb_init() != 0) return 1;
    ui_init();
    http_init(port);
    input_open();           /* sem joypad ainda funciona (só não navega) */
    view_init();

    long last_poll = 0;
    int combo = 0;

    while (view_running() && !g_sig) {
        long t = now_ms();
        if (t - last_poll > 2000) { view_tick(); last_poll = t; }

        cd_event ev;
        if (input_next(&ev, 200) && ev.value == 1) {
            if (input_pressed(CDB_L2) && input_pressed(CDB_R2)) {
                if (!combo) { combo = 1; view_screenshot(); }
            } else {
                view_handle(&ev);
            }
        }
        if (!(input_pressed(CDB_L2) && input_pressed(CDB_R2))) combo = 0;

        view_render();
        fb_present();
    }

    fb_close();
    input_close();
    return 0;
}
