/* views.c — telas + router do native-fb (Tranche A: HOME, STATUS, DEVICE, NET,
 * LOGS, AJUSTES, KEYS + menu FN + confirm). Dados via cyberdeck-agent (HTTP/JSON),
 * espelhando docs/interface/FEATURES.md. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#include "app.h"
#include "ui.h"
#include "fb.h"
#include "http.h"
#include "views.h"
#include "input.h"
#include "cjson/cJSON.h"

/* ---------- estado global ---------- */
cd_status STATUS;
int AGENT_OK = 0;

enum { V_HOME, V_STATUS, V_DEVICE, V_NET, V_LOGS, V_TOOLS, V_KEYS, NVIEWS };

const char *const TAB_TITLES[] = { "HOME", "STATUS", "DEVICE", "NET", "LOGS" };
int TAB_COUNT = 5;

static int g_section = V_HOME;
static int g_sub[NVIEWS];           /* subpágina por view (L1/R1) */
static int g_focus[NVIEWS];         /* item focado por view */
static int g_running = 1;

enum { OV_NONE, OV_FN, OV_CONFIRM };
static int g_overlay = OV_NONE;
static int g_fn_focus = 0;

/* confirmação pendente */
static char g_confirm_key[32];
static char g_confirm_label[80];

/* toast */
static char g_toast[96];
static long g_toast_until = 0;

/* caches por view (cJSON root {ok,data}) */
static cJSON *g_cache[NVIEWS];
static cJSON *g_health = NULL;
static cJSON *g_volume = NULL;

/* histórico p/ sparkline (STATUS · TENDÊNCIA) */
#define HN 60
static double h_cpu[HN], h_ram[HN], h_temp[HN];
static int h_len = 0;

/* subpáginas */
static const char *const SUB_STATUS[] = { "AO VIVO", "ENERGIA", "TENDENCIA" };
static const char *const SUB_DEVICE[] = { "ID", "CPU", "DISPLAY", "BOOT", "INPUT" };
static const char *const SUB_TOOLS[]  = { "DISPLAY", "AUDIO" };
static const char *const LOG_SRC[]    = { "dmesg", "journal", "agent", "kiosk", "ui" };
static const int NSUB[NVIEWS] = { 0, 3, 5, 0, 5, 2, 0 };

/* ---------- helpers de tempo / json ---------- */
static long now_ms(void) {
    struct timespec ts; clock_gettime(CLOCK_MONOTONIC, &ts);
    return ts.tv_sec * 1000L + ts.tv_nsec / 1000000L;
}
static cJSON *J(cJSON *o, const char *k) { return cJSON_GetObjectItemCaseSensitive(o, k); }
static const char *Js(cJSON *o, const char *k, const char *def) {
    cJSON *x = J(o, k); return (x && cJSON_IsString(x) && x->valuestring) ? x->valuestring : def;
}
static double Jn(cJSON *o, const char *k, double def) {
    cJSON *x = J(o, k); return (x && cJSON_IsNumber(x)) ? x->valuedouble : def;
}
static cJSON *api_get(const char *path) {
    char *b = http_get(path);
    if (!b) { AGENT_OK = 0; return NULL; }
    AGENT_OK = 1;
    cJSON *root = cJSON_Parse(b); free(b);
    return root;
}
static cJSON *api_data(cJSON *root) { return root ? J(root, "data") : NULL; }

static void set_toast(const char *msg, int err) {
    snprintf(g_toast, sizeof g_toast, "%s", msg ? msg : "");
    g_toast_until = now_ms() + 2600;
    (void)err;
}
static void post_action(const char *key) {
    char body[64]; snprintf(body, sizeof body, "{\"key\":\"%s\"}", key);
    char *r = http_post("/api/actions", body);
    if (!r) { AGENT_OK = 0; set_toast("agente offline", 1); return; }
    AGENT_OK = 1;
    cJSON *root = cJSON_Parse(r); free(r);
    const char *msg = "ok";
    cJSON *d = api_data(root);
    if (d) msg = Js(d, "msg", "ok");
    set_toast(msg, 0);
    if (root) cJSON_Delete(root);
}

/* ---------- status (poll 2s) ---------- */
static void hist_push(double *arr, double v) {
    if (h_len < HN) { arr[h_len] = v; }
    else { memmove(arr, arr + 1, (HN - 1) * sizeof(double)); arr[HN - 1] = v; }
}
void view_refresh_status(void) {
    cJSON *root = api_get("/api/status");
    cJSON *d = api_data(root);
    if (!d) { STATUS.valid = 0; if (root) cJSON_Delete(root); return; }
    STATUS.valid = 1;
    snprintf(STATUS.host, sizeof STATUS.host, "%s", Js(d, "host", "r36s"));
    STATUS.cpu = Jn(d, "cpu", -1); STATUS.has_cpu = STATUS.cpu >= 0;
    STATUS.cores = (int)Jn(d, "cores", 0);
    STATUS.uptime = Jn(d, "uptime", 0);
    STATUS.temp = (int)Jn(d, "temp", -1);
    cJSON *m = J(d, "mem");
    if (m) { STATUS.mem_pct = Jn(m, "pct", 0); STATUS.mem_used = (int)Jn(m, "used", 0); STATUS.mem_total = (int)Jn(m, "total", 0); STATUS.has_mem = 1; }
    cJSON *la = J(d, "load_arr");
    STATUS.load1 = (la && cJSON_IsArray(la) && cJSON_GetArraySize(la) > 0) ? cJSON_GetArrayItem(la, 0)->valuedouble : -1;
    cJSON *b = J(d, "battery");
    if (b) {
        STATUS.bat_pct = (int)Jn(b, "pct", -1); STATUS.bat_est = (int)Jn(b, "est", -1);
        STATUS.bat_ac = (int)Jn(b, "ac", -1); STATUS.bat_volt = Jn(b, "volt", -1);
        STATUS.bat_ocv = Jn(b, "ocv", -1); STATUS.bat_curr = (int)Jn(b, "curr", 0);
        snprintf(STATUS.bat_status, sizeof STATUS.bat_status, "%s", Js(b, "status", ""));
        STATUS.bat_trust_low = !strcmp(Js(b, "capacity_trust", "ok"), "low");
    }
    cJSON *br = J(d, "brightness");
    if (br) { STATUS.bright_pct = (int)Jn(br, "pct", -1); STATUS.bright_cur = (int)Jn(br, "cur", -1); STATUS.bright_max = (int)Jn(br, "max", -1); }
    cJSON *net = J(d, "net");
    STATUS.has_ip = 0; STATUS.ip[0] = 0;
    if (net && cJSON_IsArray(net) && cJSON_GetArraySize(net) > 0) {
        cJSON *n0 = cJSON_GetArrayItem(net, 0);
        const char *ip = Js(n0, "ip", "");
        if (ip[0]) { snprintf(STATUS.ip, sizeof STATUS.ip, "%s", ip); STATUS.has_ip = 1; }
    }
    if (STATUS.has_cpu) hist_push(h_cpu, STATUS.cpu);
    if (STATUS.has_mem) hist_push(h_ram, STATUS.mem_pct);
    if (STATUS.temp >= 0) hist_push(h_temp, STATUS.temp);
    if (h_len < HN) h_len++;
    if (root) cJSON_Delete(root);
}
static void refresh_health(void) {
    if (g_health) { cJSON_Delete(g_health); g_health = NULL; }
    g_health = api_get("/api/health");
}

/* ---------- enter/leave (cache lazy) ---------- */
static void view_enter(int s) {
    if (g_cache[s]) { cJSON_Delete(g_cache[s]); g_cache[s] = NULL; }
    if (s == V_DEVICE) g_cache[s] = api_get("/api/device");
    else if (s == V_NET) g_cache[s] = api_get("/api/network/summary");
    else if (s == V_LOGS) {
        char p[96]; snprintf(p, sizeof p, "/api/logs?source=%s&lines=120", LOG_SRC[g_sub[V_LOGS]]);
        g_cache[s] = api_get(p);
    } else if (s == V_TOOLS) {
        g_cache[s] = api_get("/api/actions");
        if (g_volume) { cJSON_Delete(g_volume); g_volume = NULL; }
        g_volume = api_get("/api/volume");
    } else if (s == V_HOME) {
        refresh_health();
    }
}

/* ---------- métricas auxiliares ---------- */
static int lvl_temp(int t) { return t < 0 ? LVL_OK : t >= 80 ? LVL_CRIT : t >= 65 ? LVL_WARN : LVL_OK; }
static int lvl_pct(double p) { return p > 90 ? LVL_CRIT : p >= 75 ? LVL_WARN : LVL_OK; }

static int content_x(void) { return UI_PAD; }
static int content_w(void) { return fb_w() - 2 * UI_PAD; }
static int content_y0(void) { return UI_CONTENT_Y + 2; }
static int content_y1(void) { return fb_h() - UI_FOOTER_H - 2; }

/* ---------- VIEW: HOME ---------- */
static void uptime_str(double s, char *out, int n) {
    long t = (long)s, d = t / 86400; t %= 86400; long h = t / 3600; t %= 3600; long m = t / 60;
    if (d) snprintf(out, n, "%ldd %ldh %ldm", d, h, m); else snprintf(out, n, "%ldh %ldm", h, m);
}
static int home_nalert(void) {
    cJSON *d = api_data(g_health); cJSON *it = d ? J(d, "items") : NULL;
    return (it && cJSON_IsArray(it)) ? cJSON_GetArraySize(it) : 0;
}
static void home_render(int focus) {
    int x = content_x(), y = content_y0(), w = content_w();
    cJSON *d = api_data(g_health);
    const char *lvl = d ? Js(d, "level", "ok") : "ok";
    int L = !strcmp(lvl, "crit") ? LVL_CRIT : !strcmp(lvl, "warn") ? LVL_WARN : LVL_OK;
    const char *ltxt = L == LVL_CRIT ? "SYS CRIT" : L == LVL_WARN ? "SYS WARN" : "SYS OK";
    char line[120];
    cJSON *sm = d ? J(d, "summary") : NULL;
    snprintf(line, sizeof line, "%s  agente %s %s%s",
             ltxt, AGENT_OK ? "ON" : "OFF",
             STATUS.has_ip ? "rede " : "sem rede",
             STATUS.has_ip ? STATUS.ip : "");
    fb_text(x, y, line, ui_sev_color(L), PAL.bg, 0); y += ROWH;
    if (sm) {
        const char *sd = Js(sm, "systemd", "?");
        char l2[80]; snprintf(l2, sizeof l2, "systemd %s", sd);
        fb_text(x, y, l2, PAL.muted, PAL.bg, 0); y += ROWH;
    }
    /* alertas (focáveis) */
    int fi = 0;
    cJSON *items = d ? J(d, "items") : NULL;
    if (items && cJSON_IsArray(items)) {
        cJSON *it; cJSON_ArrayForEach(it, items) {
            const char *lab = Js(it, "label", "");
            int sel = (focus == fi);
            char row[120]; snprintf(row, sizeof row, "! %s", lab);
            if (sel) { fb_fill(x - 2, y - 2, w, ROWH, PAL.line2); }
            fb_text_clip(x, y, row, w / FB_FONT_W, PAL.warn, PAL.bg, 0);
            y += ROWH; fi++;
        }
    }
    y += 4;
    /* tiles CPU/RAM/TEMP/BAT */
    int tw = (w - 18) / 4, th = 56;
    char v[24];
    snprintf(v, sizeof v, "%d%%", STATUS.has_cpu ? (int)(STATUS.cpu + 0.5) : 0);
    ui_tile(x + 0 * (tw + 6), y, tw, th, "CPU", v, NULL, STATUS.has_cpu ? (int)STATUS.cpu : -1, lvl_pct(STATUS.cpu));
    snprintf(v, sizeof v, "%d%%", STATUS.has_mem ? (int)(STATUS.mem_pct + 0.5) : 0);
    ui_tile(x + 1 * (tw + 6), y, tw, th, "RAM", v, NULL, STATUS.has_mem ? (int)STATUS.mem_pct : -1, lvl_pct(STATUS.mem_pct));
    if (STATUS.temp >= 0) snprintf(v, sizeof v, "%dC", STATUS.temp); else snprintf(v, sizeof v, "-");
    ui_tile(x + 2 * (tw + 6), y, tw, th, "TEMP", v, lvl_temp(STATUS.temp) == LVL_OK ? "ok" : "alto", -1, lvl_temp(STATUS.temp));
    int bp = STATUS.bat_trust_low && STATUS.bat_est >= 0 ? STATUS.bat_est : STATUS.bat_pct;
    if (STATUS.bat_ac == 1) snprintf(v, sizeof v, "AC"); else if (bp >= 0) snprintf(v, sizeof v, "%d%%", bp); else snprintf(v, sizeof v, "-");
    char bsub[16]; snprintf(bsub, sizeof bsub, "%.2fV", STATUS.bat_volt);
    ui_tile(x + 3 * (tw + 6), y, tw, th, "BAT", v, STATUS.bat_volt > 0 ? bsub : NULL, -1, LVL_OK);
    y += th + 8;

    /* cards de atalho (focáveis após os alertas) */
    static const char *CARDS[] = { "STATUS", "DEVICE", "NET", "LOGS", "AJUSTES" };
    int na = home_nalert();
    for (int i = 0; i < 5; i++) {
        int sel = (focus == na + i);
        int ry = y + i * ROWH;
        if (ry + ROWH > content_y1()) break;
        if (sel) fb_fill(x - 2, ry - 2, w, ROWH, PAL.line2);
        fb_text(x, ry, ">", PAL.accent, PAL.bg, 0);
        fb_text(x + FB_FONT_W * 2, ry, CARDS[i], sel ? PAL.accent : PAL.fg, PAL.bg, 0);
    }
}
static int home_nfocus(void) { return home_nalert() + 5; }
static void home_activate(int focus) {
    int na = home_nalert();
    if (focus < na) {
        cJSON *d = api_data(g_health), *items = d ? J(d, "items") : NULL;
        cJSON *it = items ? cJSON_GetArrayItem(items, focus) : NULL;
        const char *tg = it ? Js(it, "target", "") : "";
        int dst = !strcmp(tg, "systemd") ? -1 : !strcmp(tg, "status") ? V_STATUS : !strcmp(tg, "network") ? V_NET : -1;
        if (dst >= 0) { g_section = dst; view_enter(dst); }
        return;
    }
    int i = focus - na;
    int map[] = { V_STATUS, V_DEVICE, V_NET, V_LOGS, V_TOOLS };
    if (i >= 0 && i < 5) { g_section = map[i]; view_enter(map[i]); g_overlay = OV_NONE; }
}

/* ---------- VIEW: STATUS ---------- */
static void status_render(int focus) {
    (void)focus;
    int x = content_x(), y = content_y0(), w = content_w();
    int sub = g_sub[V_STATUS];
    char t[40]; snprintf(t, sizeof t, "STATUS . %s", SUB_STATUS[sub]);
    ui_title(x, y, t); y += ROWH;
    ui_subbar(x, y, SUB_STATUS, 3, sub); y += ROWH + 2;
    char v[40];
    if (sub == 0) { /* AO VIVO */
        int tw = (w - 18) / 4, th = 52;
        snprintf(v, sizeof v, "%d%%", STATUS.has_cpu ? (int)STATUS.cpu : 0);
        ui_tile(x, y, tw, th, "CPU", v, NULL, STATUS.has_cpu ? (int)STATUS.cpu : -1, lvl_pct(STATUS.cpu));
        snprintf(v, sizeof v, "%d%%", (int)STATUS.mem_pct);
        ui_tile(x + (tw + 6), y, tw, th, "RAM", v, NULL, (int)STATUS.mem_pct, lvl_pct(STATUS.mem_pct));
        if (STATUS.temp >= 0) snprintf(v, sizeof v, "%dC", STATUS.temp); else snprintf(v, sizeof v, "-");
        ui_tile(x + 2 * (tw + 6), y, tw, th, "TEMP", v, NULL, -1, lvl_temp(STATUS.temp));
        snprintf(v, sizeof v, "%.2f", STATUS.load1);
        char ls[16]; snprintf(ls, sizeof ls, "%d cores", STATUS.cores);
        ui_tile(x + 3 * (tw + 6), y, tw, th, "LOAD", v, ls, -1, LVL_OK);
        y += th + 8;
        char mem[40]; snprintf(mem, sizeof mem, "%d / %d MB", STATUS.mem_used, STATUS.mem_total);
        y = ui_kv(x, y, w, "MEM", mem);
        char up[32]; uptime_str(STATUS.uptime, up, sizeof up);
        y = ui_kv(x, y, w, "UPTIME", up);
        y = ui_kv(x, y, w, "REDE", STATUS.has_ip ? STATUS.ip : "sem rede");
    } else if (sub == 1) { /* ENERGIA */
        snprintf(v, sizeof v, "%d%% (%s)", STATUS.bat_est, STATUS.bat_ac == 1 ? "carregando" : "estimado");
        y = ui_kv(x, y, w, "BATERIA", v);
        snprintf(v, sizeof v, "%.2fV  %d mA", STATUS.bat_volt, STATUS.bat_curr);
        y = ui_kv(x, y, w, "TENSAO", v);
        snprintf(v, sizeof v, "%.2fV  %s", STATUS.bat_ocv, STATUS.bat_status);
        y = ui_kv(x, y, w, "OCV", v);
        snprintf(v, sizeof v, "%d%% capacity%s", STATUS.bat_pct, STATUS.bat_trust_low ? " . instavel" : "");
        y = ui_kv(x, y, w, "RAW (rk817)", v);
        if (STATUS.bright_pct >= 0) y = ui_gauge(x, y, w, "BRILHO", STATUS.bright_pct) + 2;
        if (STATUS.temp >= 0) { snprintf(v, sizeof v, "%d C", STATUS.temp); y = ui_kv(x, y, w, "TEMP", v); }
    } else { /* TENDENCIA */
        if (h_len > 1) {
            char sp[HN + 1];
            ui_sparkline(sp, sizeof sp, h_cpu, h_len); y = ui_kv(x, y, w, "CPU", sp);
            ui_sparkline(sp, sizeof sp, h_ram, h_len); y = ui_kv(x, y, w, "RAM", sp);
            if (STATUS.temp >= 0) { ui_sparkline(sp, sizeof sp, h_temp, h_len); y = ui_kv(x, y, w, "TEMP", sp); }
            fb_text(x, y + 4, "tendencia da sessao (~2 min)", PAL.muted, PAL.bg, 0);
        } else {
            fb_text(x, y, "coletando historico...", PAL.muted, PAL.bg, 0);
        }
    }
}

/* ---------- VIEW: DEVICE ---------- */
static void device_render(int focus) {
    (void)focus;
    int x = content_x(), y = content_y0(), w = content_w();
    int sub = g_sub[V_DEVICE];
    char t[40]; snprintf(t, sizeof t, "DEVICE . %s", SUB_DEVICE[sub]);
    ui_title(x, y, t); y += ROWH;
    ui_subbar(x, y, SUB_DEVICE, 5, sub); y += ROWH + 2;
    cJSON *d = api_data(g_cache[V_DEVICE]);
    if (!d) { fb_text(x, y, AGENT_OK ? "carregando..." : "agente offline", PAL.muted, PAL.bg, 0); return; }
    cJSON *id = J(d, "identity"), *hw = J(d, "hardware"), *k = J(d, "kernel"), *dp = J(d, "display"), *ip = J(d, "input");
    char v[64];
    if (sub == 0 && id) {
        y = ui_kv(x, y, w, "HOST", Js(id, "hostname", "-"));
        y = ui_kv(x, y, w, "DISTRO", Js(id, "distro", "-"));
        y = ui_kv(x, y, w, "KERNEL", Js(id, "kernel", "-"));
        y = ui_kv(x, y, w, "ARCH", Js(id, "arch", "-"));
        char up[32]; uptime_str(Jn(id, "uptime_s", 0), up, sizeof up); y = ui_kv(x, y, w, "UPTIME", up);
        y = ui_kv(x, y, w, "TZ", Js(id, "timezone", "-"));
        y = ui_kv(x, y, w, "ROOTFS", Js(id, "rootfs", "-"));
    } else if (sub == 1 && hw) {
        y = ui_kv(x, y, w, "SoC", Js(hw, "soc", "-"));
        snprintf(v, sizeof v, "%d", (int)Jn(hw, "cores", 0)); y = ui_kv(x, y, w, "CORES", v);
        y = ui_kv(x, y, w, "GPU", Js(hw, "gpu", "-"));
        cJSON *mem = J(hw, "mem");
        if (mem) { snprintf(v, sizeof v, "%d MB (livre %d)", (int)Jn(mem, "total_mb", 0), (int)Jn(mem, "available_mb", 0)); y = ui_kv(x, y, w, "RAM", v); }
        cJSON *fr = J(hw, "freq"), *f0 = fr && cJSON_IsArray(fr) ? cJSON_GetArrayItem(fr, 0) : NULL;
        if (f0) { snprintf(v, sizeof v, "%d MHz . %s", (int)Jn(f0, "cur_mhz", 0), Js(f0, "governor", "-")); y = ui_kv(x, y, w, "FREQ0", v); }
    } else if (sub == 2 && dp) {
        cJSON *fb_ = J(dp, "framebuffer"), *bl = J(dp, "backlight");
        if (fb_) { snprintf(v, sizeof v, "%s @%dbpp", Js(fb_, "virtual_size", "-"), (int)Jn(fb_, "bits_per_pixel", 0)); y = ui_kv(x, y, w, "FB", v); }
        if (bl) { snprintf(v, sizeof v, "%d%% (%d/%d)", (int)Jn(bl, "pct", -1), (int)Jn(bl, "cur", 0), (int)Jn(bl, "max", 0)); y = ui_kv(x, y, w, "LUZ", v); }
        y = ui_kv(x, y, w, "PAINEL", Js(dp, "panel", "-"));
    } else if (sub == 3) {
        if (k) {
            y = ui_kv(x, y, w, "VERSION", Js(k, "version", "-"));
            y = ui_kv(x, y, w, "MODELO DT", Js(k, "dtb_model", hw ? Js(hw, "model", "-") : "-"));
            snprintf(v, sizeof v, "%d", (int)Jn(k, "modules_count", 0)); y = ui_kv(x, y, w, "MODULOS", v);
        }
        fb_text(x, y + 4, "detalhes completos em KERNEL (Tranche B)", PAL.muted, PAL.bg, 0);
    } else if (sub == 4 && ip) {
        cJSON *devs = J(ip, "devices"), *dv;
        if (devs) cJSON_ArrayForEach(dv, devs) {
            char lbl[16]; snprintf(lbl, sizeof lbl, "%s%s", (int)Jn(dv, "joypad", 0) ? "* " : "", Js(dv, "event", "?"));
            y = ui_kv(x, y, w, lbl, Js(dv, "name", "-"));
            if (y > content_y1() - ROWH) break;
        }
    }
}

/* ---------- VIEW: NET ---------- */
static const char *NET_ACTS_KEY[] = { "wifi-up", "wifi-reconnect" };
static const char *NET_ACTS_LBL[] = { "conectar", "reconectar" };
static void net_render(int focus) {
    int x = content_x(), y = content_y0(), w = content_w();
    ui_title(x, y, "REDE"); y += ROWH + 2;
    cJSON *d = api_data(g_cache[V_NET]);
    if (!d) { fb_text(x, y, AGENT_OK ? "carregando..." : "agente offline", PAL.muted, PAL.bg, 0); return; }
    cJSON *ifs = J(d, "interfaces");
    const char *ip = STATUS.has_ip ? STATUS.ip : NULL;
    const char *gw = Js(d, "gateway", "");
    int online = ip && gw[0];
    char v[80];
    int bw = ui_badge(x + fb_text_w("REDE "), y, online ? "ONLINE" : "OFF", online ? LVL_OK : LVL_WARN);
    fb_text(x, y + 2, "REDE", PAL.fg_dim, PAL.bg, 0); (void)bw; y += ROWH + 2;
    /* lista de interfaces externas */
    char ifaces[80] = ""; cJSON *it;
    if (ifs) cJSON_ArrayForEach(it, ifs) {
        const char *nm = Js(it, "name", ""); if (!strcmp(nm, "lo")) continue;
        if (ifaces[0]) strncat(ifaces, ", ", sizeof ifaces - strlen(ifaces) - 1);
        strncat(ifaces, nm, sizeof ifaces - strlen(ifaces) - 1);
    }
    y = ui_kv(x, y, w, "INTERFACE", ifaces[0] ? ifaces : "-");
    y = ui_kv(x, y, w, "IP", ip ? ip : "-");
    y = ui_kv(x, y, w, "GATEWAY", gw[0] ? gw : "-");
    cJSON *dns = J(d, "dns"); char dnss[80] = ""; cJSON *dn;
    if (dns) cJSON_ArrayForEach(dn, dns) { const char *s = dn->valuestring; if (!s) continue; if (dnss[0]) strncat(dnss, ", ", sizeof dnss - strlen(dnss) - 1); strncat(dnss, s, sizeof dnss - strlen(dnss) - 1); }
    y = ui_kv(x, y, w, "DNS", dnss[0] ? dnss : "-");
    snprintf(v, sizeof v, "%s", Js(d, "ssid", "(n/a)")); y = ui_kv(x, y, w, "SSID", v);
    y += 6;
    /* ações (focáveis) */
    for (int i = 0; i < 2; i++) {
        int sel = (focus == i), ry = y + i * ROWH;
        if (sel) fb_fill(x - 2, ry - 2, w, ROWH, PAL.line2);
        fb_text(x, ry, "A", PAL.btn_a, sel ? PAL.line2 : PAL.bg, 0);
        fb_text(x + FB_FONT_W * 2, ry, NET_ACTS_LBL[i], sel ? PAL.accent : PAL.fg, sel ? PAL.line2 : PAL.bg, 0);
    }
}

/* ---------- VIEW: LOGS ---------- */
static void logs_render(int focus) {
    (void)focus;
    int x = content_x(), y = content_y0(), w = content_w();
    int sub = g_sub[V_LOGS];
    char t[40]; snprintf(t, sizeof t, "LOGS . %s", LOG_SRC[sub]);
    ui_title(x, y, t); y += ROWH;
    ui_subbar(x, y, LOG_SRC, 5, sub); y += ROWH + 2;
    cJSON *d = api_data(g_cache[V_LOGS]);
    const char *lines = d ? Js(d, "lines", "") : NULL;
    if (!lines || !*lines) { fb_text(x, y, AGENT_OK ? "(sem saida)" : "agente offline", PAL.muted, PAL.bg, 0); return; }
    int maxrows = (content_y1() - y) / FB_FONT_H;
    int cols = w / FB_FONT_W;
    /* mostra as últimas linhas */
    const char *p = lines; int total = 1;
    for (const char *q = lines; *q; q++) if (*q == '\n') total++;
    int skip = total - maxrows; if (skip < 0) skip = 0;
    int idx = 0;
    while (*p && idx < skip) { if (*p == '\n') idx++; p++; }
    int row = 0;
    while (*p && row < maxrows) {
        char buf[160]; int bl = 0;
        while (*p && *p != '\n' && bl < (int)sizeof buf - 1) buf[bl++] = *p++;
        buf[bl] = 0; if (*p == '\n') p++;
        unsigned long c = PAL.fg_dim;
        if (strstr(buf, "error") || strstr(buf, "fail") || strstr(buf, "Error") || strstr(buf, "panic")) c = PAL.crit;
        else if (strstr(buf, "warn") || strstr(buf, "Warn")) c = PAL.warn;
        fb_text_clip(x, y + row * FB_FONT_H, buf, cols, c, PAL.bg, 0);
        row++;
    }
}

/* ---------- VIEW: AJUSTES (tools) ---------- */
static const char *DISP_KEYS[] = { "bright-down", "bright-up" };
static const char *DISP_LBL[]  = { "Brilho -", "Brilho +" };
static const char *AUD_KEYS[]  = { "volume-down", "volume-up", "volume-mute", "audio-test-spk", "audio-test-hp" };
static const char *AUD_LBL[]   = { "Volume -", "Volume +", "Mudo (alternar)", "Testar alto-falante", "Testar fone" };
static int tools_nfocus(void) { return g_sub[V_TOOLS] == 0 ? 3 : 5; } /* DISPLAY: 2 brilho + screenshot */
static void tools_render(int focus) {
    int x = content_x(), y = content_y0(), w = content_w();
    int sub = g_sub[V_TOOLS];
    char t[40]; snprintf(t, sizeof t, "AJUSTES . %s", SUB_TOOLS[sub]);
    ui_title(x, y, t); y += ROWH;
    ui_subbar(x, y, SUB_TOOLS, 2, sub); y += ROWH + 4;
    if (sub == 0) {
        const char *rows[] = { DISP_LBL[0], DISP_LBL[1], "Screenshot (L2+R2)" };
        for (int i = 0; i < 3; i++) {
            int sel = (focus == i), ry = y + i * ROWH;
            if (sel) fb_fill(x - 2, ry - 2, w, ROWH, PAL.line2);
            fb_text(x, ry, "A", PAL.btn_a, sel ? PAL.line2 : PAL.bg, 0);
            fb_text(x + FB_FONT_W * 2, ry, rows[i], sel ? PAL.accent : PAL.fg, sel ? PAL.line2 : PAL.bg, 0);
        }
        y += 3 * ROWH + 6;
        if (STATUS.bright_pct >= 0) ui_gauge(x, y, w, "BRILHO", STATUS.bright_pct);
    } else {
        cJSON *vd = api_data(g_volume);
        if (vd) {
            int p = (int)Jn(vd, "pct", -1);
            if (p >= 0) y = ui_gauge(x, y, w, "VOLUME", p) + 2;
            char st[40]; snprintf(st, sizeof st, "%s . %s", (int)Jn(vd, "muted", 0) ? "MUDO" : "ativo", Js(vd, "control", "-"));
            y = ui_kv(x, y, w, "ESTADO", st);
        }
        y += 4;
        for (int i = 0; i < 5; i++) {
            int sel = (focus == i), ry = y + i * ROWH;
            if (ry + ROWH > content_y1()) break;
            if (sel) fb_fill(x - 2, ry - 2, w, ROWH, PAL.line2);
            fb_text(x, ry, "A", PAL.btn_a, sel ? PAL.line2 : PAL.bg, 0);
            fb_text(x + FB_FONT_W * 2, ry, AUD_LBL[i], sel ? PAL.accent : PAL.fg, sel ? PAL.line2 : PAL.bg, 0);
        }
    }
}
static void tools_activate(int focus) {
    int sub = g_sub[V_TOOLS];
    if (sub == 0) {
        if (focus == 0) post_action(DISP_KEYS[0]);
        else if (focus == 1) post_action(DISP_KEYS[1]);
        else if (focus == 2) view_screenshot();
        view_refresh_status();
    } else {
        if (focus >= 0 && focus < 5) {
            post_action(AUD_KEYS[focus]);
            if (g_volume) { cJSON_Delete(g_volume); g_volume = NULL; }
            g_volume = api_get("/api/volume");
        }
    }
}

/* ---------- VIEW: KEYS ---------- */
static const int KT[] = { CDB_L2, CDB_L1, CDB_R1, CDB_R2, CDB_SELECT, CDB_FN, CDB_START,
                          CDB_UP, CDB_DOWN, CDB_LEFT, CDB_RIGHT, CDB_Y, CDB_X, CDB_A, CDB_B };
static void keys_render(int focus) {
    (void)focus;
    int x = content_x(), y = content_y0(), w = content_w();
    ui_title(x, y, "TESTE DE BOTOES"); y += ROWH;
    fb_text(x, y, "Aperte cada controle - acende quando pressionado.", PAL.muted, PAL.bg, 0); y += ROWH + 4;
    int cellw = 56, cellh = 26, perrow = w / (cellw + 6);
    if (perrow < 1) perrow = 1;
    for (int i = 0; i < (int)(sizeof KT / sizeof KT[0]); i++) {
        int cx = x + (i % perrow) * (cellw + 6);
        int cy = y + (i / perrow) * (cellh + 6);
        int on = input_pressed(KT[i]);
        const char *nm = btn_name(KT[i]);
        unsigned long bgc = on ? PAL.sel_bg : PAL.line2;
        unsigned long fgc = on ? PAL.sel_fg : ui_btn_color(nm);
        fb_fill(cx, cy, cellw, cellh, bgc);
        fb_text(cx + (cellw - fb_text_w(nm)) / 2, cy + 5, nm, fgc, bgc, 0);
    }
    int yy = y + 5 * (cellh + 6) + 4;
    fb_text(x, yy, "Start+Select juntos: sair", PAL.fg_dim, PAL.bg, 0);
}

/* ---------- tabela de views ---------- */
typedef void (*render_fn)(int);
static render_fn RENDER[NVIEWS] = { home_render, status_render, device_render, net_render, logs_render, tools_render, keys_render };
static int view_nfocus(int s) {
    if (s == V_HOME) return home_nfocus();
    if (s == V_NET) return 2;
    if (s == V_TOOLS) return tools_nfocus();
    return 0;
}
static void view_activate(int s, int focus) {
    if (s == V_HOME) home_activate(focus);
    else if (s == V_NET) {
        if (focus >= 0 && focus < 2) { post_action(NET_ACTS_KEY[focus]); g_section = V_NET; view_enter(V_NET); }
    } else if (s == V_TOOLS) tools_activate(focus);
}

/* ---------- menu FN ---------- */
typedef struct { const char *label, *sub; int kind; const char *key; } fn_item;
/* kind: 0=goto view(key=index str), 1=screenshot, 2=action(confirm) */
static fn_item FN_ITEMS[] = {
    { "Ajustes", "display/audio", 0, "5" },
    { "Testar botoes", "gamepad", 0, "6" },
    { "Screenshot agora", "L2+R2", 1, NULL },
    { "Reiniciar agente", "confirma", 2, "restart-agent" },
    { "Reiniciar sistema", "confirma", 2, "reboot" },
    { "Desligar", "confirma", 2, "poweroff" },
};
#define FN_N ((int)(sizeof FN_ITEMS / sizeof FN_ITEMS[0]))
static void fn_render(void) {
    int W = fb_w(), H = fb_h();
    int bw = 360, bh = 30 + FN_N * ROWH + 24, bx = (W - bw) / 2, by = (H - bh) / 2;
    fb_fill(bx, by, bw, bh, PAL.panel);
    fb_fill(bx, by, bw, 2, PAL.accent);
    fb_text(bx + 12, by + 8, "FUNCTION", PAL.accent, PAL.panel, 0);
    int y = by + 30;
    for (int i = 0; i < FN_N; i++) {
        int sel = (g_fn_focus == i);
        if (sel) fb_fill(bx + 4, y - 2, bw - 8, ROWH, PAL.line2);
        unsigned long c = FN_ITEMS[i].kind == 2 ? PAL.warn : (sel ? PAL.accent : PAL.fg);
        fb_text(bx + 12, y, FN_ITEMS[i].label, c, sel ? PAL.line2 : PAL.panel, 0);
        fb_text(bx + bw - 12 - fb_text_w(FN_ITEMS[i].sub), y, FN_ITEMS[i].sub, PAL.muted, sel ? PAL.line2 : PAL.panel, 0);
        y += ROWH;
    }
    fb_text(bx + 12, by + bh - 16, "B/FN fecha", PAL.fg_dim, PAL.panel, 0);
}
static void fn_activate(void) {
    fn_item *it = &FN_ITEMS[g_fn_focus];
    if (it->kind == 0) { int v = atoi(it->key); g_overlay = OV_NONE; g_section = v; view_enter(v); }
    else if (it->kind == 1) { g_overlay = OV_NONE; view_screenshot(); }
    else if (it->kind == 2) {
        snprintf(g_confirm_key, sizeof g_confirm_key, "%s", it->key);
        snprintf(g_confirm_label, sizeof g_confirm_label, "%s", it->label);
        g_overlay = OV_CONFIRM;
    }
}

/* ---------- router ---------- */
static const char *hint_for(int s) {
    switch (s) {
        case V_HOME: return "A: abrir  FN: menu  L2+R2: shot";
        case V_STATUS: return "L1/R1: subpagina  <- ->: abas  B: voltar";
        case V_DEVICE: return "L1/R1: subpagina  <- ->: abas  B: voltar";
        case V_NET: return "A: acao  <- ->: abas  B: voltar";
        case V_LOGS: return "L1/R1: origem  <- ->: abas  B: voltar";
        case V_TOOLS: return "A: executar  L1/R1: subpagina  B: voltar";
        case V_KEYS: return "aperte botoes  Start+Select: sair";
        default: return "";
    }
}
static void goto_tab(int dir) {
    if (g_section >= TAB_COUNT) { g_section = 0; view_enter(0); return; }
    g_section = (g_section + dir + TAB_COUNT) % TAB_COUNT;
    g_focus[g_section] = 0;
    view_enter(g_section);
}
static void view_back(void) {
    if (g_section == V_TOOLS || g_section == V_KEYS) { g_section = V_HOME; view_enter(V_HOME); return; }
    if (g_section != V_HOME) { g_section = V_HOME; view_enter(V_HOME); }
}

void view_handle(const cd_event *ev) {
    if (ev->value != 1) return;            /* só edges de press */
    int b = ev->btn;

    if (b == CDB_F5) { g_running = 0; return; }

    /* ---- overlay: CONFIRM ---- */
    if (g_overlay == OV_CONFIRM) {
        if (b == CDB_A || b == CDB_START) { post_action(g_confirm_key); g_overlay = OV_NONE; }
        else if (b == CDB_B || b == CDB_SELECT) { g_overlay = OV_NONE; }
        return;
    }
    /* ---- overlay: FN ---- */
    if (g_overlay == OV_FN) {
        if (b == CDB_FN || b == CDB_B || b == CDB_SELECT) { g_overlay = OV_NONE; }
        else if (b == CDB_UP) g_fn_focus = (g_fn_focus - 1 + FN_N) % FN_N;
        else if (b == CDB_DOWN) g_fn_focus = (g_fn_focus + 1) % FN_N;
        else if (b == CDB_A || b == CDB_START) fn_activate();
        return;
    }
    /* ---- FN abre o menu ---- */
    if (b == CDB_FN) { g_overlay = OV_FN; g_fn_focus = 0; return; }

    /* ---- KEYS: captura tudo; sai com Start+Select ---- */
    if (g_section == V_KEYS) {
        if (input_pressed(CDB_START) && input_pressed(CDB_SELECT)) view_back();
        return;
    }

    int nf = view_nfocus(g_section);
    switch (b) {
        case CDB_LEFT:  goto_tab(-1); break;
        case CDB_RIGHT: goto_tab(+1); break;
        case CDB_UP:    if (nf) g_focus[g_section] = (g_focus[g_section] - 1 + nf) % nf; break;
        case CDB_DOWN:  if (nf) g_focus[g_section] = (g_focus[g_section] + 1) % nf; break;
        case CDB_A: case CDB_START:
            if (nf) view_activate(g_section, g_focus[g_section]);
            break;
        case CDB_B: case CDB_SELECT: view_back(); break;
        case CDB_L1: if (NSUB[g_section]) { g_sub[g_section] = (g_sub[g_section] - 1 + NSUB[g_section]) % NSUB[g_section]; g_focus[g_section] = 0; if (g_section == V_LOGS || g_section == V_TOOLS) view_enter(g_section); } break;
        case CDB_R1: if (NSUB[g_section]) { g_sub[g_section] = (g_sub[g_section] + 1) % NSUB[g_section]; g_focus[g_section] = 0; if (g_section == V_LOGS || g_section == V_TOOLS) view_enter(g_section); } break;
        default: break;
    }
    if (g_focus[g_section] >= nf) g_focus[g_section] = nf ? nf - 1 : 0;
}

/* ---------- render do frame ---------- */
void view_render(void) {
    fb_clear(PAL.bg);
    ui_topbar();
    ui_tabs(g_section < TAB_COUNT ? g_section : -1);
    RENDER[g_section](g_focus[g_section]);
    ui_footer(hint_for(g_section));
    if (g_overlay == OV_FN) fn_render();
    else if (g_overlay == OV_CONFIRM) ui_confirm(g_confirm_label);
    if (g_toast[0] && now_ms() < g_toast_until) ui_toast(g_toast, 0);
}

void view_screenshot(void) {
    char body[64]; snprintf(body, sizeof body, "{\"version\":\"fb\"}");
    char *r = http_post("/api/screenshot", body);
    if (!r) { set_toast("screenshot: agente offline", 1); return; }
    cJSON *root = cJSON_Parse(r); free(r);
    cJSON *d = api_data(root);
    const char *f = d ? Js(d, "file", "ok") : "ok";
    const char *base = strrchr(f, '/'); set_toast(base ? base + 1 : f, 0);
    if (root) cJSON_Delete(root);
}

void view_tick(void) { view_refresh_status(); if (g_section == V_HOME) refresh_health(); }

int view_running(void) { return g_running; }

void view_init(void) {
    memset(g_sub, 0, sizeof g_sub);
    memset(g_focus, 0, sizeof g_focus);
    memset(g_cache, 0, sizeof g_cache);
    g_toast[0] = 0;
    view_refresh_status();
    view_enter(V_HOME);
}
