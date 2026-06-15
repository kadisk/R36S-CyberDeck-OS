/*
 * cyberdeck-agent — agente de dados do sistema (R36S CyberDeck OS).
 *
 * Servidor HTTP minúsculo em 127.0.0.1:PORT que devolve JSON com CPU/RAM/load/
 * uptime/temp/bateria(rk817)/brilho/rede, lido de /proc e /sys. A UI web (Chromium,
 * file://) faz fetch e atualiza ao vivo. CORS liberado (Access-Control-Allow-Origin: *)
 * porque a origem file:// é "null". Responde o MESMO JSON a qualquer GET.
 *
 * Cross-compile: aarch64-linux-gnu-gcc -O2 -static -o cyberdeck-agent src/main.c
 * Uso: cyberdeck-agent [porta]   (default 8080)
 */
#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <dirent.h>
#include <signal.h>
#include <errno.h>
#include <time.h>
#include <ifaddrs.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <sys/types.h>

/* ---- leitura de arquivos /proc /sys ---- */
static int read_file(const char *path, char *buf, size_t n) {
    int fd = open(path, O_RDONLY);
    if (fd < 0) return -1;
    ssize_t r = read(fd, buf, n - 1);
    close(fd);
    if (r < 0) return -1;
    buf[r] = 0;
    return (int)r;
}
static long read_long(const char *path) {
    char b[64]; if (read_file(path, b, sizeof b) < 0) return -1;
    return strtol(b, NULL, 10);
}

/* ---- CPU % (delta entre chamadas) ---- */
static unsigned long long prev_total = 0, prev_idle = 0;
static double cpu_pct(void) {
    char b[512]; if (read_file("/proc/stat", b, sizeof b) < 0) return -1;
    unsigned long long u, n, s, i, io, irq, sq, st;
    if (sscanf(b, "cpu %llu %llu %llu %llu %llu %llu %llu %llu",
               &u, &n, &s, &i, &io, &irq, &sq, &st) < 4) return -1;
    unsigned long long idle = i + io;
    unsigned long long total = u + n + s + i + io + irq + sq + st;
    double pct = -1;
    if (prev_total && total > prev_total) {
        unsigned long long dt = total - prev_total, di = idle - prev_idle;
        pct = 100.0 * (double)(dt - di) / (double)dt;
    }
    prev_total = total; prev_idle = idle;
    return pct;
}

/* ---- RAM ---- */
static void mem_info(long *total_mb, long *used_mb, double *pct) {
    char b[2048]; *total_mb = *used_mb = 0; *pct = 0;
    if (read_file("/proc/meminfo", b, sizeof b) < 0) return;
    long mt = 0, ma = 0;
    char *p;
    if ((p = strstr(b, "MemTotal:")))     mt = strtol(p + 9, NULL, 10);
    if ((p = strstr(b, "MemAvailable:"))) ma = strtol(p + 13, NULL, 10);
    if (mt > 0) {
        *total_mb = mt / 1024; *used_mb = (mt - ma) / 1024;
        *pct = 100.0 * (double)(mt - ma) / (double)mt;
    }
}

/* ---- bateria (rk817): acha um power_supply tipo Battery ---- */
static void battery_info(int *pct, char *status, size_t sn, int *ac_online) {
    *pct = -1; status[0] = 0; *ac_online = -1;
    DIR *d = opendir("/sys/class/power_supply");
    if (!d) return;
    struct dirent *e;
    char path[512], type[32];
    while ((e = readdir(d))) {
        if (e->d_name[0] == '.') continue;
        snprintf(path, sizeof path, "/sys/class/power_supply/%s/type", e->d_name);
        if (read_file(path, type, sizeof type) < 0) continue;
        if (strncmp(type, "Battery", 7) == 0) {
            snprintf(path, sizeof path, "/sys/class/power_supply/%s/capacity", e->d_name);
            *pct = (int)read_long(path);
            snprintf(path, sizeof path, "/sys/class/power_supply/%s/status", e->d_name);
            if (read_file(path, status, sn) >= 0) { char *nl = strchr(status, '\n'); if (nl) *nl = 0; }
        } else { /* Mains/USB */
            snprintf(path, sizeof path, "/sys/class/power_supply/%s/online", e->d_name);
            long on = read_long(path);
            if (on == 1) *ac_online = 1;
            else if (on == 0 && *ac_online < 0) *ac_online = 0;
        }
    }
    closedir(d);
}

/* ---- brilho ---- */
static void backlight_info(int *cur, int *max, double *pct) {
    *cur = -1; *max = -1; *pct = -1;
    DIR *d = opendir("/sys/class/backlight");
    if (!d) return;
    struct dirent *e;
    while ((e = readdir(d))) {
        if (e->d_name[0] == '.') continue;
        char p[512];
        snprintf(p, sizeof p, "/sys/class/backlight/%s/brightness", e->d_name);
        *cur = (int)read_long(p);
        snprintf(p, sizeof p, "/sys/class/backlight/%s/max_brightness", e->d_name);
        *max = (int)read_long(p);
        if (*max > 0) *pct = 100.0 * (double)*cur / (double)*max;
        break;
    }
    closedir(d);
}

/* ---- rede: interfaces AF_INET (com IP) via getifaddrs ---- */
static int net_json(char *out, size_t n) {
    struct ifaddrs *ifa, *p;
    int len = 0, first = 1;
    len += snprintf(out + len, n - len, "[");
    if (getifaddrs(&ifa) == 0) {
        for (p = ifa; p; p = p->ifa_next) {
            if (!p->ifa_addr || p->ifa_addr->sa_family != AF_INET) continue;
            if (strcmp(p->ifa_name, "lo") == 0) continue;
            char ip[INET_ADDRSTRLEN] = "";
            struct sockaddr_in *sa = (struct sockaddr_in *)p->ifa_addr;
            inet_ntop(AF_INET, &sa->sin_addr, ip, sizeof ip);
            int up = (p->ifa_flags & 1 /*IFF_UP*/) ? 1 : 0;
            len += snprintf(out + len, n - len, "%s{\"iface\":\"%s\",\"ip\":\"%s\",\"up\":%d}",
                            first ? "" : ",", p->ifa_name, ip, up);
            first = 0;
        }
        freeifaddrs(ifa);
    }
    len += snprintf(out + len, n - len, "]");
    return len;
}

/* ---- monta o JSON completo ---- */
static int build_json(char *out, size_t n) {
    double cpu = cpu_pct();
    long mt, mu; double mpct; mem_info(&mt, &mu, &mpct);
    char load[64] = "0 0 0";
    { char b[128]; if (read_file("/proc/loadavg", b, sizeof b) > 0) {
        char a1[16], a2[16], a3[16];
        if (sscanf(b, "%15s %15s %15s", a1, a2, a3) == 3)
            snprintf(load, sizeof load, "%s %s %s", a1, a2, a3); } }
    double up = 0; { char b[64]; if (read_file("/proc/uptime", b, sizeof b) > 0) up = atof(b); }
    long temp_m = read_long("/sys/class/thermal/thermal_zone0/temp");
    double temp = temp_m > 0 ? temp_m / 1000.0 : -1;
    int bpct, ac; char bst[32]; battery_info(&bpct, bst, sizeof bst, &ac);
    int bcur, bmax; double bbr; backlight_info(&bcur, &bmax, &bbr);
    char host[64] = "r36s"; { char b[64]; if (read_file("/proc/sys/kernel/hostname", b, sizeof b) > 0) {
        char *nl = strchr(b, '\n'); if (nl) *nl = 0; snprintf(host, sizeof host, "%s", b); } }
    char net[1024]; net_json(net, sizeof net);

    return snprintf(out, n,
        "{"
        "\"cpu\":%.1f,"
        "\"mem\":{\"used\":%ld,\"total\":%ld,\"pct\":%.1f},"
        "\"load\":\"%s\","
        "\"uptime\":%.0f,"
        "\"temp\":%.1f,"
        "\"battery\":{\"pct\":%d,\"status\":\"%s\",\"ac\":%d},"
        "\"brightness\":{\"cur\":%d,\"max\":%d,\"pct\":%.0f},"
        "\"net\":%s,"
        "\"host\":\"%s\""
        "}",
        cpu, mu, mt, mpct, load, up, temp, bpct, bst, ac, bcur, bmax, bbr, net, host);
}

int main(int argc, char **argv) {
    int port = (argc > 1) ? atoi(argv[1]) : 8080;
    signal(SIGPIPE, SIG_IGN);

    int srv = socket(AF_INET, SOCK_STREAM, 0);
    if (srv < 0) { perror("socket"); return 1; }
    int one = 1; setsockopt(srv, SOL_SOCKET, SO_REUSEADDR, &one, sizeof one);
    struct sockaddr_in a; memset(&a, 0, sizeof a);
    a.sin_family = AF_INET; a.sin_port = htons(port);
    a.sin_addr.s_addr = htonl(INADDR_LOOPBACK); /* só localhost */
    if (bind(srv, (struct sockaddr *)&a, sizeof a) < 0) { perror("bind"); return 1; }
    if (listen(srv, 8) < 0) { perror("listen"); return 1; }
    fprintf(stderr, "[cyberdeck-agent] http://127.0.0.1:%d/  (JSON de sistema)\n", port);

    char json[2048], resp[4096], req[1024];
    for (;;) {
        int c = accept(srv, NULL, NULL);
        if (c < 0) { if (errno == EINTR) continue; break; }
        struct timeval tv = { 2, 0 };
        setsockopt(c, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof tv);
        recv(c, req, sizeof req - 1, 0); /* drena o request (não precisamos parsear) */
        int jl = build_json(json, sizeof json);
        int rl = snprintf(resp, sizeof resp,
            "HTTP/1.1 200 OK\r\n"
            "Content-Type: application/json\r\n"
            "Access-Control-Allow-Origin: *\r\n"
            "Cache-Control: no-store\r\n"
            "Connection: close\r\n"
            "Content-Length: %d\r\n\r\n%s", jl, json);
        ssize_t off = 0;
        while (off < rl) { ssize_t w = write(c, resp + off, rl - off); if (w <= 0) break; off += w; }
        close(c);
    }
    close(srv);
    return 0;
}
