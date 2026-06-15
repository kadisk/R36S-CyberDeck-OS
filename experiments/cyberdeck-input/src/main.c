/*
 * cyberdeck-input — ponte joypad -> teclado (R36S CyberDeck OS).
 *
 * Lê o joypad (odroidgo3, /dev/input/event*) e injeta teclas via /dev/uinput,
 * para a UI web (Chromium/Xorg) ser navegável pelos botões. Faz EVIOCGRAB no
 * joypad para os eventos crus não chegarem 2x no X.
 *
 * Mapa (codigos confirmados na Fase 3):
 *   D-pad ↑↓←→ -> setas ; A(0x131)->Enter ; B(0x130)->Esc ;
 *   X(0x133)->Tab ; Y(0x134)->Backspace(voltar) ;
 *   L1(0x136)->PageUp ; R1(0x137)->PageDown ; L2/R2 -> Home/End ;
 *   F1(0x2c0)->F5(reload) ; F2(0x2c1)->Tab
 *
 * Cross-compile: aarch64-linux-gnu-gcc -O2 -static -o cyberdeck-input src/main.c
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <fcntl.h>
#include <unistd.h>
#include <dirent.h>
#include <errno.h>
#include <signal.h>
#include <sys/ioctl.h>
#include <linux/input.h>
#include <linux/uinput.h>

static int ufd = -1, jfd = -1;

struct map { int joy, key; };
static const struct map MAP[] = {
    {0x220, KEY_UP}, {0x221, KEY_DOWN}, {0x222, KEY_LEFT}, {0x223, KEY_RIGHT},
    {0x131, KEY_ENTER},     /* A */
    {0x130, KEY_ESC},       /* B */
    {0x133, KEY_TAB},       /* X */
    {0x134, KEY_BACKSPACE}, /* Y */
    {0x136, KEY_PAGEUP},    /* L1 */
    {0x137, KEY_PAGEDOWN},  /* R1 */
    {0x138, KEY_HOME},      /* L2 */
    {0x139, KEY_END},       /* R2 */
    {0x2c0, KEY_F5},        /* F1 -> reload */
    {0x2c1, KEY_TAB},       /* F2 */
};
#define NMAP (int)(sizeof(MAP)/sizeof(MAP[0]))

static int key_for(int joy){ for(int i=0;i<NMAP;i++) if(MAP[i].joy==joy) return MAP[i].key; return 0; }

static void emit(int type,int code,int val){
    struct input_event ie; memset(&ie,0,sizeof ie);
    ie.type=type; ie.code=code; ie.value=val;
    if (write(ufd,&ie,sizeof ie) < 0) {}
}
static void cleanup(int s){ (void)s; if(ufd>=0){ ioctl(ufd,UI_DEV_DESTROY); close(ufd);} if(jfd>=0) close(jfd); _exit(0); }

/* acha o device do joypad: nome com "Gamepad"/"joypad", ou que tenha a tecla 0x220 */
static int open_joypad(void){
    char path[64]; char name[256];
    for(int i=0;i<32;i++){
        snprintf(path,sizeof path,"/dev/input/event%d",i);
        int fd=open(path,O_RDONLY);
        if(fd<0) continue;
        name[0]=0; ioctl(fd,EVIOCGNAME(sizeof name),name);
        unsigned long bits[(KEY_MAX/ (8*sizeof(long)))+1]; memset(bits,0,sizeof bits);
        ioctl(fd,EVIOCGBIT(EV_KEY,sizeof bits),bits);
        int has_dpad = (bits[0x220/(8*sizeof(long))] >> (0x220 % (8*sizeof(long)))) & 1;
        if(strstr(name,"Gamepad")||strstr(name,"joypad")||strstr(name,"odroidgo")||has_dpad){
            fprintf(stderr,"[cyberdeck-input] joypad: %s (%s)\n",path,name);
            return fd;
        }
        close(fd);
    }
    return -1;
}

int main(void){
    signal(SIGINT,cleanup); signal(SIGTERM,cleanup);

    jfd = open_joypad();
    if(jfd<0){ fprintf(stderr,"[cyberdeck-input] joypad nao encontrado\n"); return 1; }

    ufd = open("/dev/uinput", O_WRONLY|O_NONBLOCK);
    if(ufd<0){ perror("open /dev/uinput"); return 1; }
    ioctl(ufd,UI_SET_EVBIT,EV_KEY);
    ioctl(ufd,UI_SET_EVBIT,EV_SYN);
    for(int i=0;i<NMAP;i++) ioctl(ufd,UI_SET_KEYBIT,MAP[i].key);

    struct uinput_user_dev ud; memset(&ud,0,sizeof ud);
    snprintf(ud.name,sizeof ud.name,"cyberdeck-keys");
    ud.id.bustype=BUS_VIRTUAL; ud.id.vendor=0x1; ud.id.product=0x1; ud.id.version=1;
    if(write(ufd,&ud,sizeof ud)<0){ perror("write uinput dev"); return 1; }
    if(ioctl(ufd,UI_DEV_CREATE)<0){ perror("UI_DEV_CREATE"); return 1; }

    /* pega o joypad com exclusividade (nao vaza eventos crus p/ o X) */
    ioctl(jfd,EVIOCGRAB,1);
    fprintf(stderr,"[cyberdeck-input] teclado virtual criado. mapeando...\n");

    struct input_event ev;
    while(read(jfd,&ev,sizeof ev)==sizeof ev){
        if(ev.type!=EV_KEY) continue;
        if(ev.value!=0 && ev.value!=1) continue;   /* ignora autorepeat (2) */
        int k=key_for(ev.code);
        if(!k) continue;
        emit(EV_KEY,k,ev.value);
        emit(EV_SYN,SYN_REPORT,0);
    }
    cleanup(0);
    return 0;
}
