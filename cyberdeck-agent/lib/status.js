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
/* ---- estimativa de bateria por tensão (OCV) ----------------------------------
 * O fuel-gauge do rk817 é notoriamente NÃO-confiável no RK3326 (capacity "gruda",
 * vai a 100% ao carregar). Em vez do mapa linear 3.3–4.2V, usamos uma TABELA OCV
 * (curva real do 1S LiPo, bem não-linear) e compensamos a queda/elevação de tensão
 * sob corrente: OCV ≈ V + I·R (descarregando) ou V − I·R (carregando). O resultado
 * é suavizado (EMA). É ESTIMATIVA — exibida ao lado do dado bruto, nunca no lugar.
 * Curva refinável com medições do próprio aparelho (ver docs/hardware). */
const OCV_1S = [
  [4.20, 100], [4.15, 95], [4.11, 90], [4.08, 85], [4.02, 80], [3.98, 75], [3.95, 70],
  [3.91, 65], [3.87, 60], [3.85, 55], [3.84, 50], [3.82, 45], [3.80, 40], [3.79, 35],
  [3.77, 30], [3.75, 25], [3.73, 20], [3.71, 16], [3.69, 13], [3.61, 10], [3.50, 5], [3.30, 0],
];
const BATT_R_OHM = 0.25; // resistência interna+cabo aprox. (estimativa p/ compensar I·R)
let _emaEst = -1;
function estFromOcv(ocv) {
  if (ocv >= OCV_1S[0][0]) return 100;
  if (ocv <= OCV_1S[OCV_1S.length - 1][0]) return 0;
  for (let i = 0; i < OCV_1S.length - 1; i++) {
    const a = OCV_1S[i], b = OCV_1S[i + 1];
    if (ocv <= a[0] && ocv >= b[0]) {
      const t = (ocv - b[0]) / (a[0] - b[0]);
      return Math.round(b[1] + t * (a[1] - b[1]));
    }
  }
  return -1;
}

function battery() {
  const base = "/sys/class/power_supply";
  const out = { pct: -1, status: "", ac: -1, supply: "", volt: -1, curr: -1, level: "", est: -1, ocv: -1, capacity_trust: "ok" };
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
      if (out.volt > 0) {
        // compensa I·R p/ aproximar a tensão de circuito aberto (OCV)
        const iA = out.curr !== -1 ? Math.abs(out.curr) / 1000 : 0;
        let ocv = out.volt;
        if (/Discharging/i.test(out.status)) ocv = out.volt + iA * BATT_R_OHM;   // sob carga: V cai
        else if (/Charging/i.test(out.status)) ocv = out.volt - iA * BATT_R_OHM; // carregando: V sobe
        out.ocv = +ocv.toFixed(2);
        let e = estFromOcv(ocv);
        // suaviza (EMA) p/ não pular; reinicia se saltar muito (troca de estado)
        if (e >= 0) { _emaEst = (_emaEst < 0 || Math.abs(e - _emaEst) > 25) ? e : Math.round(_emaEst * 0.8 + e * 0.2); e = _emaEst; }
        out.est = clamp(e, 0, 100);
      }
    } else {
      const on = rdInt(`${base}/${n}/online`);
      if (on === 1) out.ac = 1; else if (on === 0 && out.ac < 0) out.ac = 0;
    }
  }
  // capacity "gruda" em 100% sem estar Full, ou diverge muito da estimativa OCV -> baixa confiança
  if ((out.pct === 100 && out.status && !/Full/i.test(out.status)) ||
      (out.pct >= 0 && out.est >= 0 && Math.abs(out.pct - out.est) > 25)) {
    out.capacity_trust = "low";
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
