"use strict";
/*
 * actions.js — AÇÕES administrativas (allowlist). As "perigosas" exigem
 * confirmação na UI; o backend só executa chaves conhecidas.
 */
const fs = require("fs");
const { rdInt } = require("./util");
const { backlightDir } = require("./status");
const { run } = require("./exec");

function err(code, message) { const e = new Error(message); e.code = code; return e; }

function setBright(delta) {
  const dir = backlightDir();
  if (!dir) return "sem backlight";
  const max = rdInt(`${dir}/max_brightness`), cur = rdInt(`${dir}/brightness`);
  if (max <= 0) return "backlight sem max_brightness";
  const v = Math.max(1, Math.min(max, cur + Math.round(max * delta)));
  try { fs.writeFileSync(`${dir}/brightness`, String(v)); return `brilho=${v}/${max}`; }
  catch (e) { throw err("PERMISSION_DENIED", "falha ao escrever brilho: " + e.message); }
}

// dangerous=true -> a UI deve exigir confirmação em tela cheia.
const ACTIONS = {
  "bright-up":      { label: "Brilho +",                    dangerous: false, fn: async () => ({ msg: setBright(+0.1) }) },
  "bright-down":    { label: "Brilho −",                    dangerous: false, fn: async () => ({ msg: setBright(-0.1) }) },
  "reload-ui":      { label: "Recarregar UI",               dangerous: true,  fn: async () => svc("restart", "cyberdeck-x.service", "recarregando UI") },
  "restart-agent":  { label: "Reiniciar cyberdeck-agent",   dangerous: true,  fn: async () => svc("restart", "cyberdeck-agent.service", "reiniciando agente") },
  "restart-kiosk":  { label: "Reiniciar kiosk",             dangerous: true,  fn: async () => svc("restart", "cyberdeck.service", "reiniciando kiosk") },
  "reboot":         { label: "Reiniciar sistema",           dangerous: true,  fn: async () => later("reboot", "reiniciando") },
  "poweroff":       { label: "Desligar sistema",            dangerous: true,  fn: async () => later("poweroff", "desligando") },
};

async function svc(act, unit, msg) {
  // dispara sem bloquear (a própria UI pode ser reiniciada por essa ação)
  run("systemctl", [act, unit], { timeout: 8000 });
  return { msg, unit, action: act };
}
async function later(what, msg) {
  run("sh", ["-c", `sleep 1 && systemctl ${what}`], { timeout: 4000 });
  return { msg };
}

function list() {
  return Object.keys(ACTIONS).map((k) => ({ key: k, label: ACTIONS[k].label, dangerous: ACTIONS[k].dangerous }));
}

async function run_(key) {
  const a = ACTIONS[key];
  if (!a) throw err("NOT_ALLOWED", "ação desconhecida: " + key);
  const data = await a.fn();
  return Object.assign({ action: key, dangerous: a.dangerous }, data);
}

module.exports = { list, run: run_, ACTIONS };
