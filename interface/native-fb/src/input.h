/* input.h — leitura do joypad (odroidgo3) via /dev/input/event*.
 * Expõe um fluxo de eventos (press/release) e o mapeamento p/ botões lógicos,
 * espelhando o contrato de input de docs/interface/FEATURES.md §3. */
#ifndef CD_INPUT_H
#define CD_INPUT_H

/* botões lógicos (paridade com a web). Prefixo CDB_ p/ não colidir com os
 * macros BTN_* de <linux/input.h>. */
enum {
    CDB_NONE = 0,
    CDB_UP, CDB_DOWN, CDB_LEFT, CDB_RIGHT,
    CDB_A, CDB_B, CDB_X, CDB_Y,
    CDB_L1, CDB_R1, CDB_L2, CDB_R2,
    CDB_FN, CDB_START, CDB_SELECT,
    CDB_F5,          /* tecla de saída (debug/dev) */
    CDB_COUNT
};

typedef struct { int btn; int value; } cd_event;  /* value: 1=press, 0=release, 2=repeat */

int  input_open(void);
void input_close(void);

/* Espera por um evento de tecla até timeout_ms. Retorna 1 e preenche *ev se houver
 * um evento de botão conhecido; 0 em timeout/evento ignorado. */
int  input_next(cd_event *ev, int timeout_ms);

/* estado atual (para combos: L2+R2, Start+Select). 1 se pressionado agora. */
int  input_pressed(int btn);

const char *btn_name(int btn);   /* "A","L1","↑"… para a tela de teste */

#endif
