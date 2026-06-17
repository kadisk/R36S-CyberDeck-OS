"use strict";
/*
 * volume.js — controle de volume via ALSA (amixer).
 * O rk817-codec do R36S pode expor o playback com nomes diferentes; descobrimos o
 * controle certo (amixer scontrols) e cacheamos. Lê o nível atual e ajusta/muta.
 * Tudo via execFile (sem shell).
 */
const { run, out } = require("./exec");

// nomes mais prováveis do playback no rk817 / RK3326, em ordem de preferência
const CANDIDATES = ["Master", "Playback", "PCM", "Speaker", "Headphone", "DAC", "HPOUT", "Digital", "Speaker Playback"];
let _ctrl = null;          // controle escolhido (cacheado após achar)

function err(code, message) { const e = new Error(message); e.code = code; return e; }

/** lista os controles simples do mixer (amixer scontrols). */
async function controls() {
  const r = await out("amixer", ["scontrols"], { timeout: 4000 });
  return r.split("\n").map((l) => { const m = l.match(/'([^']+)'/); return m ? m[1] : null; }).filter(Boolean);
}

/** acha (e cacheia) um controle que tenha volume de playback. */
async function pickControl() {
  if (_ctrl) return _ctrl;
  let list = [];
  try { list = await controls(); } catch (e) {}
  for (const c of CANDIDATES) if (list.indexOf(c) !== -1) { _ctrl = c; return c; }
  // fallback: o 1º controle cujo sget mostra um percentual
  for (const c of list) {
    const r = await out("amixer", ["sget", c], { timeout: 2000 });
    if (/\[\d+%\]/.test(r)) { _ctrl = c; return c; }
  }
  _ctrl = list[0] || null;
  return _ctrl;
}

function parse(text) {
  const m = String(text || "").match(/\[(\d+)%\]/);
  return { pct: m ? parseInt(m[1], 10) : -1, muted: /\[off\]/.test(text || "") };
}

/** nível atual: { pct, muted, control }. */
async function get() {
  const c = await pickControl();
  if (!c) return { pct: -1, muted: false, control: null };
  const r = await out("amixer", ["-M", "sget", c], { timeout: 3000 });
  return Object.assign(parse(r), { control: c });
}

/** ajusta: arg = "5%+" | "5%-" | "toggle". Retorna o novo estado. */
async function set(arg) {
  const c = await pickControl();
  if (!c) throw err("INTERNAL", "nenhum controle de volume disponível (amixer scontrols vazio)");
  const r = await run("amixer", ["-M", "sset", c, arg], { timeout: 4000 });
  if (!r.ok && !r.stdout) throw err("INTERNAL", "amixer falhou: " + (r.stderr || "").trim());
  const st = parse(r.stdout);
  return { control: c, pct: st.pct, muted: st.muted };
}

/* roteamento de saída do rk817 (alto-falante x fone). Em vários codecs Rockchip
 * existe um enum tipo "Playback Path" com valores SPK/HP/SPK_HP. Tentamos setá-lo;
 * se não existir, o jack-detect do hardware cuida do roteamento (saída "auto"). */
const PATH_CTRL = ["Playback Path", "Playback Route", "Output", "Speaker Function"];
const PATH_VAL = { speaker: ["SPK", "SPEAKER", "Speaker", "SPK_PATH"], headphone: ["HP", "HEADPHONE", "Headphone", "HP_PATH"] };
async function setPath(target) {
  let list = []; try { list = await controls(); } catch (e) {}
  for (const pc of PATH_CTRL) {
    if (list.indexOf(pc) === -1) continue;
    for (const v of (PATH_VAL[target] || [])) {
      const r = await run("amixer", ["sset", pc, v], { timeout: 3000 });
      if (r.ok) return pc + "=" + v;
    }
  }
  return null;   // sem controle de rota -> jack-detect automático
}

/** teste de áudio: roteia p/ o destino e toca um tom (440 Hz) p/ confirmar a saída.
 * target = "speaker" (alto-falante embutido) | "headphone" (fone). */
async function test(target) {
  target = target === "headphone" ? "headphone" : "speaker";
  const c = await pickControl();
  if (c) {
    await run("amixer", ["-M", "sset", c, "unmute"], { timeout: 3000 });          // desmuta
    const st = await get();
    if (st.pct >= 0 && st.pct < 40) await run("amixer", ["-M", "sset", c, "60%"], { timeout: 3000 }); // audível
  }
  const route = await setPath(target);
  const dest = target === "headphone" ? "fone" : "alto-falante";
  // speaker-test toca o tom nos canais e sai (-l 1). Timeout protege se travar.
  const r = await run("speaker-test", ["-t", "sine", "-f", "440", "-c", "2", "-l", "1"], { timeout: 9000 });
  const played = r.ok || r.timedOut;
  if (!played && /not found|ENOENT/.test(r.stderr || "")) throw err("INTERNAL", "speaker-test indisponível (instale alsa-utils)");
  return {
    ok: played, target: target, route: route || "auto (jack-detect)",
    msg: played ? "tom 440Hz no " + dest + (route ? " [" + route + "]" : "") + " — ouça" : "falha: " + (r.stderr || "").trim().split("\n").pop(),
  };
}

module.exports = { get, set, test, controls };
