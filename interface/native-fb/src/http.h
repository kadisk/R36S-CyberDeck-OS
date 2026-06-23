/* http.h — cliente HTTP mínimo p/ falar com o cyberdeck-agent (127.0.0.1:8080).
 * Mesma fonte de dados da web. Retorna o CORPO da resposta (malloc'd, NUL-terminado)
 * ou NULL em falha. O chamador faz free(). */
#ifndef CD_HTTP_H
#define CD_HTTP_H

void  http_init(int port);                 /* porta do agente (default 8080) */
char *http_get(const char *path);          /* GET path -> corpo (malloc) | NULL */
char *http_post(const char *path, const char *json_body);  /* POST JSON -> corpo | NULL */

#endif
