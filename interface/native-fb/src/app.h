/* app.h — estado compartilhado, paleta e layout do CyberDeck native-fb.
 * Paleta e tokens espelham docs/interface/FEATURES.md §2 (paridade visual). */
#ifndef CD_APP_H
#define CD_APP_H

#include "fb.h"

/* ---- paleta (packed no formato do fb; preenchida em ui_init) ---- */
typedef struct {
    unsigned long bg, bg2, panel, fg, fg_dim, muted, accent, warn, crit,
                  line, line2, white, sel_bg, sel_fg,
                  btn_a, btn_b, btn_x, btn_y;
} cd_palette;
extern cd_palette PAL;

/* ---- layout (px) ---- */
#define UI_TOPBAR_H  20
#define UI_TABS_H    22
#define UI_FOOTER_H  20
#define UI_CONTENT_Y (UI_TOPBAR_H + UI_TABS_H + 2)        /* 44 */
#define UI_PAD       8
#define ROWH         18                                    /* altura de linha de lista/kv */

/* níveis de severidade (ok/warn/crit) */
enum { LVL_OK = 0, LVL_WARN = 1, LVL_CRIT = 2 };

/* ---- snapshot de /api/status (poll 2s) ---- */
typedef struct {
    int    valid;
    char   host[48];
    char   ip[40]; int has_ip;
    double cpu; int has_cpu;
    double mem_pct; int mem_used, mem_total; int has_mem;
    double load1; int cores;
    double uptime;
    int    temp;            /* °C, -1 = n/a */
    int    bat_pct, bat_est, bat_ac, bat_trust_low; double bat_volt; double bat_ocv; int bat_curr;
    char   bat_status[24];
    int    bright_pct, bright_cur, bright_max;
} cd_status;
extern cd_status STATUS;

extern int AGENT_OK;        /* última chamada ao agente teve sucesso? */

#endif
