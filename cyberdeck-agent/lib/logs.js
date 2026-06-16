"use strict";
/*
 * logs.js — fontes de log com limite de linhas e filtro de severidade.
 * Fontes allowlist: dmesg, journal, kiosk (cyberdeck-x), agent (cyberdeck-agent).
 * Nunca carrega o journal inteiro — sempre tail/-n.
 */
const { out } = require("./exec");

const SOURCES = {
  dmesg:   { kind: "dmesg" },
  journal: { kind: "journal" },
  agent:   { kind: "unit", unit: "cyberdeck-agent.service" },
  kiosk:   { kind: "unit", unit: "cyberdeck-x.service" },
  ui:      { kind: "unit", unit: "cyberdeck.service" },
};

// journalctl --priority aceita nomes: err, warning, info...
const SEVERITY = { error: "err", warning: "warning", info: "info" };

function err(code, message) { const e = new Error(message); e.code = code; return e; }

async function get(source, opts) {
  opts = opts || {};
  const src = SOURCES[source];
  if (!src) throw err("BAD_REQUEST", "fonte de log inválida: " + source);
  const n = String(Math.max(20, Math.min(800, parseInt(opts.lines, 10) || 200)));
  const sev = SEVERITY[opts.severity];
  let text = "";

  if (src.kind === "dmesg") {
    const args = ["--ctime"];
    if (opts.severity === "error") args.push("--level=err,crit,alert,emerg");
    else if (opts.severity === "warning") args.push("--level=err,crit,alert,emerg,warn");
    const r = await out("dmesg", args, { timeout: 5000 });
    text = tail(r, parseInt(n, 10));
  } else if (src.kind === "journal") {
    const args = ["-n", n, "--no-pager", "--output=short-iso"];
    if (sev) { args.push("-p", sev); }
    text = (await out("journalctl", args, { timeout: 6000 })).trim();
  } else if (src.kind === "unit") {
    const args = ["-u", src.unit, "-n", n, "--no-pager", "--output=short-iso"];
    if (sev) { args.push("-p", sev); }
    text = (await out("journalctl", args, { timeout: 6000 })).trim();
  }

  // busca simples (case-insensitive) feita no servidor p/ não mandar payload gigante
  if (opts.q) {
    const q = String(opts.q).toLowerCase();
    text = text.split("\n").filter((l) => l.toLowerCase().includes(q)).join("\n");
  }
  return { source, lines: text || "(sem saída)", severity: opts.severity || "all" };
}

function tail(s, n) {
  const arr = String(s || "").split("\n");
  return arr.slice(Math.max(0, arr.length - n)).join("\n");
}

function sources() { return Object.keys(SOURCES); }

module.exports = { get, sources, SOURCES };
