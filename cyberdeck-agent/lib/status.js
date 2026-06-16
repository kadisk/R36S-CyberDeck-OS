"use strict";
/*
 * status.js — métricas leves de polling (CPU%, RAM, load, temp, bateria, brilho).
 * Tudo via /proc e /sys (rápido); seguro p/ chamar a cada 2s.
 */
const fs = require("fs");
const os = require("os");
const { rd, rdInt, clamp } = require("./util");

/* CPU % global por delta entre chamadas. */
let prevIdle = 0, prevTotal = 0;
function cpuPct() {
  const c = os.cpus();
  let idle = 0, total = 0;
  for (const cpu of c) { for (const t in cpu.times) total += cpu.times[t]; idle += cpu.times.idle; }
  let pct = -1;
  if (prevTotal && total > prevTotal) { const dt = total - prevTotal, di = idle - prevIdle; pct = (100 * (dt - di)) / dt; }
  prevTotal = total; prevIdle = idle;
  return pct < 0 ? -1 : +pct.toFixed(1);
}

/** Diretório do backlight (primeiro encontrado). */
function backlightDir() {
  try { const d = fs.readdirSync("/sys/class/backlight"); return d.length ? `/sys/class/backlight/${d[0]}` : null; }
  catch (e) { return null; }
}
function backlight() {
  const dir = backlightDir();
  if (!dir) return { cur: -1, max: -1, pct: -1 };
  const cur = rdInt(`${dir}/brightness`), max = rdInt(`${dir}/max_brightness`);
  return { cur, max, pct: max > 0 ? Math.round((100 * cur) / max) : -1 };
}

/* Bateria rk817 — capacity costuma travar; expõe tensão e estimativa por tensão. */
function battery() {
  const base = "/sys/class/power_supply";
  const out = { pct: -1, status: "", ac: -1, supply: "", volt: -1, curr: -1, level: "", est: -1 };
  let names = [];
  try { names = fs.readdirSync(base); } catch (e) { return out; }
  for (const n of names) {
    const type = rd(`${base}/${n}/type`).trim();
    if (type === "Battery") {
      out.supply = n;
      out.pct = rdInt(`${base}/${n}/capacity`);
      out.status = rd(`${base}/${n}/status`).trim();
      out.level = rd(`${base}/${n}/capacity_level`).trim();
      const uv = rdInt(`${base}/${n}/voltage_now`); if (uv > 0) out.volt = +(uv / 1e6).toFixed(2);
      const ua = rdInt(`${base}/${n}/current_now`); if (ua !== -1) out.curr = Math.round(ua / 1000);
      if (out.volt > 0) out.est = clamp(Math.round(((out.volt - 3.3) / (4.2 - 3.3)) * 100), 0, 100);
    } else {
      const on = rdInt(`${base}/${n}/online`);
      if (on === 1) out.ac = 1; else if (on === 0 && out.ac < 0) out.ac = 0;
    }
  }
  return out;
}

function netList() {
  const ifs = os.networkInterfaces(), out = [];
  for (const name in ifs) {
    if (name === "lo") continue;
    for (const a of ifs[name]) {
      if (a.family === "IPv4" || a.family === 4) out.push({ iface: name, ip: a.address, mac: a.mac, up: 1 });
    }
  }
  return out;
}

function get() {
  const total = os.totalmem(), free = os.freemem();
  const t = rdInt("/sys/class/thermal/thermal_zone0/temp");
  return {
    cpu: cpuPct(),
    cores: os.cpus().length,
    mem: { used: Math.round((total - free) / 1048576), total: Math.round(total / 1048576), pct: +(100 * (total - free) / total).toFixed(1) },
    load: os.loadavg().map((x) => x.toFixed(2)).join(" "),
    load_arr: os.loadavg().map((x) => +x.toFixed(2)),
    uptime: os.uptime(),
    temp: t > 0 ? +(t / 1000).toFixed(1) : -1,
    battery: battery(),
    brightness: backlight(),
    net: netList(),
    host: os.hostname(),
    time: new Date().toISOString(),
  };
}

module.exports = { get, backlightDir, backlight, battery, netList };
