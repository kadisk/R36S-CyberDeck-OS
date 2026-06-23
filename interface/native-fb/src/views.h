/* views.h — telas + router do native-fb (Tranche A). main.c só orquestra. */
#ifndef CD_VIEWS_H
#define CD_VIEWS_H

#include "input.h"

extern const char *const TAB_TITLES[];
extern int TAB_COUNT;

void view_init(void);
void view_refresh_status(void);   /* GET /api/status -> STATUS (+ histórico) */
void view_tick(void);             /* poll periódico: status + saúde (se HOME) */
void view_handle(const cd_event *ev);   /* navegação/ativação/overlays (no press) */
void view_render(void);                  /* desenha o frame inteiro (sem present) */
void view_screenshot(void);              /* POST /api/screenshot (combo L2+R2 / FN) */
int  view_running(void);                  /* 0 quando o usuário pede sair (F5) */

#endif
