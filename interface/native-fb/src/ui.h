/* ui.h — casca (top bar/abas/rodapé/overlays) e helpers de render do native-fb.
 * Espelha os componentes da web (tiles, gauge, kv, listas, badges, cores de botão). */
#ifndef CD_UI_H
#define CD_UI_H

#include "app.h"

void ui_init(void);                 /* preenche PAL */

/* cor de um botão pelo nome ("A"/"B"/"X"/"Y" coloridos; resto branco) */
unsigned long ui_btn_color(const char *name);
unsigned long ui_sev_color(int level);   /* LVL_OK/WARN/CRIT */

/* ---- chrome (desenha a casca completa por frame) ---- */
void ui_topbar(void);                          /* usa STATUS/relógio */
void ui_tabs(int active_tab_index);
void ui_footer(const char *hint);              /* hint com tokens de botão coloridos */

/* hint: desenha string colorindo tokens A/B/X/Y/L1/R1/L2/R2/FN/Start/Select */
void ui_hint(int x, int y, const char *s);

/* ---- helpers de conteúdo ---- */
void ui_title(int x, int y, const char *s);                       /* título ciano */
int  ui_kv(int x, int y, int w, const char *label, const char *value);  /* -> próximo y */
void ui_bar(int x, int y, int w, int h, int pct, unsigned long fg);
int  ui_gauge(int x, int y, int w, const char *label, int pct);   /* -> próximo y */
void ui_tile(int x, int y, int w, int h, const char *label, const char *value,
             const char *sub, int barpct, int level);
int  ui_badge(int x, int y, const char *text, int level);         /* -> largura desenhada */
void ui_subbar(int x, int y, const char *const *labels, int n, int active);

/* sparkline ASCII (sem libs): mapeia série p/ " .:-=+*#%@" */
void ui_sparkline(char *out, int outsz, const double *vals, int n);

/* overlays */
void ui_confirm(const char *msg);              /* desenha modal de confirmação */
void ui_toast(const char *msg, int is_err);    /* desenha toast (rodapé central) */

#endif
