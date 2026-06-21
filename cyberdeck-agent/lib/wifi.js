"use strict";
/*
 * wifi.js — controle do Wi-Fi (dongle USB) via /usr/local/bin/cyberdeck-net.sh.
 * Mantém a lógica num único lugar (o script); o agente só expõe status/ações.
 */
const { out } = require("./exec");

const NET = "/usr/local/bin/cyberdeck-net.sh";

/* roda um subcomando do gerenciador e devolve stdout (string). */
function call(cmd, timeout) {
  return out("sh", [NET, cmd], { timeout: timeout || 25000 });
}

function parseKV(s) {
  const o = {};
  String(s).split("\n").forEach((l) => {
    const m = l.match(/^(\w+)=(.*)$/);
    if (m) o[m[1]] = m[2];
  });
  return o;
}

async function status() {
  const st = parseKV(await call("status", 6000));
  st.connected = st.state === "COMPLETED" && !!st.ip;
  return st;
}

async function up() {
  const log = await call("up", 30000);
  return { log: log, status: await status() };
}

async function down() {
  await call("down", 10000);
  return await status();
}

async function reconnect() {
  const log = await call("reconnect", 35000);
  return { log: log, status: await status() };
}

async function scan() {
  const r = await call("scan", 15000);
  return { ssids: r.split("\n").map((x) => x.trim()).filter(Boolean) };
}

module.exports = { status, up, down, reconnect, scan };
