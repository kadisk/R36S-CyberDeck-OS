# Fase 4 — Runtime web (WPE WebKit) — plano

Objetivo: renderizar a **CyberDeck UI em HTML/CSS/JS** em fullscreen/kiosk no R36S,
usando **WPE WebKit** (via `cog`) — o objetivo original do projeto.

> ⚠️ **Esta é a fase mais pesada e incerta.** O rootfs BusyBox mínimo (Fases 2–3)
> **não** hospeda WebKit. É preciso um **rootfs Debian arm64 completo** + o stack
> gráfico Mali. O renderizador nativo (`cyberdeck-fb`) continua válido como fallback
> e como UI de baixo nível.

## Arquitetura escolhida

```
Kernel 4.4 + DTB rk3326 (do ArkOS)         <- mesmo boot já validado (Fases 2–3)
   ↓ root=UUID  (clone do boot do ArkOS)
Rootfs Debian arm64 (bookworm)             <- NOVO (substitui o BusyBox)
   ├─ libmali (blob RK3326, EXTRAÍDO do ArkOS) -> EGL/GLES p/ a Mali-G31
   ├─ cog + wpewebkit + WPEBackend-fdo
   └─ cog-platform DRM  -> /dev/dri/card0 (GBM + EGL, sem compositor)
        ↓
   CyberDeck UI (cyberdeck-ui/public/index.html) em kiosk 640x480
```

Por que assim:
- **Reusar o kernel/boot do ArkOS** (Fases 2–3 provaram que boota e o painel funciona).
- **Debian arm64**: tem `cog`/`wpewebkit` empacotados (sem compilar WebKit do zero).
- **libmali do ArkOS**: o blob Mali do ArkOS casa com a **KMD Mali do kernel 4.4**
  que estamos usando — é a fonte de EGL/GLES mais segura para este hardware
  (o `cyberdeck-fbinfo.txt` confirmou `/dev/dri/card0` + `renderD128`).
- **cog-platform DRM**: renderiza direto no KMS, sem Wayland/compositor — mais leve.
  (Alternativa: `cage` (Wayland kiosk) se o caminho DRM puro falhar.)

## Sub-etapas (com checkpoints — fazer uma de cada vez)

### 4a — Rootfs Debian arm64 que boota no R36S
- `scripts/build-web-rootfs.sh` monta um Debian bookworm arm64 mínimo
  (debootstrap, 2 estágios com `qemu-aarch64-static`).
- Empacotar com o mesmo método das Fases 2–3 (`--clone` do boot do ArkOS, rootfs
  por UUID). Bootar até um `getty`/login no R36S.
- **Checkpoint:** Debian sobe na tela (tty1) com shell. (~300–500 MB)

### 4b — Stack gráfico Mali + cog
- `scripts/extract-arkos-mali.sh`: extrai `libMali.so` (+ symlinks EGL/GLES/gbm) do
  rootfs ArkOS (p2, somente leitura) para `artifacts/arkos-reference/mali/`.
- No rootfs Debian: instalar `cog`, `libwpewebkit-*`, `libwpebackend-fdo-*`,
  `libegl1`/`libgles2` (GLVND) e **sobrepor** o libmali do ArkOS como provedor de
  EGL/GLES (via `/etc/ld.so.conf.d` ou alternatives), igual ao truque do dev-lab.
- **Checkpoint:** `cog --platform=drm about:blank` abre sem erro de EGL no R36S.

### 4c — CyberDeck UI em kiosk
- `runtime/scripts/start-cyberdeck-cog.sh`: lança
  `cog --platform=drm file:///usr/share/cyberdeck-ui/public/index.html`.
- Serviço de init (systemd no Debian) lança no boot, fullscreen 640x480.
- Mapear o joypad: Gamepad API (se o WPE expuser) ou ponte que lê `/dev/input/event1`
  e injeta teclas (ver `docs/hardware/input-buttons.md`).
- **Checkpoint:** `index.html` aparece na tela e navega pelos botões.

## Riscos principais (validar só no R36S)

1. **EGL/Mali**: o blob do ArkOS (Bifrost G31, ~2019) precisa inicializar EGL para o
   `cog`/WPE moderno. Maior incerteza. Mitigações: usar exatamente a KMD do kernel
   4.4; se falhar, tentar `cog` por **Wayland+cage** ou render por **software**
   (lento, mas valida o caminho).
2. **Tamanho/tempo**: rootfs ~1–2 GB; instalar WebKit via qemu-emulação é lento.
3. **ABI**: cog do bookworm x libmali antigo — possíveis incompatibilidades de versão
   de EGL/GLES. Plano B: WebKitGTK, ou compilar cog/WPE contra o libmali.

## Decisão em aberto

Se o EGL/Mali não cooperar, as opções são: (a) Wayland+cage; (b) Chromium kiosk
(mais pesado); (c) manter o **renderizador nativo `cyberdeck-fb`** como a UI oficial
e expor a parte "web" só onde fizer sentido. Reavaliar após o checkpoint 4b.
