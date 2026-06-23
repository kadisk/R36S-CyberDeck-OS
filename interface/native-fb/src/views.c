/* views.c — telas + router do native-fb (paridade com a web-vanilla).
 * Tranche A (HOME/STATUS/DEVICE/NET/LOGS/AJUSTES/KEYS) + Tranche B (PROCS/FS/SVC/
 * CMD/KERNEL + detalhe de LOGS), com master->detail, paginação e confirm.
 * Dados via cyberdeck-agent (HTTP/JSON). Ver docs/interface/FEATURES.md. */
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

enum { V_HOME, V_STATUS, V_PROCS, V_NET, V_LOGS, V_DEVICE, V_FS, V_SVC, V_CMD,
       V_KERNEL, V_TOOLS, V_KEYS, V_MEDIA, V_STORAGE, NVIEWS };

const char *const TAB_TITLES[] = { "HOME", "STATUS", "PROCS", "NET", "LOGS", "DEVICE", "FS", "SVC", "CMD" };
int TAB_COUNT = 9;

static int g_section = V_HOME;
static int g_sub[NVIEWS];
static int g_focus[NVIEWS];
static int g_running = 1;

enum { OV_NONE, OV_FN, OV_CONFIRM };
static int g_overlay = OV_NONE;
static int g_fn_focus = 0;

/* confirm generalizado */
enum { CF_ACTION, CF_SVC, CF_SIG };
static int  g_cf_kind;
static char g_cf_a[64], g_cf_b[176], g_cf_label[100];

/* toast */
static char g_toast[96];
static long g_toast_until = 0;

/* caches */
static cJSON *g_cache[NVIEWS];   /* nível-lista por view */
static cJSON *g_detail = NULL;   /* detalhe (svc/procs/fs-file) */
static cJSON *g_health = NULL;
static cJSON *g_volume = NULL;
static char  *g_cmd_out = NULL;  /* saída do último comando (texto) */
static char  *g_svc_log = NULL;  /* journal do serviço (SVC detalhe->logs) */
static char  *g_net_extra = NULL;/* resultado de scan/conexões (NET) */

/* estado master/detail */
static char fs_path[512] = "/"; static int fs_mode = 0, fs_page = 0;   /* 0=lista 1=arquivo */
static char sv_unit[176];        static int sv_mode = 0, sv_page = 0, sv_filter = 0;  /* sv_mode: 0 lista 1 detalhe 2 logs */
static int  pr_pid = 0;          static int pr_mode = 0, pr_page = 0, pr_sort = 0, pr_filter = 0;
static char cmd_cat[40] = "";    static int cmd_mode = 0;              /* 0=cats 1=lista 2=saida */
static int  kn_page = 0;
static int  ls_sev = 0;          /* LOGS: severidade 0=all 1=error 2=warning 3=info */
static int  net_mode = 0;        /* NET: 0 normal 1 scan 2 conexões */

/* subpáginas / filtros */
static const char *const SUB_STATUS[] = { "AO VIVO", "ENERGIA", "TENDENCIA" };
static const char *const SUB_DEVICE[] = { "ID", "CPU", "DISPLAY", "BOOT", "INPUT" };
static const char *const SUB_TOOLS[]  = { "DISPLAY", "AUDIO" };
static const char *const LOG_SRC[]    = { "dmesg", "journal", "agent", "kiosk", "ui" };
static const char *const SD_FILT[]    = { "all", "running", "failed", "cyberdeck" };
static const char *const LOG_SEV[]    = { "all", "error", "warning", "info" };
static const char *const PR_SORT[]    = { "cpu", "mem", "pid", "name" };
static const int NSUB[NVIEWS] = { [V_STATUS]=3, [V_DEVICE]=5, [V_LOGS]=5, [V_TOOLS]=2 };

#define PAGE 10

/* ---------- helpers ---------- */
static long now_ms(void) { struct timespec ts; clock_gettime(CLOCK_MONOTONIC, &ts); return ts.tv_sec*1000L + ts.tv_nsec/1000000L; }
static cJSON *J(cJSON *o, const char *k) { return cJSON_GetObjectItemCaseSensitive(o, k); }
static const char *Js(cJSON *o, const char *k, const char *def) { cJSON *x=J(o,k); return (x&&cJSON_IsString(x)&&x->valuestring)?x->valuestring:def; }
static double Jn(cJSON *o, const char *k, double def) { cJSON *x=J(o,k); return (x&&cJSON_IsNumber(x))?x->valuedouble:def; }
static cJSON *api_get(const char *path) { char *b=http_get(path); if(!b){AGENT_OK=0;return NULL;} AGENT_OK=1; cJSON *r=cJSON_Parse(b); free(b); return r; }
static cJSON *api_data(cJSON *root) { return root?J(root,"data"):NULL; }
static void set_toast(const char *m, int e) { snprintf(g_toast,sizeof g_toast,"%s",m?m:""); g_toast_until=now_ms()+2600; (void)e; }

static void post_msg(const char *path, const char *body) {
    char *r = http_post(path, body);
    if (!r) { AGENT_OK=0; set_toast("agente offline", 1); return; }
    AGENT_OK=1; cJSON *root=cJSON_Parse(r); free(r);
    cJSON *d=api_data(root); set_toast(d?Js(d,"msg","ok"):"ok", 0);
    if (root) cJSON_Delete(root);
}
static void post_action(const char *key) { char b[64]; snprintf(b,sizeof b,"{\"key\":\"%s\"}",key); post_msg("/api/actions", b); }

static void confirm_open(int kind, const char *a, const char *b, const char *label) {
    g_cf_kind=kind; snprintf(g_cf_a,sizeof g_cf_a,"%s",a?a:""); snprintf(g_cf_b,sizeof g_cf_b,"%s",b?b:"");
    snprintf(g_cf_label,sizeof g_cf_label,"%s",label?label:""); g_overlay=OV_CONFIRM;
}
static void confirm_do(void) {
    if (g_cf_kind==CF_ACTION) post_action(g_cf_a);
    else if (g_cf_kind==CF_SVC) { char b[256]; snprintf(b,sizeof b,"{\"action\":\"%s\",\"unit\":\"%s\"}",g_cf_a,g_cf_b); post_msg("/api/systemd/action",b); }
    else if (g_cf_kind==CF_SIG) { char p[96],b[64]; snprintf(p,sizeof p,"/api/processes/%s/signal",g_cf_b); snprintf(b,sizeof b,"{\"signal\":\"%s\"}",g_cf_a); post_msg(p,b); }
}

/* ---------- status / health ---------- */
#define HN 60
static double h_cpu[HN], h_ram[HN], h_temp[HN]; static int h_len=0;
static void hist_push(double *a, double v) { if(h_len<HN) a[h_len]=v; else { memmove(a,a+1,(HN-1)*sizeof(double)); a[HN-1]=v; } }
void view_refresh_status(void) {
    cJSON *root=api_get("/api/status"); cJSON *d=api_data(root);
    if (!d) { STATUS.valid=0; if(root)cJSON_Delete(root); return; }
    STATUS.valid=1;
    snprintf(STATUS.host,sizeof STATUS.host,"%s",Js(d,"host","r36s"));
    STATUS.cpu=Jn(d,"cpu",-1); STATUS.has_cpu=STATUS.cpu>=0;
    STATUS.cores=(int)Jn(d,"cores",0); STATUS.uptime=Jn(d,"uptime",0); STATUS.temp=(int)Jn(d,"temp",-1);
    cJSON *m=J(d,"mem"); if(m){STATUS.mem_pct=Jn(m,"pct",0);STATUS.mem_used=(int)Jn(m,"used",0);STATUS.mem_total=(int)Jn(m,"total",0);STATUS.has_mem=1;}
    cJSON *la=J(d,"load_arr"); STATUS.load1=(la&&cJSON_IsArray(la)&&cJSON_GetArraySize(la)>0)?cJSON_GetArrayItem(la,0)->valuedouble:-1;
    cJSON *b=J(d,"battery");
    if(b){STATUS.bat_pct=(int)Jn(b,"pct",-1);STATUS.bat_est=(int)Jn(b,"est",-1);STATUS.bat_ac=(int)Jn(b,"ac",-1);STATUS.bat_volt=Jn(b,"volt",-1);STATUS.bat_ocv=Jn(b,"ocv",-1);STATUS.bat_curr=(int)Jn(b,"curr",0);snprintf(STATUS.bat_status,sizeof STATUS.bat_status,"%s",Js(b,"status",""));STATUS.bat_trust_low=!strcmp(Js(b,"capacity_trust","ok"),"low");}
    cJSON *br=J(d,"brightness"); if(br){STATUS.bright_pct=(int)Jn(br,"pct",-1);STATUS.bright_cur=(int)Jn(br,"cur",-1);STATUS.bright_max=(int)Jn(br,"max",-1);}
    cJSON *net=J(d,"net"); STATUS.has_ip=0; STATUS.ip[0]=0;
    if(net&&cJSON_IsArray(net)&&cJSON_GetArraySize(net)>0){cJSON *n0=cJSON_GetArrayItem(net,0);const char *ip=Js(n0,"ip","");if(ip[0]){snprintf(STATUS.ip,sizeof STATUS.ip,"%s",ip);STATUS.has_ip=1;}}
    if(STATUS.has_cpu)hist_push(h_cpu,STATUS.cpu); if(STATUS.has_mem)hist_push(h_ram,STATUS.mem_pct); if(STATUS.temp>=0)hist_push(h_temp,STATUS.temp);
    if(h_len<HN)h_len++;
    if(root)cJSON_Delete(root);
}
static void refresh_health(void) { if(g_health){cJSON_Delete(g_health);g_health=NULL;} g_health=api_get("/api/health"); }

/* ---------- layout ---------- */
static int cx(void){ return UI_PAD; }
static int cw(void){ return fb_w()-2*UI_PAD; }
static int cy0(void){ return UI_CONTENT_Y+2; }
static int cy1(void){ return fb_h()-UI_FOOTER_H-2; }
static int lvl_temp(int t){ return t<0?LVL_OK:t>=80?LVL_CRIT:t>=65?LVL_WARN:LVL_OK; }
static int lvl_pct(double p){ return p>90?LVL_CRIT:p>=75?LVL_WARN:LVL_OK; }
static void uptime_str(double s,char*o,int n){ long t=(long)s,d=t/86400;t%=86400;long h=t/3600;t%=3600;long m=t/60; if(d)snprintf(o,n,"%ldd %ldh %ldm",d,h,m); else snprintf(o,n,"%ldh %ldm",h,m); }
static int pg_count(int n){ int c=(n+PAGE-1)/PAGE; return c<1?1:c; }
static int clampi(int v,int lo,int hi){ return v<lo?lo:v>hi?hi:v; }

/* ---------- enter (lazy fetch) ---------- */
static void cache_free(int s){ if(g_cache[s]){cJSON_Delete(g_cache[s]);g_cache[s]=NULL;} }
static void detail_free(void){ if(g_detail){cJSON_Delete(g_detail);g_detail=NULL;} }
static void view_enter(int s) {
    cache_free(s);
    if (s==V_DEVICE) g_cache[s]=api_get("/api/device");
    else if (s==V_NET) { net_mode=0; if(g_net_extra){free(g_net_extra);g_net_extra=NULL;} g_cache[s]=api_get("/api/network/summary"); }
    else if (s==V_KERNEL) g_cache[s]=api_get("/api/kernel");
    else if (s==V_PROCS) g_cache[s]=api_get("/api/processes");
    else if (s==V_SVC) g_cache[s]=api_get("/api/systemd/services");
    else if (s==V_CMD) g_cache[s]=api_get("/api/commands");
    else if (s==V_FS) { char p[600]; snprintf(p,sizeof p,"/api/fs/list?path=%s",fs_path); g_cache[s]=api_get(p); }
    else if (s==V_LOGS) { char p[128]; if(ls_sev>0) snprintf(p,sizeof p,"/api/logs?source=%s&severity=%s&lines=120",LOG_SRC[g_sub[V_LOGS]],LOG_SEV[ls_sev]); else snprintf(p,sizeof p,"/api/logs?source=%s&lines=120",LOG_SRC[g_sub[V_LOGS]]); g_cache[s]=api_get(p); }
    else if (s==V_TOOLS) { g_cache[s]=api_get("/api/actions"); if(g_volume){cJSON_Delete(g_volume);g_volume=NULL;} g_volume=api_get("/api/volume"); }
    else if (s==V_MEDIA) g_cache[s]=api_get("/api/media");
    else if (s==V_STORAGE) g_cache[s]=api_get("/api/storage");
    else if (s==V_HOME) refresh_health();
}

/* =================================================================== HOME */
static int home_nalert(void){ cJSON *d=api_data(g_health),*it=d?J(d,"items"):NULL; return (it&&cJSON_IsArray(it))?cJSON_GetArraySize(it):0; }
static const char *HOME_CARDS[]={"STATUS","PROCS","NET","SVC","AJUSTES"};
static const int  HOME_CARD_V[]={V_STATUS,V_PROCS,V_NET,V_SVC,V_TOOLS};
static void home_render(int focus){
    int x=cx(),y=cy0(),w=cw();
    cJSON *d=api_data(g_health);
    const char *lvl=d?Js(d,"level","ok"):"ok";
    int L=!strcmp(lvl,"crit")?LVL_CRIT:!strcmp(lvl,"warn")?LVL_WARN:LVL_OK;
    char line[120]; snprintf(line,sizeof line,"%s  agente %s  %s%s",L==LVL_CRIT?"SYS CRIT":L==LVL_WARN?"SYS WARN":"SYS OK",AGENT_OK?"ON":"OFF",STATUS.has_ip?"rede ":"sem rede",STATUS.has_ip?STATUS.ip:"");
    fb_text(x,y,line,ui_sev_color(L),PAL.bg,0); y+=ROWH;
    cJSON *sm=d?J(d,"summary"):NULL; if(sm){char l2[64];snprintf(l2,sizeof l2,"systemd %s",Js(sm,"systemd","?"));fb_text(x,y,l2,PAL.muted,PAL.bg,0);y+=ROWH;}
    int fi=0; cJSON *items=d?J(d,"items"):NULL,*it;
    if(items&&cJSON_IsArray(items)) cJSON_ArrayForEach(it,items){ int sel=(focus==fi); char r[120]; snprintf(r,sizeof r,"! %s",Js(it,"label","")); if(sel)fb_fill(x-2,y-2,w,ROWH,PAL.line2); fb_text_clip(x,y,r,w/FB_FONT_W,PAL.warn,PAL.bg,0); y+=ROWH; fi++; }
    y+=4;
    int tw=(w-18)/4,th=56; char v[24];
    snprintf(v,sizeof v,"%d%%",STATUS.has_cpu?(int)(STATUS.cpu+0.5):0); ui_tile(x,y,tw,th,"CPU",v,NULL,STATUS.has_cpu?(int)STATUS.cpu:-1,lvl_pct(STATUS.cpu));
    snprintf(v,sizeof v,"%d%%",STATUS.has_mem?(int)(STATUS.mem_pct+0.5):0); ui_tile(x+(tw+6),y,tw,th,"RAM",v,NULL,STATUS.has_mem?(int)STATUS.mem_pct:-1,lvl_pct(STATUS.mem_pct));
    if(STATUS.temp>=0)snprintf(v,sizeof v,"%dC",STATUS.temp);else snprintf(v,sizeof v,"-"); ui_tile(x+2*(tw+6),y,tw,th,"TEMP",v,lvl_temp(STATUS.temp)==LVL_OK?"ok":"alto",-1,lvl_temp(STATUS.temp));
    int bp=STATUS.bat_trust_low&&STATUS.bat_est>=0?STATUS.bat_est:STATUS.bat_pct;
    if(STATUS.bat_ac==1)snprintf(v,sizeof v,"AC");else if(bp>=0)snprintf(v,sizeof v,"%d%%",bp);else snprintf(v,sizeof v,"-");
    char bsub[16]; snprintf(bsub,sizeof bsub,"%.2fV",STATUS.bat_volt); ui_tile(x+3*(tw+6),y,tw,th,"BAT",v,STATUS.bat_volt>0?bsub:NULL,-1,LVL_OK);
    y+=th+8;
    int na=home_nalert();
    for(int i=0;i<5;i++){ int sel=(focus==na+i),ry=y+i*ROWH; if(ry+ROWH>cy1())break; if(sel)fb_fill(x-2,ry-2,w,ROWH,PAL.line2); fb_text(x,ry,">",PAL.accent,PAL.bg,0); fb_text(x+FB_FONT_W*2,ry,HOME_CARDS[i],sel?PAL.accent:PAL.fg,sel?PAL.line2:PAL.bg,0); }
}
static int home_nfocus(void){ return home_nalert()+5; }
static void home_activate(int focus){
    int na=home_nalert();
    if(focus<na){ cJSON *d=api_data(g_health),*items=d?J(d,"items"):NULL,*it=items?cJSON_GetArrayItem(items,focus):NULL; const char *tg=it?Js(it,"target",""):""; int dst=!strcmp(tg,"systemd")?V_SVC:!strcmp(tg,"status")?V_STATUS:!strcmp(tg,"network")?V_NET:-1; if(dst>=0){g_section=dst;view_enter(dst);} return; }
    int i=focus-na; if(i>=0&&i<5){ g_section=HOME_CARD_V[i]; view_enter(g_section); g_overlay=OV_NONE; }
}

/* =================================================================== STATUS */
static void status_render(int focus){
    (void)focus; int x=cx(),y=cy0(),w=cw(),sub=g_sub[V_STATUS]; char t[40],v[40];
    snprintf(t,sizeof t,"STATUS . %s",SUB_STATUS[sub]); ui_title(x,y,t); y+=ROWH; ui_subbar(x,y,SUB_STATUS,3,sub); y+=ROWH+2;
    if(sub==0){ int tw=(w-18)/4,th=52;
        snprintf(v,sizeof v,"%d%%",STATUS.has_cpu?(int)STATUS.cpu:0); ui_tile(x,y,tw,th,"CPU",v,NULL,STATUS.has_cpu?(int)STATUS.cpu:-1,lvl_pct(STATUS.cpu));
        snprintf(v,sizeof v,"%d%%",(int)STATUS.mem_pct); ui_tile(x+(tw+6),y,tw,th,"RAM",v,NULL,(int)STATUS.mem_pct,lvl_pct(STATUS.mem_pct));
        if(STATUS.temp>=0)snprintf(v,sizeof v,"%dC",STATUS.temp);else snprintf(v,sizeof v,"-"); ui_tile(x+2*(tw+6),y,tw,th,"TEMP",v,NULL,-1,lvl_temp(STATUS.temp));
        snprintf(v,sizeof v,"%.2f",STATUS.load1); char ls[16];snprintf(ls,sizeof ls,"%d cores",STATUS.cores); ui_tile(x+3*(tw+6),y,tw,th,"LOAD",v,ls,-1,LVL_OK); y+=th+8;
        char mem[40];snprintf(mem,sizeof mem,"%d / %d MB",STATUS.mem_used,STATUS.mem_total); y=ui_kv(x,y,w,"MEM",mem);
        char up[32];uptime_str(STATUS.uptime,up,sizeof up); y=ui_kv(x,y,w,"UPTIME",up);
        y=ui_kv(x,y,w,"REDE",STATUS.has_ip?STATUS.ip:"sem rede");
    } else if(sub==1){
        snprintf(v,sizeof v,"%d%% (%s)",STATUS.bat_est,STATUS.bat_ac==1?"carregando":"estimado"); y=ui_kv(x,y,w,"BATERIA",v);
        snprintf(v,sizeof v,"%.2fV  %d mA",STATUS.bat_volt,STATUS.bat_curr); y=ui_kv(x,y,w,"TENSAO",v);
        snprintf(v,sizeof v,"%.2fV  %s",STATUS.bat_ocv,STATUS.bat_status); y=ui_kv(x,y,w,"OCV",v);
        snprintf(v,sizeof v,"%d%% capacity%s",STATUS.bat_pct,STATUS.bat_trust_low?" . instavel":""); y=ui_kv(x,y,w,"RAW (rk817)",v);
        if(STATUS.bright_pct>=0)y=ui_gauge(x,y,w,"BRILHO",STATUS.bright_pct)+2;
        if(STATUS.temp>=0){snprintf(v,sizeof v,"%d C",STATUS.temp);y=ui_kv(x,y,w,"TEMP",v);}
    } else {
        if(h_len>1){ char sp[HN+1];
            ui_sparkline(sp,sizeof sp,h_cpu,h_len);y=ui_kv(x,y,w,"CPU",sp);
            ui_sparkline(sp,sizeof sp,h_ram,h_len);y=ui_kv(x,y,w,"RAM",sp);
            if(STATUS.temp>=0){ui_sparkline(sp,sizeof sp,h_temp,h_len);y=ui_kv(x,y,w,"TEMP",sp);}
            fb_text(x,y+4,"tendencia da sessao (~2 min)",PAL.muted,PAL.bg,0);
        } else fb_text(x,y,"coletando historico...",PAL.muted,PAL.bg,0);
    }
}

/* =================================================================== DEVICE */
static void device_render(int focus){
    (void)focus; int x=cx(),y=cy0(),w=cw(),sub=g_sub[V_DEVICE]; char t[40],v[80];
    snprintf(t,sizeof t,"DEVICE . %s",SUB_DEVICE[sub]); ui_title(x,y,t); y+=ROWH; ui_subbar(x,y,SUB_DEVICE,5,sub); y+=ROWH+2;
    cJSON *d=api_data(g_cache[V_DEVICE]); if(!d){fb_text(x,y,AGENT_OK?"carregando...":"agente offline",PAL.muted,PAL.bg,0);return;}
    cJSON *id=J(d,"identity"),*hw=J(d,"hardware"),*k=J(d,"kernel"),*dp=J(d,"display"),*ip=J(d,"input");
    if(sub==0&&id){ y=ui_kv(x,y,w,"HOST",Js(id,"hostname","-")); y=ui_kv(x,y,w,"DISTRO",Js(id,"distro","-")); y=ui_kv(x,y,w,"KERNEL",Js(id,"kernel","-")); y=ui_kv(x,y,w,"ARCH",Js(id,"arch","-")); char up[32];uptime_str(Jn(id,"uptime_s",0),up,sizeof up);y=ui_kv(x,y,w,"UPTIME",up); y=ui_kv(x,y,w,"TZ",Js(id,"timezone","-")); y=ui_kv(x,y,w,"ROOTFS",Js(id,"rootfs","-")); }
    else if(sub==1&&hw){ y=ui_kv(x,y,w,"SoC",Js(hw,"soc","-")); snprintf(v,sizeof v,"%d",(int)Jn(hw,"cores",0));y=ui_kv(x,y,w,"CORES",v); y=ui_kv(x,y,w,"GPU",Js(hw,"gpu","-")); cJSON *mem=J(hw,"mem"); if(mem){snprintf(v,sizeof v,"%d MB (livre %d)",(int)Jn(mem,"total_mb",0),(int)Jn(mem,"available_mb",0));y=ui_kv(x,y,w,"RAM",v);} cJSON *fr=J(hw,"freq"),*f0=fr&&cJSON_IsArray(fr)?cJSON_GetArrayItem(fr,0):NULL; if(f0){snprintf(v,sizeof v,"%d MHz . %s",(int)Jn(f0,"cur_mhz",0),Js(f0,"governor","-"));y=ui_kv(x,y,w,"FREQ0",v);} }
    else if(sub==2&&dp){ cJSON *fbx=J(dp,"framebuffer"),*bl=J(dp,"backlight"); if(fbx){snprintf(v,sizeof v,"%s @%dbpp",Js(fbx,"virtual_size","-"),(int)Jn(fbx,"bits_per_pixel",0));y=ui_kv(x,y,w,"FB",v);} if(bl){snprintf(v,sizeof v,"%d%% (%d/%d)",(int)Jn(bl,"pct",-1),(int)Jn(bl,"cur",0),(int)Jn(bl,"max",0));y=ui_kv(x,y,w,"LUZ",v);} y=ui_kv(x,y,w,"PAINEL",Js(dp,"panel","-")); }
    else if(sub==3){ if(k){y=ui_kv(x,y,w,"VERSION",Js(k,"version","-")); y=ui_kv(x,y,w,"MODELO DT",Js(k,"dtb_model",hw?Js(hw,"model","-"):"-")); snprintf(v,sizeof v,"%d",(int)Jn(k,"modules_count",0));y=ui_kv(x,y,w,"MODULOS",v);} fb_text(x,y+4,"detalhes em KERNEL (FN)",PAL.muted,PAL.bg,0); }
    else if(sub==4&&ip){ cJSON *devs=J(ip,"devices"),*dv; if(devs)cJSON_ArrayForEach(dv,devs){char lbl[16];snprintf(lbl,sizeof lbl,"%s%s",(int)Jn(dv,"joypad",0)?"* ":"",Js(dv,"event","?"));y=ui_kv(x,y,w,lbl,Js(dv,"name","-"));if(y>cy1()-ROWH)break;} }
}

/* =================================================================== NET */
static const char *NET_K[]={"wifi-up","wifi-reconnect"}; static const char *NET_L[]={"conectar","reconectar"};
static void net_render(int focus){
    int x=cx(),y=cy0(),w=cw(); ui_title(x,y,"REDE"); y+=ROWH+2;
    cJSON *d=api_data(g_cache[V_NET]); if(!d){fb_text(x,y,AGENT_OK?"carregando...":"agente offline",PAL.muted,PAL.bg,0);return;}
    const char *ip=STATUS.has_ip?STATUS.ip:NULL,*gw=Js(d,"gateway",""); int online=ip&&gw[0];
    fb_text(x,y+2,"REDE",PAL.fg_dim,PAL.bg,0); ui_badge(x+fb_text_w("REDE  "),y,online?"ONLINE":"OFF",online?LVL_OK:LVL_WARN); y+=ROWH+2;
    char ifaces[80]=""; cJSON *ifs=J(d,"interfaces"),*it;
    if(ifs)cJSON_ArrayForEach(it,ifs){const char*nm=Js(it,"name","");if(!strcmp(nm,"lo"))continue;if(ifaces[0])strncat(ifaces,", ",sizeof ifaces-strlen(ifaces)-1);strncat(ifaces,nm,sizeof ifaces-strlen(ifaces)-1);}
    y=ui_kv(x,y,w,"INTERFACE",ifaces[0]?ifaces:"-"); y=ui_kv(x,y,w,"IP",ip?ip:"-"); y=ui_kv(x,y,w,"GATEWAY",gw[0]?gw:"-");
    char dnss[80]=""; cJSON *dns=J(d,"dns"),*dn; if(dns)cJSON_ArrayForEach(dn,dns){const char*s=dn->valuestring;if(!s)continue;if(dnss[0])strncat(dnss,", ",sizeof dnss-strlen(dnss)-1);strncat(dnss,s,sizeof dnss-strlen(dnss)-1);}
    y=ui_kv(x,y,w,"DNS",dnss[0]?dnss:"-"); y=ui_kv(x,y,w,"SSID",Js(d,"ssid","(n/a)")); y+=4;
    for(int i=0;i<2;i++){ int sel=(focus==i),ry=y+i*ROWH; if(sel)fb_fill(x-2,ry-2,w,ROWH,PAL.line2); fb_text(x,ry,"A",PAL.btn_a,sel?PAL.line2:PAL.bg,0); fb_text(x+FB_FONT_W*2,ry,NET_L[i],sel?PAL.accent:PAL.fg,sel?PAL.line2:PAL.bg,0); }
    y+=2*ROWH+2; fb_text(x,y,"X: buscar redes   Y: conexoes (ss)",PAL.muted,PAL.bg,0); y+=ROWH;
    if(net_mode){ fb_text(x,y,net_mode==1?"REDES VISIVEIS:":"CONEXOES:",PAL.fg_dim,PAL.bg,0); y+=ROWH;
        const char*o=g_net_extra?g_net_extra:"(...)"; int cols=w/FB_FONT_W,row=0,maxrow=(cy1()-y)/FB_FONT_H;
        for(const char*p=o;*p&&row<maxrow;){char buf[200];int bl=0;while(*p&&*p!='\n'&&bl<cols&&bl<199)buf[bl++]=*p++;buf[bl]=0;if(*p=='\n')p++;else while(*p&&*p!='\n')p++;fb_text(x,y+row*FB_FONT_H,buf,PAL.fg,PAL.bg,0);row++;} }
}
static int net_nfocus(void){ return 2; }
static void net_activate(int focus){ if(focus>=0&&focus<2){ post_action(NET_K[focus]); view_enter(V_NET); } }
static int net_back(void){ if(net_mode){net_mode=0; if(g_net_extra){free(g_net_extra);g_net_extra=NULL;} return 1;} return 0; }
static void net_set_extra(const char *txt){ if(g_net_extra)free(g_net_extra); g_net_extra=strdup(txt?txt:""); }
static void net_key(int b){
    if(b==CDB_X){ /* scan de SSIDs */
        char*r=http_post("/api/network/wifi/scan","{}"); cJSON*root=r?cJSON_Parse(r):NULL; if(r)free(r);
        cJSON*d=api_data(root),*ss=d?J(d,"ssids"):NULL; char buf[1024]="";
        if(ss&&cJSON_IsArray(ss)){cJSON*s;cJSON_ArrayForEach(s,ss){if(s->valuestring){strncat(buf,s->valuestring,sizeof buf-strlen(buf)-2);strncat(buf,"\n",sizeof buf-strlen(buf)-1);}}}
        net_set_extra(buf[0]?buf:"(nenhuma rede)"); net_mode=1; if(root)cJSON_Delete(root);
    } else if(b==CDB_Y){ /* conexões (ss) */
        cJSON*root=api_get("/api/network/connections?limit=40"),*d=api_data(root),*rows=d?J(d,"rows"):NULL; char buf[2048]="";
        if(rows&&cJSON_IsArray(rows)){cJSON*ln;cJSON_ArrayForEach(ln,rows){if(ln->valuestring){strncat(buf,ln->valuestring,sizeof buf-strlen(buf)-2);strncat(buf,"\n",sizeof buf-strlen(buf)-1);}}}
        net_set_extra(buf[0]?buf:"(sem conexoes)"); net_mode=2; if(root)cJSON_Delete(root);
    }
}

/* =================================================================== LOGS (list+detail) */
static char ls_line[256]; static int ls_mode=0;
static int logs_visible(char out[][200], int maxn){
    cJSON *d=api_data(g_cache[V_LOGS]); const char *lines=d?Js(d,"lines",""):NULL; if(!lines)return 0;
    /* coleta todas, devolve as últimas maxn */
    int total=1; for(const char*q=lines;*q;q++) if(*q=='\n')total++;
    int skip=total-maxn; if(skip<0)skip=0; const char*p=lines; int idx=0;
    while(*p&&idx<skip){if(*p=='\n')idx++;p++;}
    int n=0; while(*p&&n<maxn){ int bl=0; while(*p&&*p!='\n'&&bl<199)out[n][bl++]=*p++; out[n][bl]=0; if(*p=='\n')p++; n++; }
    return n;
}
static int logs_rows(void){ return (cy1()-(cy0()+3*ROWH+2))/FB_FONT_H; }
static void logs_render(int focus){
    int x=cx(),y=cy0(),w=cw(),sub=g_sub[V_LOGS]; char t[40];
    if(ls_mode==1){ ui_title(x,y,"LOG . detalhe"); y+=ROWH; char *m=ls_line; char ts[80]=""; char *sp=strchr(m,']'); if(m[0]=='['&&sp){int L=sp-m-1;if(L>0&&L<79){memcpy(ts,m+1,L);ts[L]=0;}m=sp+1;while(*m==' ')m++;} if(ts[0])y=ui_kv(x,y,w,"QUANDO",ts); fb_text(x,y,"MENSAGEM",PAL.fg_dim,PAL.bg,0);y+=ROWH; int cols=w/FB_FONT_W,row=0; for(char*q=m;*q&&row<10;){char buf[200];int bl=0;while(*q&&bl<cols&&bl<199)buf[bl++]=*q++;buf[bl]=0;fb_text(x,y+row*FB_FONT_H,buf,PAL.fg,PAL.bg,0);row++;} return; }
    snprintf(t,sizeof t,"LOGS . %s",LOG_SRC[sub]); ui_title(x,y,t); y+=ROWH; ui_subbar(x,y,LOG_SRC,5,sub); y+=ROWH;
    { char sv[40]; snprintf(sv,sizeof sv,"X: severidade [%s]",LOG_SEV[ls_sev]); fb_text(x,y,sv,ls_sev?PAL.warn:PAL.muted,PAL.bg,0); y+=ROWH; }
    static char buf[40][200]; int maxr=logs_rows(); if(maxr>40)maxr=40; int n=logs_visible(buf,maxr);
    if(!n){fb_text(x,y,AGENT_OK?"(sem saida)":"agente offline",PAL.muted,PAL.bg,0);return;}
    int cols=w/FB_FONT_W;
    for(int i=0;i<n;i++){ int sel=(focus==i); const char*b=buf[i]; unsigned long c=PAL.fg_dim;
        if(strstr(b,"error")||strstr(b,"fail")||strstr(b,"Error")||strstr(b,"panic"))c=PAL.crit; else if(strstr(b,"warn")||strstr(b,"Warn"))c=PAL.warn;
        if(sel)fb_fill(x-2,y+i*FB_FONT_H-1,w,FB_FONT_H,PAL.line2);
        fb_text_clip(x,y+i*FB_FONT_H,b,cols,c,sel?PAL.line2:PAL.bg,0); }
}
static int logs_nfocus(void){ if(ls_mode==1)return 0; static char buf[40][200]; int maxr=logs_rows(); if(maxr>40)maxr=40; return logs_visible(buf,maxr); }
static void logs_activate(int focus){ if(ls_mode==1)return; static char buf[40][200]; int maxr=logs_rows();if(maxr>40)maxr=40; int n=logs_visible(buf,maxr); if(focus>=0&&focus<n){snprintf(ls_line,sizeof ls_line,"%s",buf[focus]);ls_mode=1;} }
static int logs_back(void){ if(ls_mode==1){ls_mode=0;return 1;} return 0; }
static void logs_key(int b){ if(ls_mode==1)return; if(b==CDB_X){ ls_sev=(ls_sev+1)%4; g_focus[V_LOGS]=0; view_enter(V_LOGS); } }

/* =================================================================== PROCS */
static int proc_filter_ok(cJSON *p,int f){ const char*st=Js(p,"state","");const char*comm=Js(p,"comm","");const char*cmd=Js(p,"cmd","");double cpu=Jn(p,"cpu",0);
    if(f==0) return cpu>0||!strcmp(st,"R");                       /* ativos */
    if(f==1) return 1;                                            /* all */
    if(f==2) return strstr(comm,"node")!=NULL||strstr(comm,"Node")!=NULL;
    if(f==3) return strstr(comm,"chrom")!=NULL;
    if(f==4) return strstr(cmd,"cyberdeck")!=NULL;
    if(f==5) return !strcmp(st,"R");
    if(f==6) return !strcmp(st,"Z");
    return 1;
}
static const char *PR_FILT[]={"ativos","all","node","chromium","cyberdeck","running","zombie"};
/* devolve ponteiros dos itens filtrados+ordenados na página atual; retorna count total filtrado */
static int proc_collect(cJSON **outpage,int *npage){
    cJSON *d=api_data(g_cache[V_PROCS]),*arr=d?J(d,"processes"):NULL; *npage=0;
    if(!arr||!cJSON_IsArray(arr))return 0;
    int N=cJSON_GetArraySize(arr);
    static cJSON *filt[600]; int nf=0;
    for(int i=0;i<N&&nf<600;i++){cJSON*p=cJSON_GetArrayItem(arr,i);if(proc_filter_ok(p,pr_filter))filt[nf++]=p;}
    /* ordena (simples: seleção por chave) — N pequeno o suficiente */
    for(int i=0;i<nf-1;i++)for(int j=i+1;j<nf;j++){ double a,b; cJSON*A=filt[i],*B=filt[j]; int sw=0;
        if(pr_sort==0){a=Jn(A,"cpu",0);b=Jn(B,"cpu",0);sw=b>a;} else if(pr_sort==1){a=Jn(A,"rss_mb",0);b=Jn(B,"rss_mb",0);sw=b>a;}
        else if(pr_sort==2){a=Jn(A,"pid",0);b=Jn(B,"pid",0);sw=a>b;} else {sw=strcmp(Js(A,"comm",""),Js(B,"comm",""))>0;}
        if(sw){cJSON*t=filt[i];filt[i]=filt[j];filt[j]=t;} }
    int tot=pg_count(nf); pr_page=clampi(pr_page,0,tot-1);
    int start=pr_page*PAGE,cnt=0;
    for(int i=start;i<nf&&cnt<PAGE;i++)outpage[cnt++]=filt[i];
    *npage=cnt; return nf;
}
static void procs_render(int focus){
    int x=cx(),y=cy0(),w=cw();
    if(pr_mode==1){ cJSON *d=api_data(g_detail); char t[40];snprintf(t,sizeof t,"PID %d",pr_pid);ui_title(x,y,t);y+=ROWH+2;
        if(!d){fb_text(x,y,"carregando...",PAL.muted,PAL.bg,0);return;} char v[80];
        y=ui_kv(x,y,w,"COMM",Js(d,"comm","-")); y=ui_kv(x,y,w,"ESTADO",Js(d,"state","-")); y=ui_kv(x,y,w,"USER",Js(d,"user","-"));
        snprintf(v,sizeof v,"%d",(int)Jn(d,"ppid",0));y=ui_kv(x,y,w,"PPID",v); snprintf(v,sizeof v,"%d",(int)Jn(d,"threads",0));y=ui_kv(x,y,w,"THREADS",v);
        y=ui_kv(x,y,w,"RSS",Js(d,"vm_rss","-")); y=ui_kv(x,y,w,"EXE",Js(d,"exe","-"));
        fb_text(x,y,"CMDLINE",PAL.fg_dim,PAL.bg,0);y+=ROWH; fb_text_clip(x,y,Js(d,"cmdline","-"),w/FB_FONT_W,PAL.fg,PAL.bg,0);y+=ROWH+4;
        for(int i=0;i<2;i++){int sel=(focus==i),ry=y+i*ROWH;const char*lb=i?"SIGKILL":"SIGTERM";if(sel)fb_fill(x-2,ry-2,w,ROWH,PAL.line2);fb_text(x,ry,"A",PAL.btn_a,sel?PAL.line2:PAL.bg,0);fb_text(x+FB_FONT_W*2,ry,lb,sel?PAL.accent:PAL.fg,sel?PAL.line2:PAL.bg,0);} return; }
    ui_title(x,y,"PROCESSOS"); y+=ROWH;
    cJSON *d=api_data(g_cache[V_PROCS]),*sm=d?J(d,"summary"):NULL;
    if(sm){char s[100];snprintf(s,sizeof s,"%d proc . run %d . zumbi %d . ~%d%% cpu",(int)Jn(sm,"total",0),(int)Jn(sm,"running",0),(int)Jn(sm,"zombie",0),(int)Jn(sm,"cpu_total",0));fb_text(x,y,s,PAL.fg_dim,PAL.bg,0);}
    y+=ROWH;
    char ctl[90];snprintf(ctl,sizeof ctl,"X filtro:%s  Y sort:%s  (L1/R1 pag)",PR_FILT[pr_filter],PR_SORT[pr_sort]); fb_text(x,y,ctl,PAL.muted,PAL.bg,0); y+=ROWH+2;
    cJSON *page[PAGE]; int np; int tot=proc_collect(page,&np); int npg=pg_count(/*n*/0); (void)tot;(void)npg;
    fb_text(x,y,"PID",PAL.fg_dim,PAL.bg,0); fb_text(x+FB_FONT_W*7,y,"CMD",PAL.fg_dim,PAL.bg,0); fb_text(x+w-FB_FONT_W*10,y,"CPU  RSS",PAL.fg_dim,PAL.bg,0); y+=ROWH;
    for(int i=0;i<np;i++){cJSON*p=page[i];int sel=(focus==i);int ry=y+i*ROWH;if(sel)fb_fill(x-2,ry-2,w,ROWH,PAL.line2);
        char pid[12];snprintf(pid,sizeof pid,"%d",(int)Jn(p,"pid",0)); fb_text(x,ry,pid,PAL.fg,sel?PAL.line2:PAL.bg,0);
        fb_text_clip(x+FB_FONT_W*7,ry,Js(p,"comm","?"),(w/FB_FONT_W)-18,sel?PAL.accent:PAL.fg,sel?PAL.line2:PAL.bg,0);
        char rt[16];snprintf(rt,sizeof rt,"%d%% %dM",(int)Jn(p,"cpu",0),(int)Jn(p,"rss_mb",0)); fb_text(x+w-fb_text_w(rt),ry,rt,PAL.fg_dim,sel?PAL.line2:PAL.bg,0);}
    if(!np)fb_text(x,y,"(nenhum processo neste filtro)",PAL.muted,PAL.bg,0);
}
static int procs_nfocus(void){ if(pr_mode==1)return 2; cJSON*page[PAGE];int np;proc_collect(page,&np);return np; }
static void procs_activate(int focus){
    if(pr_mode==1){ char sig[12]; snprintf(sig,sizeof sig,"%s",focus?"SIGKILL":"SIGTERM"); char pid[12];snprintf(pid,sizeof pid,"%d",pr_pid); char lbl[40];snprintf(lbl,sizeof lbl,"%s PID %d",sig,pr_pid); confirm_open(CF_SIG,sig,pid,lbl); return; }
    cJSON*page[PAGE];int np;proc_collect(page,&np); if(focus<0||focus>=np)return;
    pr_pid=(int)Jn(page[focus],"pid",0); detail_free(); char p[64];snprintf(p,sizeof p,"/api/processes/%d",pr_pid); g_detail=api_get(p); pr_mode=1; g_focus[V_PROCS]=0;
}
static int procs_back(void){ if(pr_mode==1){pr_mode=0;detail_free();return 1;} return 0; }
static int procs_page(int dir){ if(pr_mode==1)return 0; pr_page+=dir; if(pr_page<0)pr_page=0; g_focus[V_PROCS]=0; return 1; }
static void procs_key(int b){ if(pr_mode==1)return; if(b==CDB_X){pr_filter=(pr_filter+1)%7;} else if(b==CDB_Y){pr_sort=(pr_sort+1)%4;} pr_page=0; g_focus[V_PROCS]=0; }

/* =================================================================== FS */
static const char *fs_type(cJSON *e){ const char*t=Js(e,"type","");
    if(!strcmp(t,"dir"))return "DIR"; if(!strcmp(t,"symlink"))return "LINK"; if(!strcmp(t,"file"))return "FILE"; if(!strcmp(t,"block"))return "BLK"; if(!strcmp(t,"char"))return "CHR"; return "?"; }
static int fs_count(cJSON **outpage,int *np,int *hasparent){
    cJSON *d=api_data(g_cache[V_FS]),*arr=d?J(d,"entries"):NULL; *np=0; *hasparent=0;
    if(d&&!cJSON_IsNull(J(d,"parent")))*hasparent=1;
    if(!arr||!cJSON_IsArray(arr))return 0;
    int N=cJSON_GetArraySize(arr); int tot=pg_count(N); fs_page=clampi(fs_page,0,tot-1);
    int start=fs_page*PAGE,cnt=0; for(int i=start;i<N&&cnt<PAGE;i++)outpage[cnt++]=cJSON_GetArrayItem(arr,i); *np=cnt; return N;
}
static void fs_render(int focus){
    int x=cx(),y=cy0(),w=cw();
    if(fs_mode==1){ char t[80];snprintf(t,sizeof t,"FILE %s",fs_path);ui_title(x,y,t);y+=ROWH+2; cJSON *d=api_data(g_detail);
        if(!d){fb_text(x,y,"carregando...",PAL.muted,PAL.bg,0);return;}
        if(strcmp(Js(d,"type",""),"text")){fb_text(x,y,Js(d,"message","nao e texto"),PAL.muted,PAL.bg,0);return;}
        if((int)Jn(d,"truncated",0)){fb_text(x,y,"(arquivo truncado)",PAL.warn,PAL.bg,0);y+=ROWH;}
        const char*c=Js(d,"content","(vazio)");int cols=w/FB_FONT_W,row=0,maxrow=(cy1()-y)/FB_FONT_H;
        for(const char*p=c;*p&&row<maxrow;){char buf[200];int bl=0;while(*p&&*p!='\n'&&bl<cols&&bl<199)buf[bl++]=*p++;buf[bl]=0;if(*p=='\n')p++;else while(*p&&*p!='\n')p++;fb_text(x,y+row*FB_FONT_H,buf,PAL.fg,PAL.bg,0);row++;} return; }
    char t[80];snprintf(t,sizeof t,"FS  %s",fs_path);ui_title(x,y,t);y+=ROWH+2;
    cJSON*page[PAGE];int np,hp; int N=fs_count(page,&np,&hp); (void)N;
    int fi=0;
    if(hp){int sel=(focus==fi);if(sel)fb_fill(x-2,y-2,w,ROWH,PAL.line2);fb_text(x,y,"UP",PAL.accent,sel?PAL.line2:PAL.bg,0);fb_text(x+FB_FONT_W*6,y,"..",sel?PAL.accent:PAL.fg,sel?PAL.line2:PAL.bg,0);y+=ROWH;fi++;}
    for(int i=0;i<np;i++){cJSON*e=page[i];int sel=(focus==fi);if(sel)fb_fill(x-2,y-2,w,ROWH,PAL.line2);
        fb_text(x,y,fs_type(e),PAL.fg_dim,sel?PAL.line2:PAL.bg,0);
        fb_text_clip(x+FB_FONT_W*6,y,Js(e,"name","?"),(w/FB_FONT_W)-16,sel?PAL.accent:PAL.fg,sel?PAL.line2:PAL.bg,0);
        const char*md=Js(e,"mode","");fb_text(x+w-fb_text_w(md),y,md,PAL.muted,sel?PAL.line2:PAL.bg,0);
        y+=ROWH;fi++;}
    if(!np&&!hp)fb_text(x,y,AGENT_OK?"(vazio)":"agente offline",PAL.muted,PAL.bg,0);
}
static int fs_nfocus(void){ if(fs_mode==1)return 0; cJSON*page[PAGE];int np,hp;fs_count(page,&np,&hp);return np+(hp?1:0); }
static void fs_nav(const char *p){ snprintf(fs_path,sizeof fs_path,"%s",p); fs_mode=0; fs_page=0; g_focus[V_FS]=0; view_enter(V_FS); }
static void fs_activate(int focus){
    if(fs_mode==1)return; cJSON*page[PAGE];int np,hp;fs_count(page,&np,&hp);
    int idx=focus;
    if(hp){ if(focus==0){ cJSON*d=api_data(g_cache[V_FS]); const char*par=Js(d,"parent",NULL); if(par)fs_nav(par); return; } idx=focus-1; }
    if(idx<0||idx>=np)return; cJSON*e=page[idx]; const char*t=Js(e,"type",""),*nm=Js(e,"name","");
    char full[600]; snprintf(full,sizeof full,"%s%s%s",strcmp(fs_path,"/")?fs_path:"","/",nm);
    if(!strcmp(t,"dir")||!strcmp(t,"symlink")) fs_nav(full);
    else if(!strcmp(t,"file")){ snprintf(fs_path,sizeof fs_path,"%s",full); detail_free(); char p[700];snprintf(p,sizeof p,"/api/fs/read?path=%s",full); g_detail=api_get(p); fs_mode=1; }
}
static int fs_back(void){
    if(fs_mode==1){ fs_mode=0; char*sl=strrchr(fs_path,'/'); if(sl&&sl!=fs_path)*sl=0; else strcpy(fs_path,"/"); return 1; }
    if(strcmp(fs_path,"/")){ char p[512];snprintf(p,sizeof p,"%s",fs_path); char*sl=strrchr(p,'/'); if(sl&&sl!=p)*sl=0; else strcpy(p,"/"); fs_nav(p); return 1; }
    return 0;
}
static int fs_page_fn(int dir){ if(fs_mode==1)return 0; fs_page+=dir; if(fs_page<0)fs_page=0; g_focus[V_FS]=0; return 1; }
/* X: cicla pelos atalhos (bookmarks) do agente */
static void fs_key(int b){
    if(b!=CDB_X||fs_mode==1)return;
    static int bm=0;
    cJSON*root=api_get("/api/fs/bookmarks"),*d=api_data(root),*arr=d?J(d,"bookmarks"):NULL;
    if(arr&&cJSON_IsArray(arr)){ int n=cJSON_GetArraySize(arr); if(n){ cJSON*it=cJSON_GetArrayItem(arr,bm%n); bm++; if(it&&it->valuestring){ if(root)cJSON_Delete(root); fs_nav(it->valuestring); return; } } }
    if(root)cJSON_Delete(root);
}

/* =================================================================== SVC */
static int sd_failed(cJSON *s){ return !strcmp(Js(s,"active",""),"failed")||!strcmp(Js(s,"sub",""),"failed"); }
static int sd_filter_ok(cJSON *s,int f){ if(f==1)return !strcmp(Js(s,"sub",""),"running"); if(f==2)return sd_failed(s); if(f==3)return strstr(Js(s,"unit",""),"cyberdeck")!=NULL; return 1; }
static int svc_collect(cJSON **outpage,int *np){
    cJSON *d=api_data(g_cache[V_SVC]),*arr=d?J(d,"services"):NULL; *np=0; if(!arr||!cJSON_IsArray(arr))return 0;
    int N=cJSON_GetArraySize(arr); static cJSON*filt[800];int nf=0;
    for(int i=0;i<N&&nf<800;i++){cJSON*s=cJSON_GetArrayItem(arr,i);if(sd_filter_ok(s,sv_filter))filt[nf++]=s;}
    /* falhas no topo, depois running, depois resto */
    for(int i=0;i<nf-1;i++)for(int j=i+1;j<nf;j++){int ri=sd_failed(filt[i])?0:!strcmp(Js(filt[i],"sub",""),"running")?1:2;int rj=sd_failed(filt[j])?0:!strcmp(Js(filt[j],"sub",""),"running")?1:2;if(rj<ri){cJSON*t=filt[i];filt[i]=filt[j];filt[j]=t;}}
    int tot=pg_count(nf); sv_page=clampi(sv_page,0,tot-1); int start=sv_page*PAGE,cnt=0;
    for(int i=start;i<nf&&cnt<PAGE;i++)outpage[cnt++]=filt[i]; *np=cnt; return nf;
}
static void svc_render(int focus){
    int x=cx(),y=cy0(),w=cw();
    if(sv_mode==2){ char t[90];snprintf(t,sizeof t,"SVC LOGS %s",sv_unit);ui_title(x,y,t);y+=ROWH+2;
        const char*o=g_svc_log?g_svc_log:"(sem journal)";int cols=w/FB_FONT_W,row=0,maxrow=(cy1()-y)/FB_FONT_H;
        for(const char*p=o;*p&&row<maxrow;){char buf[200];int bl=0;while(*p&&*p!='\n'&&bl<cols&&bl<199)buf[bl++]=*p++;buf[bl]=0;if(*p=='\n')p++;else while(*p&&*p!='\n')p++;unsigned long cc=(strstr(buf,"error")||strstr(buf,"fail"))?PAL.crit:(strstr(buf,"warn"))?PAL.warn:PAL.fg_dim;fb_text(x,y+row*FB_FONT_H,buf,cc,PAL.bg,0);row++;} return; }
    if(sv_mode==1){ char t[80];snprintf(t,sizeof t,"SVC %s",sv_unit);ui_title(x,y,t);y+=ROWH+2; cJSON*d=api_data(g_detail);
        if(!d){fb_text(x,y,"carregando...",PAL.muted,PAL.bg,0);return;} char v[80];
        snprintf(v,sizeof v,"%s/%s",Js(d,"active","-"),Js(d,"sub","-"));y=ui_kv(x,y,w,"ESTADO",v);
        y=ui_kv(x,y,w,"ENABLED",Js(d,"enabled","-")); snprintf(v,sizeof v,"%d",(int)Jn(d,"main_pid",0));y=ui_kv(x,y,w,"PID",v);
        y=ui_kv(x,y,w,"DESDE",Js(d,"started","-")); fb_text(x,y,"DESC",PAL.fg_dim,PAL.bg,0);y+=ROWH; fb_text_clip(x,y,Js(d,"description","-"),w/FB_FONT_W,PAL.fg,PAL.bg,0);y+=ROWH+4;
        const char*acts[]={"RESTART","STOP","START","LOGS (journal)"};
        for(int i=0;i<4;i++){int sel=(focus==i),ry=y+i*ROWH;if(sel)fb_fill(x-2,ry-2,w,ROWH,PAL.line2);fb_text(x,ry,"A",PAL.btn_a,sel?PAL.line2:PAL.bg,0);fb_text(x+FB_FONT_W*2,ry,acts[i],sel?PAL.accent:PAL.fg,sel?PAL.line2:PAL.bg,0);} return; }
    ui_title(x,y,"SERVICOS"); y+=ROWH;
    cJSON *d=api_data(g_cache[V_SVC]); (void)d;
    char ctl[80];snprintf(ctl,sizeof ctl,"X filtro:%s  (L1/R1 pag)",SD_FILT[sv_filter]); fb_text(x,y,ctl,sv_filter?PAL.warn:PAL.muted,PAL.bg,0); y+=ROWH+2;
    cJSON*page[PAGE];int np;svc_collect(page,&np);
    for(int i=0;i<np;i++){cJSON*s=page[i];int sel=(focus==i),ry=y+i*ROWH;if(sel)fb_fill(x-2,ry-2,w,ROWH,PAL.line2);
        const char*sub=Js(s,"sub","");unsigned long sc=!strcmp(sub,"running")?PAL.fg:sd_failed(s)?PAL.crit:PAL.muted;
        char unit[80];snprintf(unit,sizeof unit,"%s",Js(s,"unit","?"));char*dot=strstr(unit,".service");if(dot)*dot=0;
        fb_text_clip(x,ry,unit,(w/FB_FONT_W)-10,sel?PAL.accent:PAL.fg,sel?PAL.line2:PAL.bg,0);
        fb_text(x+w-fb_text_w(sub),ry,sub,sc,sel?PAL.line2:PAL.bg,0);}
    if(!np)fb_text(x,y,"(nenhum servico)",PAL.muted,PAL.bg,0);
}
static int svc_nfocus(void){ if(sv_mode==2)return 0; if(sv_mode==1)return 4; cJSON*page[PAGE];int np;svc_collect(page,&np);return np; }
static void svc_activate(int focus){
    if(sv_mode==1){ if(focus==3){ /* LOGS */ if(g_svc_log){free(g_svc_log);g_svc_log=NULL;} char p[256];snprintf(p,sizeof p,"/api/systemd/logs?unit=%s&lines=120",sv_unit); cJSON*root=api_get(p),*d=api_data(root); g_svc_log=strdup(d?Js(d,"lines","(sem journal)"):"(erro)"); if(root)cJSON_Delete(root); sv_mode=2; return; }
        const char*act[]={"restart","stop","start"}; if(focus<0||focus>2)return; char lbl[100];snprintf(lbl,sizeof lbl,"%s %s",act[focus],sv_unit); confirm_open(CF_SVC,act[focus],sv_unit,lbl); return; }
    cJSON*page[PAGE];int np;svc_collect(page,&np); if(focus<0||focus>=np)return;
    snprintf(sv_unit,sizeof sv_unit,"%s",Js(page[focus],"unit","")); detail_free(); char p[256];snprintf(p,sizeof p,"/api/systemd/service?unit=%s",sv_unit); g_detail=api_get(p); sv_mode=1; g_focus[V_SVC]=0;
}
static int svc_back(void){ if(sv_mode==2){sv_mode=1;return 1;} if(sv_mode==1){sv_mode=0;detail_free();return 1;} return 0; }
static int svc_page_fn(int dir){ if(sv_mode!=0)return 0; sv_page+=dir;if(sv_page<0)sv_page=0;g_focus[V_SVC]=0;return 1; }
static void svc_key(int b){ if(sv_mode!=0)return; if(b==CDB_X){sv_filter=(sv_filter+1)%4;sv_page=0;g_focus[V_SVC]=0;} }

/* =================================================================== CMD */
static void cmd_render(int focus){
    int x=cx(),y=cy0(),w=cw();
    if(cmd_mode==2){ char t[60];snprintf(t,sizeof t,"CMD  %s",cmd_cat);ui_title(x,y,t);y+=ROWH+2;
        const char*o=g_cmd_out?g_cmd_out:"(sem saida)";int cols=w/FB_FONT_W,row=0,maxrow=(cy1()-y)/FB_FONT_H;
        for(const char*p=o;*p&&row<maxrow;){char buf[200];int bl=0;while(*p&&*p!='\n'&&bl<cols&&bl<199)buf[bl++]=*p++;buf[bl]=0;if(*p=='\n')p++;else while(*p&&*p!='\n')p++;fb_text(x,y+row*FB_FONT_H,buf,PAL.fg,PAL.bg,0);row++;} return; }
    cJSON *d=api_data(g_cache[V_CMD]),*arr=d?J(d,"commands"):NULL;
    if(cmd_mode==0){ ui_title(x,y,"COMANDOS"); y+=ROWH; fb_text(x,y,"A: abrir categoria  B: voltar",PAL.muted,PAL.bg,0); y+=ROWH+2;
        /* categorias únicas */
        char cats[16][24];int nc=0;cJSON*c;
        if(arr)cJSON_ArrayForEach(c,arr){const char*cat=Js(c,"cat","?");int f=0;for(int i=0;i<nc;i++)if(!strcmp(cats[i],cat))f=1;if(!f&&nc<16)snprintf(cats[nc++],24,"%s",cat);}
        for(int i=0;i<nc;i++){int sel=(focus==i),ry=y+i*ROWH;if(sel)fb_fill(x-2,ry-2,w,ROWH,PAL.line2);fb_text(x,ry,">",PAL.accent,sel?PAL.line2:PAL.bg,0);fb_text(x+FB_FONT_W*2,ry,cats[i],sel?PAL.accent:PAL.fg,sel?PAL.line2:PAL.bg,0);}
        return; }
    /* lista de comandos da categoria */
    char t[60];snprintf(t,sizeof t,"CMD . %s",cmd_cat);ui_title(x,y,t);y+=ROWH; fb_text(x,y,"A: executar  B: voltar",PAL.muted,PAL.bg,0);y+=ROWH+2;
    cJSON*c;int fi=0;
    if(arr)cJSON_ArrayForEach(c,arr){ if(strcmp(Js(c,"cat",""),cmd_cat))continue; int sel=(focus==fi),ry=y+fi*ROWH; if(ry+ROWH>cy1())break;
        if(sel)fb_fill(x-2,ry-2,w,ROWH,PAL.line2); const char*risk=Js(c,"risk","safe"); fb_text(x,ry,!strcmp(risk,"diag")?"[D]":"[S]",!strcmp(risk,"diag")?PAL.warn:PAL.fg_dim,sel?PAL.line2:PAL.bg,0);
        fb_text_clip(x+FB_FONT_W*4,ry,Js(c,"desc","?"),(w/FB_FONT_W)-6,sel?PAL.accent:PAL.fg,sel?PAL.line2:PAL.bg,0); fi++; }
}
static int cmd_ncats(void){ cJSON*d=api_data(g_cache[V_CMD]),*arr=d?J(d,"commands"):NULL,*c; char cats[16][24];int nc=0; if(arr)cJSON_ArrayForEach(c,arr){const char*cat=Js(c,"cat","?");int f=0;for(int i=0;i<nc;i++)if(!strcmp(cats[i],cat))f=1;if(!f&&nc<16)snprintf(cats[nc++],24,"%s",cat);} return nc; }
static int cmd_nlist(void){ cJSON*d=api_data(g_cache[V_CMD]),*arr=d?J(d,"commands"):NULL,*c;int n=0; if(arr)cJSON_ArrayForEach(c,arr)if(!strcmp(Js(c,"cat",""),cmd_cat))n++; return n; }
static int cmd_nfocus(void){ if(cmd_mode==0)return cmd_ncats(); if(cmd_mode==1)return cmd_nlist(); return 0; }
static void cmd_run(const char *key){
    char body[64];snprintf(body,sizeof body,"{\"key\":\"%s\"}",key); char*r=http_post("/api/commands/exec",body);
    if(g_cmd_out){free(g_cmd_out);g_cmd_out=NULL;}
    if(!r){g_cmd_out=strdup("(agente offline)");cmd_mode=2;return;}
    cJSON*root=cJSON_Parse(r);free(r); cJSON*d=api_data(root); const char*out=d?Js(d,"output","(vazio)"):"(erro)";
    g_cmd_out=strdup(out); if(root)cJSON_Delete(root); cmd_mode=2;
}
static void cmd_activate(int focus){
    cJSON*d=api_data(g_cache[V_CMD]),*arr=d?J(d,"commands"):NULL,*c;
    if(cmd_mode==0){ char cats[16][24];int nc=0; if(arr)cJSON_ArrayForEach(c,arr){const char*cat=Js(c,"cat","?");int f=0;for(int i=0;i<nc;i++)if(!strcmp(cats[i],cat))f=1;if(!f&&nc<16)snprintf(cats[nc++],24,"%s",cat);} if(focus>=0&&focus<nc){snprintf(cmd_cat,sizeof cmd_cat,"%s",cats[focus]);cmd_mode=1;g_focus[V_CMD]=0;} return; }
    if(cmd_mode==1){ int fi=0; if(arr)cJSON_ArrayForEach(c,arr){if(strcmp(Js(c,"cat",""),cmd_cat))continue; if(fi==focus){cmd_run(Js(c,"key",""));return;} fi++;} }
}
static int cmd_back(void){ if(cmd_mode==2){cmd_mode=1;return 1;} if(cmd_mode==1){cmd_mode=0;cmd_cat[0]=0;g_focus[V_CMD]=0;return 1;} return 0; }

/* =================================================================== KERNEL */
static cJSON *kn_nodes(void){ cJSON*d=api_data(g_cache[V_KERNEL]),*dt=d?J(d,"dtb"):NULL; cJSON*n=dt?J(dt,"nodes"):NULL; return (n&&cJSON_IsArray(n))?n:NULL; }
static void kernel_render(int focus){
    int x=cx(),y=cy0(),w=cw(); ui_title(x,y,"KERNEL & DEVICE TREE"); y+=ROWH+2;
    cJSON *d=api_data(g_cache[V_KERNEL]); if(!d){fb_text(x,y,AGENT_OK?"carregando...":"agente offline",PAL.muted,PAL.bg,0);return;} char v[80];
    y=ui_kv(x,y,w,"RELEASE",Js(d,"osrelease","-")); y=ui_kv(x,y,w,"ARCH",Js(d,"arch","-"));
    cJSON *dt=J(d,"dtb"); if(dt){ y=ui_kv(x,y,w,"DT MODELO",Js(dt,"model","-")); }
    fb_text(x,y,"CMDLINE",PAL.fg_dim,PAL.bg,0);y+=ROWH; { const char*cl=Js(d,"cmdline","-");int cols=w/FB_FONT_W,row=0; for(const char*p=cl;*p&&row<2;){char b[200];int bl=0;while(*p&&bl<cols&&bl<199)b[bl++]=*p++;b[bl]=0;fb_text(x,y+row*FB_FONT_H,b,PAL.fg,PAL.bg,0);row++;} y+=2*FB_FONT_H+2; }
    /* nós do Device Tree — focáveis (A abre no FS), paginados por L1/R1 */
    cJSON *nodes=kn_nodes(); int N=nodes?cJSON_GetArraySize(nodes):0; int tot=pg_count(N); kn_page=clampi(kn_page,0,tot-1);
    char hdr[60];snprintf(hdr,sizeof hdr,"DEVICE TREE - A abre no FS  pag %d/%d (L1/R1)",kn_page+1,tot); fb_text(x,y,hdr,PAL.fg_dim,PAL.bg,0); y+=ROWH;
    for(int i=kn_page*PAGE,fi=0;i<N&&i<kn_page*PAGE+PAGE;i++,fi++){cJSON*nd=cJSON_GetArrayItem(nodes,i);int sel=(focus==fi),ry=y+fi*ROWH;if(ry+ROWH>cy1()-ROWH)break;
        if(sel)fb_fill(x-2,ry-2,w,ROWH,PAL.line2);
        fb_text_clip(x,ry,Js(nd,"name","?"),(w/FB_FONT_W)-22,sel?PAL.accent:PAL.fg,sel?PAL.line2:PAL.bg,0);
        fb_text_clip(x+w-fb_text_w("                     "),ry,Js(nd,"compatible",""),20,PAL.muted,sel?PAL.line2:PAL.bg,0);}
    if(!N)fb_text(x,y,"(sem nós de device-tree)",PAL.muted,PAL.bg,0);
    snprintf(v,sizeof v,"%d",(int)Jn(d,"modules_total",0)); fb_text(x,cy1()-ROWH+4,"MODULOS carregados:",PAL.fg_dim,PAL.bg,0); fb_text(x+fb_text_w("MODULOS carregados: "),cy1()-ROWH+4,v,PAL.fg,PAL.bg,0);
}
static int kernel_nfocus(void){ cJSON*n=kn_nodes(); if(!n)return 0; int N=cJSON_GetArraySize(n); int start=kn_page*PAGE,cnt=N-start; return cnt<0?0:(cnt>PAGE?PAGE:cnt); }
static void kernel_activate(int focus){ cJSON*n=kn_nodes(); if(!n)return; cJSON*nd=cJSON_GetArrayItem(n,kn_page*PAGE+focus); if(!nd)return; const char*nm=Js(nd,"name",""); if(!nm[0])return;
    snprintf(fs_path,sizeof fs_path,"/proc/device-tree/%s",nm); fs_mode=0; fs_page=0; g_focus[V_FS]=0; g_section=V_FS; view_enter(V_FS); }
static int kernel_page(int dir){ kn_page+=dir; if(kn_page<0)kn_page=0; g_focus[V_KERNEL]=0; return 1; }

/* =================================================================== AJUSTES */
static const char *DISP_K[]={"bright-down","bright-up"};
static const char *AUD_K[]={"volume-down","volume-up","volume-mute","audio-test-spk","audio-test-hp"};
static const char *AUD_L[]={"Volume -","Volume +","Mudo (alternar)","Testar alto-falante","Testar fone"};
static int tools_nfocus(void){ return g_sub[V_TOOLS]==0?3:5; }
static void tools_render(int focus){
    int x=cx(),y=cy0(),w=cw(),sub=g_sub[V_TOOLS]; char t[40];
    snprintf(t,sizeof t,"AJUSTES . %s",SUB_TOOLS[sub]); ui_title(x,y,t);y+=ROWH; ui_subbar(x,y,SUB_TOOLS,2,sub); y+=ROWH+4;
    if(sub==0){ const char*rows[]={"Brilho -","Brilho +","Screenshot (L2+R2)"};
        for(int i=0;i<3;i++){int sel=(focus==i),ry=y+i*ROWH;if(sel)fb_fill(x-2,ry-2,w,ROWH,PAL.line2);fb_text(x,ry,"A",PAL.btn_a,sel?PAL.line2:PAL.bg,0);fb_text(x+FB_FONT_W*2,ry,rows[i],sel?PAL.accent:PAL.fg,sel?PAL.line2:PAL.bg,0);}
        y+=3*ROWH+6; if(STATUS.bright_pct>=0)ui_gauge(x,y,w,"BRILHO",STATUS.bright_pct);
    } else { cJSON*vd=api_data(g_volume); if(vd){int p=(int)Jn(vd,"pct",-1);if(p>=0)y=ui_gauge(x,y,w,"VOLUME",p)+2;char st[40];snprintf(st,sizeof st,"%s . %s",(int)Jn(vd,"muted",0)?"MUDO":"ativo",Js(vd,"control","-"));y=ui_kv(x,y,w,"ESTADO",st);} y+=4;
        for(int i=0;i<5;i++){int sel=(focus==i),ry=y+i*ROWH;if(ry+ROWH>cy1())break;if(sel)fb_fill(x-2,ry-2,w,ROWH,PAL.line2);fb_text(x,ry,"A",PAL.btn_a,sel?PAL.line2:PAL.bg,0);fb_text(x+FB_FONT_W*2,ry,AUD_L[i],sel?PAL.accent:PAL.fg,sel?PAL.line2:PAL.bg,0);} }
}
static void tools_activate(int focus){
    int sub=g_sub[V_TOOLS];
    if(sub==0){ if(focus==0)post_action(DISP_K[0]); else if(focus==1)post_action(DISP_K[1]); else if(focus==2)view_screenshot(); view_refresh_status(); }
    else { if(focus>=0&&focus<5){post_action(AUD_K[focus]); if(g_volume){cJSON_Delete(g_volume);g_volume=NULL;} g_volume=api_get("/api/volume");} }
}

/* =================================================================== KEYS */
static const int KT[]={CDB_L2,CDB_L1,CDB_R1,CDB_R2,CDB_SELECT,CDB_FN,CDB_START,CDB_UP,CDB_DOWN,CDB_LEFT,CDB_RIGHT,CDB_Y,CDB_X,CDB_A,CDB_B};
static void keys_render(int focus){
    (void)focus; int x=cx(),y=cy0(),w=cw(); ui_title(x,y,"TESTE DE BOTOES");y+=ROWH; fb_text(x,y,"Aperte cada controle - acende quando pressionado.",PAL.muted,PAL.bg,0);y+=ROWH+4;
    int cellw=56,cellh=26,perrow=w/(cellw+6); if(perrow<1)perrow=1;
    for(int i=0;i<(int)(sizeof KT/sizeof KT[0]);i++){int ccx=x+(i%perrow)*(cellw+6),ccy=y+(i/perrow)*(cellh+6);int on=input_pressed(KT[i]);const char*nm=btn_name(KT[i]);unsigned long bgc=on?PAL.sel_bg:PAL.line2,fgc=on?PAL.sel_fg:ui_btn_color(nm);fb_fill(ccx,ccy,cellw,cellh,bgc);fb_text(ccx+(cellw-fb_text_w(nm))/2,ccy+5,nm,fgc,bgc,0);}
    fb_text(x,y+5*(cellh+6)+4,"Start+Select juntos: sair",PAL.fg_dim,PAL.bg,0);
}

/* =================================================================== MEDIA (teste A/V) */
static cJSON *media_item(int i){ cJSON *d=api_data(g_cache[V_MEDIA]),*arr=d?J(d,"items"):NULL; return (arr&&cJSON_IsArray(arr))?cJSON_GetArrayItem(arr,i):NULL; }
static int media_n(void){ cJSON *d=api_data(g_cache[V_MEDIA]),*arr=d?J(d,"items"):NULL; return (arr&&cJSON_IsArray(arr))?cJSON_GetArraySize(arr):0; }
static void media_render(int focus){
    int x=cx(),y=cy0(),w=cw(); ui_title(x,y,"TESTE A/V"); y+=ROWH;
    cJSON *d=api_data(g_cache[V_MEDIA]);
    if(!d){fb_text(x,y,AGENT_OK?"carregando...":"agente offline",PAL.muted,PAL.bg,0);return;}
    fb_text(x,y,"A: tocar   B: parar/voltar",PAL.muted,PAL.bg,0); y+=ROWH+2;
    int N=media_n();
    if(!N){fb_text(x,y,"sem midia em /root/media",PAL.muted,PAL.bg,0);return;}
    for(int i=0;i<N;i++){cJSON*it=media_item(i);int sel=(focus==i),ry=y+i*ROWH;if(ry+ROWH>cy1())break;
        if(sel)fb_fill(x-2,ry-2,w,ROWH,PAL.line2);
        const char*kind=Js(it,"kind","");const char*tag=!strcmp(kind,"video")?"VID":"AUD";
        fb_text(x,ry,tag,PAL.fg_dim,sel?PAL.line2:PAL.bg,0);
        fb_text_clip(x+FB_FONT_W*4,ry,Js(it,"name","?"),(w/FB_FONT_W)-10,sel?PAL.accent:PAL.fg,sel?PAL.line2:PAL.bg,0);
        const char*ex=Js(it,"ext","");fb_text(x+w-fb_text_w(ex),ry,ex,PAL.muted,sel?PAL.line2:PAL.bg,0);}
}
static int media_nfocus(void){ return media_n(); }
static void media_activate(int focus){
    cJSON*it=media_item(focus); if(!it)return;
    const char*p=Js(it,"path",""); if(!p[0])return;
    char body[600]; snprintf(body,sizeof body,"{\"path\":\"%s\"}",p);
    /* vídeo: o mpv (--vo=drm via agente) toma a tela; áudio toca em background */
    post_msg("/api/media/play", body);
    set_toast(Js(it,"name","tocando"), 0);
}
static int media_back(void){ char*r=http_post("/api/media/stop","{}"); if(r)free(r); return 0; }

/* =================================================================== STORAGE */
static const char *hbytes(double n, char *buf, int sz){
    const char *u[]={"B","K","M","G","T"}; int i=0;
    if(n<0){snprintf(buf,sz,"-");return buf;}
    while(n>=1024 && i<4){n/=1024;i++;}
    if(i==0)snprintf(buf,sz,"%d%s",(int)n,u[i]); else snprintf(buf,sz,"%.1f%s",n,u[i]);
    return buf;
}
static int st_can_expand(void){ cJSON*d=api_data(g_cache[V_STORAGE]); return d && (int)Jn(d,"rootfs_growable",0); }
static int st_has_card(void){ cJSON*d=api_data(g_cache[V_STORAGE]),*sc=d?J(d,"second_card"):NULL; return sc && (int)Jn(sc,"present",0); }
static int st_card_mounted(void){ cJSON*d=api_data(g_cache[V_STORAGE]),*sc=d?J(d,"second_card"):NULL; return sc && (int)Jn(sc,"mounted",0); }
static void storage_render(int focus){
    int x=cx(),y=cy0(),w=cw(); ui_title(x,y,"ARMAZENAMENTO"); y+=ROWH+2;
    cJSON*d=api_data(g_cache[V_STORAGE]);
    if(!d){fb_text(x,y,AGENT_OK?"carregando...":"agente offline",PAL.muted,PAL.bg,0);return;}
    cJSON*r=J(d,"rootfs"),*dk=J(d,"disk"); char a[24],b[24],c[24],v[90];
    if(r){ int up=(int)Jn(r,"usepct",-1); if(up>=0)y=ui_gauge(x,y,w,"ROOTFS",up)+2;
        snprintf(v,sizeof v,"%s / %s livre %s",hbytes(Jn(r,"used",-1),a,sizeof a),hbytes(Jn(r,"size",-1),b,sizeof b),hbytes(Jn(r,"avail",-1),c,sizeof c)); y=ui_kv(x,y,w,"USO",v); }
    if(dk){ snprintf(v,sizeof v,"%s  %s",Js(dk,"dev","-"),hbytes(Jn(dk,"size",-1),a,sizeof a)); y=ui_kv(x,y,w,"CARTAO",v); }
    /* partições */
    fb_text(x,y,"PARTICOES",PAL.fg_dim,PAL.bg,0); y+=ROWH;
    cJSON*parts=J(d,"parts"),*p;
    if(parts) cJSON_ArrayForEach(p,parts){ char sz[24]; const char*role=Js(p,"role","?");
        snprintf(v,sizeof v,"%-6.6s %s %s",role,Js(p,"dev","")+5,Js(p,"label",""));
        fb_text(x,y,v,PAL.fg,PAL.bg,0);
        snprintf(sz,sizeof sz,"%s %s",Js(p,"fstype","?"),hbytes(Jn(p,"size",-1),a,sizeof a));
        fb_text(x+w-fb_text_w(sz),y,sz,PAL.muted,PAL.bg,0); y+=FB_FONT_H; if(y>cy1()-3*ROWH)break; }
    y+=4;
    int fi=0;
    if(st_can_expand()){ int sel=(focus==fi),ry=y; if(sel)fb_fill(x-2,ry-2,w,ROWH,PAL.line2);
        fb_text(x,ry,"A",PAL.btn_a,sel?PAL.line2:PAL.bg,0);
        snprintf(v,sizeof v,"Expandir rootfs (+%s)",hbytes(Jn(d,"expandable_bytes",-1),a,sizeof a));
        fb_text(x+FB_FONT_W*2,ry,v,sel?PAL.accent:PAL.fg,sel?PAL.line2:PAL.bg,0); y+=ROWH; fi++; }
    else { fb_text(x,y,Js(d,"blocked_by","rootfs no maximo"),PAL.muted,PAL.bg,0); y+=ROWH; }
    y+=4; fb_text(x,y,"2o CARTAO (slot extra)",PAL.fg_dim,PAL.bg,0); y+=ROWH;
    cJSON*sc=J(d,"second_card");
    if(!st_has_card()){ fb_text(x,y,"nenhum 2o cartao",PAL.muted,PAL.bg,0); }
    else {
        y=ui_kv(x,y,w,"DISPOSITIVO",Js(sc,"dev","-"));
        if(st_card_mounted()){ snprintf(v,sizeof v,"montado %s (%s)",Js(sc,"mount","/media/sdcard"),Js(sc,"fstype","?")); y=ui_kv(x,y,w,"ESTADO",v);
            snprintf(v,sizeof v,"%s livre de %s",hbytes(Jn(sc,"avail",-1),a,sizeof a),hbytes(Jn(sc,"size",-1),b,sizeof b)); y=ui_kv(x,y,w,"ESPACO",v); }
        else { snprintf(v,sizeof v,"%s",hbytes(Jn(sc,"size_bytes",-1),a,sizeof a)); y=ui_kv(x,y,w,"TAMANHO (nao montado)",v); }
        int sel=(focus==fi),ry=y; if(sel)fb_fill(x-2,ry-2,w,ROWH,PAL.line2);
        fb_text(x,ry,"A",PAL.btn_a,sel?PAL.line2:PAL.bg,0);
        fb_text(x+FB_FONT_W*2,ry,st_card_mounted()?"Desmontar 2o cartao":"Montar 2o cartao",sel?PAL.accent:PAL.fg,sel?PAL.line2:PAL.bg,0);
    }
}
static int storage_nfocus(void){ return (st_can_expand()?1:0) + (st_has_card()?1:0); }
static void storage_activate(int focus){
    int fi=0;
    if(st_can_expand()){ if(focus==fi){ confirm_open(CF_ACTION,"expand-rootfs",NULL,"Expandir rootfs (usa o cartao inteiro)"); return; } fi++; }
    if(st_has_card() && focus==fi){
        char*rr=http_post(st_card_mounted()?"/api/storage/unmount":"/api/storage/mount","{}");
        if(rr)free(rr); set_toast(st_card_mounted()?"desmontando":"montando",0); view_enter(V_STORAGE);
    }
}

/* =================================================================== tabela */
typedef struct { void(*render)(int); int(*nfocus)(void); void(*activate)(int); int(*back)(void); int(*page)(int); void(*key)(int); } cd_view;
static const cd_view VIEWS[NVIEWS]={
    [V_HOME]  ={home_render,   home_nfocus, home_activate, NULL,      NULL},
    [V_STATUS]={status_render, NULL,        NULL,          NULL,      NULL},
    [V_PROCS] ={procs_render,  procs_nfocus,procs_activate,procs_back,procs_page, procs_key},
    [V_NET]   ={net_render,    net_nfocus,  net_activate,  net_back,  NULL,       net_key},
    [V_LOGS]  ={logs_render,   logs_nfocus, logs_activate, logs_back, NULL,       logs_key},
    [V_DEVICE]={device_render, NULL,        NULL,          NULL,      NULL},
    [V_FS]    ={fs_render,     fs_nfocus,   fs_activate,   fs_back,   fs_page_fn, fs_key},
    [V_SVC]   ={svc_render,    svc_nfocus,  svc_activate,  svc_back,  svc_page_fn,svc_key},
    [V_CMD]   ={cmd_render,    cmd_nfocus,  cmd_activate,  cmd_back,  NULL},
    [V_KERNEL]={kernel_render, kernel_nfocus,kernel_activate,NULL,     kernel_page},
    [V_TOOLS] ={tools_render,  tools_nfocus,tools_activate,NULL,      NULL},
    [V_KEYS]  ={keys_render,   NULL,        NULL,          NULL,      NULL},
    [V_MEDIA] ={media_render,  media_nfocus,media_activate,media_back,NULL},
    [V_STORAGE]={storage_render,storage_nfocus,storage_activate,NULL,   NULL},
};
static int v_nfocus(int s){ return VIEWS[s].nfocus?VIEWS[s].nfocus():0; }
static void v_activate(int s,int focus){ if(VIEWS[s].activate)VIEWS[s].activate(focus); }

/* =================================================================== FN menu */
typedef struct { const char*label,*sub; int kind; const char*key; } fn_item;
static fn_item FN_ITEMS[]={
    {"Ajustes","display/audio",0,"10"},
    {"Testar botoes","gamepad",0,"11"},
    {"Teste A/V","audio/video",0,"12"},
    {"Armazenamento","disco/cartao",0,"13"},
    {"Kernel & DTB","diag",0,"9"},
    {"Screenshot agora","L2+R2",1,NULL},
    {"Trocar p/ Web","reinicia",2,"interface-web"},
    {"Reiniciar agente","confirma",2,"restart-agent"},
    {"Reiniciar sistema","confirma",2,"reboot"},
    {"Desligar","confirma",2,"poweroff"},
};
#define FN_N ((int)(sizeof FN_ITEMS/sizeof FN_ITEMS[0]))
static void fn_render(void){
    int W=fb_w(),H=fb_h(); int bw=360,bh=30+FN_N*ROWH+24,bx=(W-bw)/2,by=(H-bh)/2;
    fb_fill(bx,by,bw,bh,PAL.panel); fb_fill(bx,by,bw,2,PAL.accent); fb_text(bx+12,by+8,"FUNCTION",PAL.accent,PAL.panel,0);
    int y=by+30; for(int i=0;i<FN_N;i++){int sel=(g_fn_focus==i);if(sel)fb_fill(bx+4,y-2,bw-8,ROWH,PAL.line2);unsigned long c=FN_ITEMS[i].kind==2?PAL.warn:(sel?PAL.accent:PAL.fg);fb_text(bx+12,y,FN_ITEMS[i].label,c,sel?PAL.line2:PAL.panel,0);fb_text(bx+bw-12-fb_text_w(FN_ITEMS[i].sub),y,FN_ITEMS[i].sub,PAL.muted,sel?PAL.line2:PAL.panel,0);y+=ROWH;}
    fb_text(bx+12,by+bh-16,"B/FN fecha",PAL.fg_dim,PAL.panel,0);
}
static void fn_activate(void){
    fn_item*it=&FN_ITEMS[g_fn_focus];
    if(it->kind==0){int v=atoi(it->key);g_overlay=OV_NONE;g_section=v;view_enter(v);}
    else if(it->kind==1){g_overlay=OV_NONE;view_screenshot();}
    else if(it->kind==2){confirm_open(CF_ACTION,it->key,NULL,it->label);}
}

/* =================================================================== router */
static const char *hint_for(int s){
    switch(s){
        case V_HOME:return "A: abrir  FN: menu  L2+R2: shot";
        case V_STATUS:case V_DEVICE:return "L1/R1: subpagina  <- ->: abas  B: voltar";
        case V_NET:return "A: wifi  X: buscar  Y: ss  B: voltar";
        case V_LOGS:return "A: detalhe  X: severidade  L1/R1: origem";
        case V_PROCS:return "A: detalhe  X: filtro  Y: sort  L1/R1: pag";
        case V_FS:return "A: abrir  X: atalhos  L1/R1: pag  B: voltar";
        case V_SVC:return "A: detalhe/acao  X: filtro  L1/R1: pag";
        case V_CMD:return "A: executar  B: voltar";
        case V_KERNEL:return "A: nó no FS  L1/R1: pagina  B: voltar";
        case V_TOOLS:return "A: executar  L1/R1: subpagina  B: voltar";
        case V_KEYS:return "aperte botoes  Start+Select: sair";
        case V_MEDIA:return "A: tocar  B: parar/voltar";
        case V_STORAGE:return "A: acao  B: voltar";
        default:return "";
    }
}
static void goto_tab(int dir){ if(g_section>=TAB_COUNT){g_section=0;view_enter(0);return;} g_section=(g_section+dir+TAB_COUNT)%TAB_COUNT; g_focus[g_section]=0; view_enter(g_section); }
static void view_back(void){
    int s=g_section;
    if(VIEWS[s].back&&VIEWS[s].back()){g_focus[s]=0;return;}
    if(s==V_KERNEL||s==V_TOOLS||s==V_KEYS||s==V_MEDIA||s==V_STORAGE){g_section=V_HOME;view_enter(V_HOME);return;}
    if(s!=V_HOME){g_section=V_HOME;view_enter(V_HOME);}
}

void view_handle(const cd_event *ev){
    if(ev->value!=1)return; int b=ev->btn;
    if(b==CDB_F5){g_running=0;return;}
    if(g_overlay==OV_CONFIRM){ if(b==CDB_A||b==CDB_START){confirm_do();g_overlay=OV_NONE; if(g_cf_kind==CF_SIG){procs_back();view_enter(V_PROCS);} else if(g_cf_kind==CF_SVC){detail_free();char p[256];snprintf(p,sizeof p,"/api/systemd/service?unit=%s",sv_unit);g_detail=api_get(p);}} else if(b==CDB_B||b==CDB_SELECT){g_overlay=OV_NONE;} return; }
    if(g_overlay==OV_FN){ if(b==CDB_FN||b==CDB_B||b==CDB_SELECT)g_overlay=OV_NONE; else if(b==CDB_UP)g_fn_focus=(g_fn_focus-1+FN_N)%FN_N; else if(b==CDB_DOWN)g_fn_focus=(g_fn_focus+1)%FN_N; else if(b==CDB_A||b==CDB_START)fn_activate(); return; }
    if(b==CDB_FN){g_overlay=OV_FN;g_fn_focus=0;return;}
    if(g_section==V_KEYS){ if(input_pressed(CDB_START)&&input_pressed(CDB_SELECT))view_back(); return; }

    int nf=v_nfocus(g_section);
    switch(b){
        case CDB_LEFT: goto_tab(-1); break;
        case CDB_RIGHT: goto_tab(+1); break;
        case CDB_UP: if(nf)g_focus[g_section]=(g_focus[g_section]-1+nf)%nf; break;
        case CDB_DOWN: if(nf)g_focus[g_section]=(g_focus[g_section]+1)%nf; break;
        case CDB_A: case CDB_START: if(nf)v_activate(g_section,g_focus[g_section]); break;
        case CDB_B: case CDB_SELECT: view_back(); break;
        case CDB_X: case CDB_Y: if(VIEWS[g_section].key)VIEWS[g_section].key(b); break;
        case CDB_L1:
            if(VIEWS[g_section].page){VIEWS[g_section].page(-1);}
            else if(NSUB[g_section]){g_sub[g_section]=(g_sub[g_section]-1+NSUB[g_section])%NSUB[g_section];g_focus[g_section]=0;if(g_section==V_LOGS||g_section==V_TOOLS)view_enter(g_section);}
            break;
        case CDB_R1:
            if(VIEWS[g_section].page){VIEWS[g_section].page(+1);}
            else if(NSUB[g_section]){g_sub[g_section]=(g_sub[g_section]+1)%NSUB[g_section];g_focus[g_section]=0;if(g_section==V_LOGS||g_section==V_TOOLS)view_enter(g_section);}
            break;
        default: break;
    }
    nf=v_nfocus(g_section); if(g_focus[g_section]>=nf)g_focus[g_section]=nf?nf-1:0;
}

void view_render(void){
    fb_clear(PAL.bg); ui_topbar(); ui_tabs(g_section<TAB_COUNT?g_section:-1);
    VIEWS[g_section].render(g_focus[g_section]);
    ui_footer(hint_for(g_section));
    if(g_overlay==OV_FN)fn_render(); else if(g_overlay==OV_CONFIRM)ui_confirm(g_cf_label);
    if(g_toast[0]&&now_ms()<g_toast_until)ui_toast(g_toast,0);
}

void view_screenshot(void){
    char*r=http_post("/api/screenshot","{\"version\":\"fb\"}");
    if(!r){set_toast("screenshot: agente offline",1);return;}
    cJSON*root=cJSON_Parse(r);free(r);cJSON*d=api_data(root);const char*f=d?Js(d,"file","ok"):"ok";const char*base=strrchr(f,'/');set_toast(base?base+1:f,0);if(root)cJSON_Delete(root);
}

void view_tick(void){ view_refresh_status(); if(g_section==V_HOME)refresh_health(); }
int view_running(void){ return g_running; }
void view_init(void){ memset(g_sub,0,sizeof g_sub);memset(g_focus,0,sizeof g_focus);memset(g_cache,0,sizeof g_cache);g_toast[0]=0; view_refresh_status(); view_enter(V_HOME); }
