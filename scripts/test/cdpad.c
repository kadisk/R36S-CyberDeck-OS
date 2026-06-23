/*
 * cdpad.c — gamepad VIRTUAL (uinput) para a bateria de teste de UI do CyberDeck OS.
 * Cria um joypad odroidgo3-like (mesmos códigos de interface/native-fb/src/input.c) e
 * LÊ TOKENS DO STDIN, emitindo enquanto o device permanece vivo — assim o runner
 * alterna comandos↔capturas (via FIFO) sem recriar o device (o chooser/fb varrem os
 * /dev/input/event* no startup, então o gamepad precisa existir antes deles).
 *
 * Tokens (um por linha): U D L R A B X Y L1 R1 L2 R2 FN START SELECT
 *                        COMBO <a> <b>   (pressiona os dois juntos: ex. screenshot L2 R2)
 *                        SLEEP <ms>      (apenas no próprio cdpad; o runner controla o ritmo)
 * EOF/SIGTERM -> destrói o device e sai.
 *
 * Cross-compile: aarch64-linux-gnu-gcc -O2 -static -o cdpad cdpad.c
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <linux/uinput.h>

/* códigos crus do odroidgo3-joypad (iguais aos de input.c) */
static struct { const char *tok; int code; } MAP[] = {
    {"U",0x220},{"D",0x221},{"L",0x222},{"R",0x223},
    {"A",0x131},{"B",0x130},{"X",0x133},{"Y",0x134},
    {"L1",0x136},{"R1",0x137},{"L2",0x138},{"R2",0x139},
    {"SELECT",0x13a},{"START",0x13b},{"FN",0x2c0},
};
#define NMAP ((int)(sizeof MAP/sizeof MAP[0]))

static int code_of(const char *t) { for (int i=0;i<NMAP;i++) if(!strcmp(t,MAP[i].tok)) return MAP[i].code; return -1; }
static void ev(int fd,int type,int code,int val){ struct input_event e; memset(&e,0,sizeof e); e.type=type; e.code=code; e.value=val; if(write(fd,&e,sizeof e)<0){} }
static void syn(int fd){ ev(fd,EV_SYN,SYN_REPORT,0); }
static void press(int fd,int c,int v){ ev(fd,EV_KEY,c,v); syn(fd); }

int main(void){
    int fd=open("/dev/uinput",O_WRONLY|O_NONBLOCK);
    if(fd<0){ perror("open /dev/uinput"); return 1; }
    ioctl(fd,UI_SET_EVBIT,EV_KEY); ioctl(fd,UI_SET_EVBIT,EV_SYN);
    for(int i=0;i<NMAP;i++) ioctl(fd,UI_SET_KEYBIT,MAP[i].code);
    struct uinput_user_dev u; memset(&u,0,sizeof u);
    snprintf(u.name,sizeof u.name,"cdpad-virtual-joypad");
    u.id.bustype=BUS_USB; u.id.vendor=0x484b; u.id.product=0x1102;
    if(write(fd,&u,sizeof u)<0){}
    if(ioctl(fd,UI_DEV_CREATE)<0){ perror("UI_DEV_CREATE"); return 1; }
    setvbuf(stdout,NULL,_IONBF,0);
    fprintf(stderr,"[cdpad] pronto\n");

    char line[128];
    while(fgets(line,sizeof line,stdin)){
        char *nl=strchr(line,'\n'); if(nl)*nl=0;
        char *t=strtok(line," \t");
        if(!t) continue;
        if(!strcmp(t,"SLEEP")){ char *ms=strtok(NULL," \t"); if(ms) usleep(atoi(ms)*1000); continue; }
        if(!strcmp(t,"COMBO")){
            char *a=strtok(NULL," \t"), *b=strtok(NULL," \t");
            int ca=a?code_of(a):-1, cb=b?code_of(b):-1;
            if(ca>0&&cb>0){ press(fd,ca,1); press(fd,cb,1); usleep(120000); press(fd,cb,0); press(fd,ca,0); }
            continue;
        }
        int c=code_of(t);
        if(c>0){ press(fd,c,1); usleep(60000); press(fd,c,0); }
    }
    ioctl(fd,UI_DEV_DESTROY); close(fd);
    fprintf(stderr,"[cdpad] saiu\n");
    return 0;
}
