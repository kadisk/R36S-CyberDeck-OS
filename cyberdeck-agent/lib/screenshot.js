"use strict";
/*
 * screenshot.js — captura a tela e salva em PNG (agente roda como root).
 * Estratégia (em ordem):
 *   1) fbgrab  — lê /dev/fb0 direto (não precisa de DISPLAY/X auth). Ideal p/ fbdev.
 *   2) scrot   — fallback no DISPLAY :0 (precisa do X).
 * Salva em /root/screenshots/v<versão>/shot-NNNN.png (sequencial, NÃO por data —
 * o RTC do R36S não é confiável) — navegável pela aba FS.
 */
const fs = require("fs");
const { run } = require("./exec");

const DIR = "/root/screenshots";

/* organiza por VERSÃO da UI: /root/screenshots/v0.6.0/shot-0001.png … */
function safeVer(v) { v = String(v == null ? "" : v).trim().replace(/^v/i, ""); return /^[0-9A-Za-z._-]{1,24}$/.test(v) ? v : "unknown"; }
function dirFor(version) { return DIR + "/v" + safeVer(version); }

/* nome SEQUENCIAL por pasta (a data/RTC do R36S não é confiável): shot-0001.png… */
function nextName(dir) {
  let max = 0;
  try {
    for (const f of fs.readdirSync(dir)) {
      const m = f.match(/^shot-(\d+)\.png$/);
      if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
    }
  } catch (e) {}
  return "shot-" + String(max + 1).padStart(4, "0") + ".png";
}
function ok(file) { try { return fs.statSync(file).size > 0; } catch (e) { return false; } }

async function capture(version) {
  const sub = dirFor(version);
  try { fs.mkdirSync(sub, { recursive: true }); } catch (e) {}
  const file = sub + "/" + nextName(sub);

  // 1) fbgrab (framebuffer direto)
  let r = await run("fbgrab", [file], { timeout: 9000 });
  let tool = "fbgrab";

  // 2) scrot no display :0
  if (!ok(file)) {
    tool = "scrot";
    r = await run("scrot", ["-o", file], { timeout: 9000, env: { DISPLAY: ":0", XAUTHORITY: "/root/.Xauthority" } });
  }

  if (!ok(file)) {
    const e = new Error("falha ao capturar a tela (fbgrab/scrot indisponíveis?): " + ((r && (r.stderr || r.stdout)) || "").trim());
    e.code = "INTERNAL"; throw e;
  }
  let size = -1; try { size = fs.statSync(file).size; } catch (e) {}
  return { file: file, dir: sub, version: safeVer(version), tool: tool, bytes: size };
}

module.exports = { capture, DIR };
