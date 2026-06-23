/* ui.c — casca + helpers de render. Ver ui.h. */
#include <stdio.h>
#include <string.h>
#include <time.h>

#include "ui.h"
#include "fb.h"

cd_palette PAL;

void ui_init(void) {
    PAL.bg     = fb_pack(0x06, 0x10, 0x0a);
    PAL.bg2    = fb_pack(0x0a, 0x18, 0x10);
    PAL.panel  = fb_pack(0x0b, 0x1a, 0x12);
    PAL.fg     = fb_pack(0x4d, 0xff, 0x9e);
    PAL.fg_dim = fb_pack(0x2a, 0xa8, 0x69);
    PAL.muted  = fb_pack(0x1a, 0x6b, 0x44);
    PAL.accent = fb_pack(0x00, 0xe0, 0xff);
    PAL.warn   = fb_pack(0xff, 0xd2, 0x3d);
    PAL.crit   = fb_pack(0xff, 0x55, 0x66);
    PAL.line   = fb_pack(0x15, 0x4a, 0x30);
    PAL.line2  = fb_pack(0x0f, 0x32, 0x20);
    PAL.white  = fb_pack(0xff, 0xff, 0xff);
    PAL.sel_bg = fb_pack(0x4d, 0xff, 0x9e);
    PAL.sel_fg = fb_pack(0x06, 0x10, 0x0a);
    PAL.btn_a  = fb_pack(0xff, 0x55, 0x66);
    PAL.btn_b  = fb_pack(0xff, 0xd2, 0x3d);
    PAL.btn_x  = fb_pack(0x5b, 0x8c, 0xff);
    PAL.btn_y  = fb_pack(0x4d, 0xff, 0x9e);
}

unsigned long ui_btn_color(const char *name) {
    if (!strcmp(name, "A")) return PAL.btn_a;
    if (!strcmp(name, "B")) return PAL.btn_b;
    if (!strcmp(name, "X")) return PAL.btn_x;
    if (!strcmp(name, "Y")) return PAL.btn_y;
    return PAL.white;
}

unsigned long ui_sev_color(int level) {
    return level == LVL_CRIT ? PAL.crit : level == LVL_WARN ? PAL.warn : PAL.fg;
}

/* ---- hint c/ tokens de botão coloridos ---- */
static int is_btn_token(const char *t) {
    static const char *toks[] = { "A","B","X","Y","L1","R1","L2","R2","FN","Start","Select", NULL };
    for (int i = 0; toks[i]; i++) if (!strcmp(t, toks[i])) return 1;
    return 0;
}
void ui_hint(int x, int y, const char *s) {
    char word[24]; int wl = 0;
    for (const char *p = s; ; p++) {
        if (*p && *p != ' ') { if (wl < (int)sizeof word - 1) word[wl++] = *p; continue; }
        word[wl] = 0;
        if (wl) {
            unsigned long c = is_btn_token(word) ? ui_btn_color(word) : PAL.fg_dim;
            fb_text(x, y, word, c, PAL.bg, 0); x += wl * FB_FONT_W;
        }
        if (!*p) break;
        fb_char(x, y, ' ', PAL.fg_dim, PAL.bg, 0); x += FB_FONT_W; wl = 0;
    }
}

/* ---- chrome ---- */
void ui_topbar(void) {
    int W = fb_w();
    fb_fill(0, 0, W, UI_TOPBAR_H, PAL.panel);
    fb_fill(0, UI_TOPBAR_H, W, 1, PAL.line);
    fb_text(UI_PAD, 2, "R36S//CYBERDECK", PAL.accent, PAL.panel, 0);

    /* relógio à direita */
    time_t t = time(NULL); struct tm *tm = localtime(&t);
    char clk[16]; strftime(clk, sizeof clk, "%H:%M:%S", tm);
    int rx = W - UI_PAD - fb_text_w(clk);
    fb_text(rx, 2, clk, PAL.fg_dim, PAL.panel, 0);

    /* bateria/temp/load à esquerda do relógio */
    char seg[64];
    int bpct = STATUS.bat_trust_low && STATUS.bat_est >= 0 ? STATUS.bat_est
               : (STATUS.bat_pct >= 0 ? STATUS.bat_pct : STATUS.bat_est);
    snprintf(seg, sizeof seg, "BAT %s%d%%%s",
             STATUS.bat_trust_low ? "~" : "", bpct < 0 ? 0 : bpct,
             STATUS.bat_ac == 1 ? " AC" : "");
    unsigned long bc = (STATUS.bat_ac != 1 && bpct >= 0 && bpct < 10) ? PAL.crit
                       : (STATUS.bat_ac != 1 && bpct >= 0 && bpct < 25) ? PAL.warn : PAL.fg_dim;
    rx -= UI_PAD + fb_text_w(seg); fb_text(rx, 2, seg, bc, PAL.panel, 0);

    if (STATUS.temp >= 0) {
        snprintf(seg, sizeof seg, "%dC", STATUS.temp);
        unsigned long tc = STATUS.temp >= 80 ? PAL.crit : STATUS.temp >= 65 ? PAL.warn : PAL.fg_dim;
        rx -= UI_PAD + fb_text_w(seg); fb_text(rx, 2, seg, tc, PAL.panel, 0);
    }

    /* host/ip à esquerda */
    int lx = UI_PAD + fb_text_w("R36S//CYBERDECK") + UI_PAD;
    snprintf(seg, sizeof seg, "%s", STATUS.host[0] ? STATUS.host : "host -");
    fb_text(lx, 2, seg, PAL.fg_dim, PAL.panel, 0); lx += fb_text_w(seg) + UI_PAD;
    if (STATUS.has_ip) fb_text(lx, 2, STATUS.ip, PAL.fg_dim, PAL.panel, 0);
    else               fb_text(lx, 2, "NET OFF", PAL.warn, PAL.panel, 0);

    if (!AGENT_OK) fb_text(lx, 2, "AGENTE OFF", PAL.crit, PAL.panel, 0);
}

void ui_tabs(int active) {
    int W = fb_w(), y = UI_TOPBAR_H + 1;
    fb_fill(0, y, W, UI_TABS_H, PAL.bg2);
    fb_fill(0, y + UI_TABS_H, W, 1, PAL.line);
    extern const char *const TAB_TITLES[]; extern int TAB_COUNT;
    int n = TAB_COUNT, cw = W / (n ? n : 1);
    for (int i = 0; i < n; i++) {
        int tx = i * cw;
        if (i == active) {
            fb_fill(tx, y, cw, UI_TABS_H, PAL.line2);
            fb_fill(tx, y + UI_TABS_H - 2, cw, 2, PAL.accent);
        }
        unsigned long c = (i == active) ? PAL.accent : PAL.fg_dim;
        int len = (int)strlen(TAB_TITLES[i]);
        int txt = tx + (cw - len * FB_FONT_W) / 2; if (txt < tx + 1) txt = tx + 1;
        fb_text_clip(txt, y + 3, TAB_TITLES[i], cw / FB_FONT_W, c, PAL.bg2, 0);
        if (i) fb_fill(tx, y, 1, UI_TABS_H, PAL.line2);
    }
}

void ui_footer(const char *hint) {
    int W = fb_w(), H = fb_h(), y = H - UI_FOOTER_H;
    fb_fill(0, y, W, UI_FOOTER_H, PAL.panel);
    fb_fill(0, y - 1, W, 1, PAL.line);
    ui_hint(UI_PAD, y + 2, hint ? hint : "");
    const char *ag = AGENT_OK ? "agente ON" : "agente OFF";
    fb_text(W - UI_PAD - fb_text_w(ag), y + 2, ag, AGENT_OK ? PAL.fg_dim : PAL.crit, PAL.panel, 0);
}

/* ---- helpers ---- */
void ui_title(int x, int y, const char *s) { fb_text(x, y, s, PAL.accent, PAL.bg, 0); }

int ui_kv(int x, int y, int w, const char *label, const char *value) {
    fb_text(x, y, label, PAL.fg_dim, PAL.bg, 0);
    if (!value || !*value) value = "-";
    int vx = x + w - fb_text_w(value);
    int minx = x + fb_text_w(label) + FB_FONT_W;
    if (vx < minx) vx = minx;
    fb_text(vx, y, value, PAL.fg, PAL.bg, 0);
    return y + ROWH;
}

void ui_bar(int x, int y, int w, int h, int pct, unsigned long fg) {
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    fb_fill(x, y, w, h, PAL.line2);
    fb_fill(x, y, w * pct / 100, h, fg);
}

int ui_gauge(int x, int y, int w, const char *label, int pct) {
    fb_text(x, y, label, PAL.fg_dim, PAL.bg, 0);
    char v[8]; snprintf(v, sizeof v, "%d%%", pct < 0 ? 0 : pct);
    fb_text(x + w - fb_text_w(v), y, v, PAL.fg, PAL.bg, 0);
    unsigned long c = pct >= 90 ? PAL.crit : pct >= 70 ? PAL.warn : PAL.fg;
    ui_bar(x, y + FB_FONT_H, w, 6, pct, c);
    return y + FB_FONT_H + 10;
}

void ui_tile(int x, int y, int w, int h, const char *label, const char *value,
             const char *sub, int barpct, int level) {
    fb_fill(x, y, w, h, PAL.panel);
    fb_fill(x, y, w, 1, PAL.line); fb_fill(x, y + h - 1, w, 1, PAL.line);
    fb_fill(x, y, 1, h, PAL.line); fb_fill(x + w - 1, y, 1, h, PAL.line);
    fb_text(x + 5, y + 4, label, PAL.fg_dim, PAL.panel, 0);
    fb_text(x + 5, y + 20, value, ui_sev_color(level), PAL.panel, 0);
    if (barpct >= 0) ui_bar(x + 5, y + h - 9, w - 10, 5, barpct, ui_sev_color(level));
    else if (sub && *sub) fb_text(x + 5, y + h - 16, sub, PAL.muted, PAL.panel, 0);
}

int ui_badge(int x, int y, const char *text, int level) {
    unsigned long c = ui_sev_color(level);
    int w = fb_text_w(text) + 8;
    fb_fill(x, y - 2, w, FB_FONT_H + 3, PAL.line2);
    fb_text(x + 4, y, text, c, PAL.line2, 0);
    return w;
}

void ui_subbar(int x, int y, const char *const *labels, int n, int active) {
    for (int i = 0; i < n; i++) {
        unsigned long c = (i == active) ? PAL.accent : PAL.fg_dim;
        if (i == active) { int w = fb_text_w(labels[i]) + 6; fb_fill(x - 3, y - 2, w, FB_FONT_H + 3, PAL.line2); }
        fb_text(x, y, labels[i], c, (i == active) ? PAL.line2 : PAL.bg, 0);
        x += fb_text_w(labels[i]) + 12;
    }
}

void ui_sparkline(char *out, int outsz, const double *vals, int n) {
    static const char ramp[] = " .:-=+*#%@";
    int rs = (int)sizeof(ramp) - 2;
    if (n <= 0) { snprintf(out, outsz, "-"); return; }
    double mn = vals[0], mx = vals[0];
    for (int i = 1; i < n; i++) { if (vals[i] < mn) mn = vals[i]; if (vals[i] > mx) mx = vals[i]; }
    if (mx <= mn) mx = mn + 1;
    int i, o = 0;
    for (i = 0; i < n && o < outsz - 1; i++) {
        double t = (vals[i] - mn) / (mx - mn); if (t < 0) t = 0; if (t > 1) t = 1;
        out[o++] = ramp[(int)(t * rs + 0.5)];
    }
    out[o] = 0;
}

void ui_confirm(const char *msg) {
    int W = fb_w(), H = fb_h();
    int bw = 420, bh = 130, bx = (W - bw) / 2, by = (H - bh) / 2;
    fb_fill(bx, by, bw, bh, PAL.panel);
    fb_fill(bx, by, bw, 2, PAL.crit); fb_fill(bx, by + bh - 2, bw, 2, PAL.crit);
    fb_fill(bx, by, 2, bh, PAL.crit); fb_fill(bx + bw - 2, by, 2, bh, PAL.crit);
    fb_text(bx + 14, by + 12, "CONFIRMAR ACAO", PAL.warn, PAL.panel, 0);
    fb_text_clip(bx + 14, by + 44, msg ? msg : "", (bw - 28) / FB_FONT_W, PAL.fg, PAL.panel, 0);
    int ly = by + bh - 26;
    fb_text(bx + 14, ly, "A", PAL.btn_a, PAL.panel, 0);
    fb_text(bx + 14 + FB_FONT_W * 2, ly, "confirmar", PAL.fg_dim, PAL.panel, 0);
    int rx = bx + 14 + FB_FONT_W * 13;
    fb_text(rx, ly, "B", PAL.btn_b, PAL.panel, 0);
    fb_text(rx + FB_FONT_W * 2, ly, "cancelar", PAL.fg_dim, PAL.panel, 0);
}

void ui_toast(const char *msg, int is_err) {
    int W = fb_w(), H = fb_h();
    int tw = fb_text_w(msg) + 20, tx = (W - tw) / 2, ty = H - UI_FOOTER_H - 30;
    fb_fill(tx, ty, tw, 22, PAL.line2);
    fb_fill(tx, ty, tw, 2, is_err ? PAL.crit : PAL.accent);
    fb_text(tx + 10, ty + 4, msg, is_err ? PAL.crit : PAL.fg, PAL.line2, 0);
}
