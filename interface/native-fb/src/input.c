/* input.c — joypad odroidgo3 via /dev/input/event*. Ver input.h.
 * Códigos CONFIRMADOS na captura (event1) e no DTB — ver docs/hardware/input-buttons.md. */
#include <stdio.h>
#include <string.h>
#include <fcntl.h>
#include <unistd.h>
#include <poll.h>
#include <dirent.h>
#include <linux/input.h>

#include "input.h"

/* códigos crus do odroidgo3-joypad (prefixo p/ não colidir com input.h) */
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
#define JOY_SELECT 0x13a
#define JOY_START  0x13b
#define JOY_FN     0x2c0
#define JOY_F5     0x2c4

#define MAX_EV 16
static int ev_fds[MAX_EV];
static int ev_n = 0;
static unsigned char st[CDB_COUNT];   /* estado pressionado por botão lógico */

static int map_code(int code) {
    switch (code) {
        case JOY_UP: return CDB_UP;       case JOY_DOWN: return CDB_DOWN;
        case JOY_LEFT: return CDB_LEFT;   case JOY_RIGHT: return CDB_RIGHT;
        case JOY_A: return CDB_A;         case JOY_B: return CDB_B;
        case JOY_X: return CDB_X;         case JOY_Y: return CDB_Y;
        case JOY_L1: return CDB_L1;       case JOY_R1: return CDB_R1;
        case JOY_L2: return CDB_L2;       case JOY_R2: return CDB_R2;
        case JOY_SELECT: return CDB_SELECT; case JOY_START: return CDB_START;
        case JOY_FN: return CDB_FN;       case JOY_F5: return CDB_F5;
        default: return CDB_NONE;
    }
}

int input_open(void) {
    DIR *d = opendir("/dev/input");
    if (!d) return -1;
    struct dirent *e;
    while ((e = readdir(d)) && ev_n < MAX_EV) {
        if (strncmp(e->d_name, "event", 5)) continue;
        char p[64]; snprintf(p, sizeof p, "/dev/input/%s", e->d_name);
        int fd = open(p, O_RDONLY | O_NONBLOCK);
        if (fd >= 0) ev_fds[ev_n++] = fd;
    }
    closedir(d);
    memset(st, 0, sizeof st);
    return ev_n > 0 ? 0 : -1;
}

void input_close(void) {
    for (int i = 0; i < ev_n; i++) close(ev_fds[i]);
    ev_n = 0;
}

int input_pressed(int btn) { return (btn > 0 && btn < CDB_COUNT) ? st[btn] : 0; }

int input_next(cd_event *ev, int timeout_ms) {
    struct pollfd pfd[MAX_EV];
    for (int i = 0; i < ev_n; i++) { pfd[i].fd = ev_fds[i]; pfd[i].events = POLLIN; pfd[i].revents = 0; }
    if (poll(pfd, ev_n, timeout_ms) <= 0) return 0;
    for (int i = 0; i < ev_n; i++) {
        if (!(pfd[i].revents & POLLIN)) continue;
        struct input_event ie;
        while (read(ev_fds[i], &ie, sizeof ie) == (ssize_t)sizeof ie) {
            if (ie.type != EV_KEY) continue;
            int b = map_code(ie.code);
            if (b == CDB_NONE) continue;
            if (ie.value == 1 || ie.value == 0) st[b] = (unsigned char)ie.value;
            ev->btn = b; ev->value = ie.value;
            return 1;   /* devolve um evento por chamada; o resto fica no buffer p/ a próxima */
        }
    }
    return 0;
}

const char *btn_name(int btn) {
    switch (btn) {
        /* fonte é ASCII 32..126: setas viram rótulos ASCII */
        case CDB_UP: return "UP"; case CDB_DOWN: return "DN";
        case CDB_LEFT: return "LF"; case CDB_RIGHT: return "RT";
        case CDB_A: return "A"; case CDB_B: return "B"; case CDB_X: return "X"; case CDB_Y: return "Y";
        case CDB_L1: return "L1"; case CDB_R1: return "R1"; case CDB_L2: return "L2"; case CDB_R2: return "R2";
        case CDB_FN: return "FN"; case CDB_START: return "Start"; case CDB_SELECT: return "Select";
        case CDB_F5: return "F5";
        default: return "?";
    }
}
