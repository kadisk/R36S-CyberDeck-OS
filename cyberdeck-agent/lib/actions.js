"use strict";
/*
 * actions.js — AÇÕES administrativas (allowlist). As "perigosas" exigem
 * confirmação na UI; o backend só executa chaves conhecidas.
 */
const fs = require("fs");
const { rdInt } = require("./util");
const { backlightDir } = require("./status");
const { run } = require("./exec");
const volume = require("./volume");
const wifi = require("./wifi");
const storage = require("./storage");

function wifiMsg(s) {
  if (!s) return "Wi-Fi: sem estado";
  if (s.state === "no-device") return "Wi-Fi: dongle não detectado";
  if (s.connected) return "Wi-Fi: conectado a " + (s.ssid || "?") + (s.ip ? " · " + s.ip : "");
  return "Wi-Fi: " + (s.state || "desconectado") + (s.ssid ? " (" + s.ssid + ")" : "");
}

function err(code, message) { const e = new Error(message); e.code = code; return e; }

/* volume via lib/volume.js (descobre o controle do rk817). Retorna {msg}. */
async function vol(arg) {
  const r = await volume.set(arg);
  return { msg: "volume " + (r.pct >= 0 ? r.pct + "%" : "ok") + (r.muted ? " (mudo)" : ""), control: r.control };
}

/* preferência de interface (lida pelo cyberdeck-chooser/cyberdeck-session): web | fb */
function setInterface(which) {
  try {
    fs.mkdirSync("/var/lib/cyberdeck", { recursive: true });
    fs.writeFileSync("/var/lib/cyberdeck/interface", which + "\n");
  } catch (e) { throw err("INTERNAL", "falha ao gravar interface: " + e.message); }
}

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
  "volume-up":      { label: "Volume +",                    dangerous: false, fn: async () => vol("5%+") },
  "volume-down":    { label: "Volume −",                    dangerous: false, fn: async () => vol("5%-") },
  "volume-mute":    { label: "Mudo (alternar)",             dangerous: false, fn: async () => vol("toggle") },
  "audio-test-spk": { label: "Testar alto-falante",         dangerous: false, fn: async () => { const r = await volume.test("speaker"); return { msg: r.msg }; } },
  "audio-test-hp":  { label: "Testar fone",                 dangerous: false, fn: async () => { const r = await volume.test("headphone"); return { msg: r.msg }; } },
  "wifi-up":        { label: "Conectar Wi-Fi",              dangerous: false, fn: async () => { const r = await wifi.up();       return { msg: wifiMsg(r.status), status: r.status }; } },
  "wifi-reconnect": { label: "Reconectar Wi-Fi",            dangerous: false, fn: async () => { const r = await wifi.reconnect(); return { msg: wifiMsg(r.status), status: r.status }; } },
  "wifi-down":      { label: "Desligar Wi-Fi",              dangerous: false, fn: async () => { const s = await wifi.down();     return { msg: "Wi-Fi desligado", status: s }; } },
  "reload-ui":      { label: "Recarregar UI",               dangerous: true,  fn: async () => svc("restart", "cyberdeck-session.service", "recarregando UI") },
  "restart-agent":  { label: "Reiniciar cyberdeck-agent",   dangerous: true,  fn: async () => svc("restart", "cyberdeck-agent.service", "reiniciando agente") },
  "restart-kiosk":  { label: "Reiniciar sessão",            dangerous: true,  fn: async () => svc("restart", "cyberdeck-session.service", "reiniciando sessão") },
  "expand-rootfs":  { label: "Expandir rootfs",             dangerous: true,  fn: async () => { const r = await storage.expand(); return { msg: r.msg }; } },
  "interface-web":  { label: "Interface: Web",              dangerous: true,  fn: async () => { setInterface("web"); return svc("restart", "cyberdeck-session.service", "trocando p/ Web (reiniciando sessão)"); } },
  "interface-fb":   { label: "Interface: Nativa",           dangerous: true,  fn: async () => { setInterface("fb");  return svc("restart", "cyberdeck-session.service", "trocando p/ Nativa (reiniciando sessão)"); } },
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
