#!/usr/bin/env bash
# gen-av-samples.sh — gera samples de teste de ÁUDIO e VÍDEO (sintéticos, minúsculos,
# multi-formato) em assets/av-samples/, usando ffmpeg. São versionados no repo e
# instalados em /root/media no build, para a tela de TESTE A/V do CyberDeck OS.
#
# Sintéticos = sem licença/terceiros, pequenos e determinísticos. Clipes de ~5 s,
# vídeo 320x240 (decode por software no RK3326). Regerar: scripts/gen-av-samples.sh
set -eu
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$SELF/../assets/av-samples"
command -v ffmpeg >/dev/null || { echo "[gen] ffmpeg ausente — instale (apt install ffmpeg)"; exit 1; }
mkdir -p "$OUT"
log(){ echo "[gen] $*"; }
Q="-hide_banner -loglevel error -y"

# ---- ÁUDIO (~5 s) ----
# tom 440 Hz estéreo; sweep 220->880; vários containers/codecs.
log "audio: tone.wav / tone.mp3 / sweep.ogg / tone.flac"
ffmpeg $Q -f lavfi -i "sine=frequency=440:sample_rate=22050:duration=3" -ac 1 "$OUT/tone.wav"
ffmpeg $Q -f lavfi -i "sine=frequency=440:sample_rate=44100:duration=5" -ac 2 -b:a 96k "$OUT/tone.mp3"
ffmpeg $Q -f lavfi -i "sine=frequency=220:sample_rate=44100:duration=5,aeval=val(0)*1.0" -ac 2 -c:a libvorbis -q:a 3 "$OUT/sweep.ogg" 2>/dev/null || \
ffmpeg $Q -f lavfi -i "sine=frequency=220:beep_factor=2:duration=5" -ac 2 -c:a libvorbis -q:a 3 "$OUT/sweep.ogg"
ffmpeg $Q -f lavfi -i "sine=frequency=440:sample_rate=44100:duration=5" -ac 2 -c:a flac "$OUT/tone.flac"

# ---- VÍDEO (~5 s, 320x240, 15 fps, baixo bitrate, com tom) ----
# padrão testsrc + tom; H.264/mp4, VP9/webm, H.264/mkv.
SRC='-f lavfi -i testsrc=size=320x240:rate=15:duration=5 -f lavfi -i sine=frequency=440:duration=5'
log "video: testsrc.mp4 (H.264) / testsrc.webm (VP9) / testsrc.mkv (H.264)"
# shellcheck disable=SC2086
ffmpeg $Q $SRC -c:v libx264 -preset veryfast -pix_fmt yuv420p -b:v 250k -c:a aac -b:a 96k -shortest "$OUT/testsrc.mp4"
# shellcheck disable=SC2086
ffmpeg $Q $SRC -c:v libvpx-vp9 -b:v 200k -deadline realtime -c:a libopus -b:a 96k -shortest "$OUT/testsrc.webm"
# shellcheck disable=SC2086
ffmpeg $Q $SRC -c:v libx264 -preset veryfast -pix_fmt yuv420p -b:v 250k -c:a aac -b:a 96k -shortest "$OUT/testsrc.mkv"

log "OK — gerados em $OUT:"
ls -lh "$OUT" | awk 'NR>1{print "  "$9"  "$5}'
