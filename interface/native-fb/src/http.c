/* http.c — cliente HTTP mínimo (localhost). Ver http.h.
 * Baseado no padrão de sockets de experiments/cyberdeck-agent-c/src/main.c. */
#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>

#include "http.h"

static int g_port = 8080;
void http_init(int port) { if (port > 0) g_port = port; }

/* envia uma requisição já montada e devolve o CORPO (após \r\n\r\n) em malloc. */
static char *do_request(const char *req, int reqlen) {
    int fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) return NULL;
    struct timeval tv = { 3, 0 };
    setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof tv);
    setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof tv);

    struct sockaddr_in a; memset(&a, 0, sizeof a);
    a.sin_family = AF_INET; a.sin_port = htons(g_port);
    a.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    if (connect(fd, (struct sockaddr *)&a, sizeof a) < 0) { close(fd); return NULL; }

    int off = 0;
    while (off < reqlen) { int w = write(fd, req + off, reqlen - off); if (w <= 0) { close(fd); return NULL; } off += w; }

    /* lê tudo até o servidor fechar (Connection: close) */
    size_t cap = 8192, len = 0;
    char *buf = malloc(cap);
    if (!buf) { close(fd); return NULL; }
    for (;;) {
        if (len + 4096 + 1 > cap) { cap *= 2; char *nb = realloc(buf, cap); if (!nb) { free(buf); close(fd); return NULL; } buf = nb; }
        ssize_t r = read(fd, buf + len, 4096);
        if (r > 0) len += (size_t)r;
        else break;
    }
    close(fd);
    buf[len] = 0;

    /* separa o corpo (pula os headers) */
    char *body = strstr(buf, "\r\n\r\n");
    if (!body) { free(buf); return NULL; }
    body += 4;
    char *out = strdup(body);
    free(buf);
    return out;
}

char *http_get(const char *path) {
    char req[512];
    int n = snprintf(req, sizeof req,
        "GET %s HTTP/1.0\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n", path);
    return do_request(req, n);
}

char *http_post(const char *path, const char *json_body) {
    if (!json_body) json_body = "{}";
    char req[1024];
    int n = snprintf(req, sizeof req,
        "POST %s HTTP/1.0\r\nHost: 127.0.0.1\r\n"
        "Content-Type: application/json\r\nContent-Length: %zu\r\n"
        "Connection: close\r\n\r\n%s",
        path, strlen(json_body), json_body);
    return do_request(req, n);
}
