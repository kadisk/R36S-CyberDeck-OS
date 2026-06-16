"use strict";
/*
 * settings.js — preferências persistentes da UI (ex.: escala de fonte).
 * Guarda um JSON pequeno em /var/lib/cyberdeck/settings.json (agente roda como root).
 * A UI lê no boot e grava ao mudar — assim a preferência sobrevive a reload/reboot
 * (localStorage em file:// é instável no Chromium, por isso persistimos no agente).
 */
const fs = require("fs");
const path = require("path");

const DIR = "/var/lib/cyberdeck";
const FILE = path.join(DIR, "settings.json");
const DEFAULTS = { fontScale: 1 };

function read() {
  try { return Object.assign({}, DEFAULTS, JSON.parse(fs.readFileSync(FILE, "utf8"))); }
  catch (e) { return Object.assign({}, DEFAULTS); }
}

function write(patch) {
  const next = Object.assign(read(), patch || {});
  // sanitiza
  let fsv = Number(next.fontScale);
  if (!isFinite(fsv)) fsv = 1;
  next.fontScale = Math.max(0.7, Math.min(1.8, Math.round(fsv * 100) / 100));
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(next));
  } catch (e) {
    const er = new Error("não foi possível salvar settings: " + e.message);
    er.code = "INTERNAL"; throw er;
  }
  return next;
}

module.exports = { read, write, DEFAULTS };
