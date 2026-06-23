"use strict";
/*
 * media.js — lista e reproduz mídia (áudio/vídeo) para a tela de TESTE A/V.
 * Os arquivos ficam em /root/media (o build instala samples lá; o usuário adiciona
 * os dele). A reprodução usa mpv: áudio em background (ALSA); vídeo via DRM/KMS
 * (--vo=drm) — usado pela native-fb. A web toca inline com <audio>/<video>.
 * Segurança: caminho saneado p/ ficar dentro das raízes de mídia (como fsbrowse).
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOTS = ["/root/media"];           // raízes permitidas de mídia
const AUDIO = new Set(["mp3", "ogg", "oga", "opus", "flac", "wav", "m4a", "aac"]);
const VIDEO = new Set(["mp4", "webm", "mkv", "avi", "mov", "m4v", "ogv"]);

function err(code, message) { const e = new Error(message); e.code = code; return e; }
function extOf(name) { const m = name.match(/\.([A-Za-z0-9]+)$/); return m ? m[1].toLowerCase() : ""; }
function kindOf(name) { const e = extOf(name); return AUDIO.has(e) ? "audio" : VIDEO.has(e) ? "video" : null; }

/* valida que o caminho está dentro de uma raiz de mídia e existe como arquivo. */
function safePath(p) {
  if (!p) throw err("BAD_REQUEST", "caminho ausente");
  const real = path.resolve(p);
  if (!ROOTS.some((r) => real === r || real.startsWith(r + "/"))) throw err("NOT_ALLOWED", "fora de /root/media");
  let st; try { st = fs.statSync(real); } catch (e) { throw err("NOT_FOUND", "arquivo não existe"); }
  if (!st.isFile()) throw err("BAD_REQUEST", "não é arquivo");
  return real;
}

/** lista os arquivos de mídia conhecidos nas raízes. */
function list() {
  const items = [];
  for (const root of ROOTS) {
    let names = [];
    try { names = fs.readdirSync(root); } catch (e) { continue; }
    for (const n of names.sort()) {
      const kind = kindOf(n); if (!kind) continue;
      let size = -1; try { size = fs.statSync(path.join(root, n)).size; } catch (e) {}
      items.push({ name: n, path: path.join(root, n), kind, ext: extOf(n), size });
    }
  }
  return { dir: ROOTS[0], items };
}

/* processo de reprodução atual (um por vez). */
let cur = null;   // { proc, file, kind }

function stop() {
  if (cur && cur.proc) { try { cur.proc.kill("SIGTERM"); } catch (e) {} }
  cur = null;
  return { stopped: true };
}

function statusNow() {
  return cur ? { playing: true, file: cur.file, kind: cur.kind } : { playing: false };
}

/** toca um arquivo. áudio: mpv --no-video (ALSA, background). vídeo: mpv --vo=drm. */
function play(p) {
  const real = safePath(p);
  const kind = kindOf(path.basename(real));
  if (!kind) throw err("BAD_REQUEST", "formato não suportado");
  stop();   // um de cada vez
  const args = ["--really-quiet", "--no-config", "--no-input-default-bindings", "--ao=alsa", "--length=600", real];
  if (kind === "audio") args.unshift("--no-video");
  else args.unshift("--vo=drm");
  let proc;
  try { proc = spawn("mpv", args, { stdio: "ignore", detached: false }); }
  catch (e) { throw err("INTERNAL", "mpv indisponível: " + e.message); }
  cur = { proc, file: real, kind };
  proc.on("error", () => { cur = null; });
  proc.on("exit", () => { if (cur && cur.proc === proc) cur = null; });
  return { playing: true, file: real, kind };
}

module.exports = { list, play, stop, status: statusNow };
