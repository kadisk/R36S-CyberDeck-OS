"use strict";
/*
 * health.js — "Saúde do Sistema" agregada p/ a HOME/header.
 * Combina o status leve (já barato) com um resumo systemd cacheado (10s, pois
 * systemctl é mais caro). Devolve um nível geral (ok|warn|crit) + lista de alertas
 * acionáveis ({level,label,target}). Thresholds centralizados aqui.
 */
const status = require("./status");
const { out } = require("./exec");
const { cached } = require("./util");

/* ---- thresholds (mesma régua usada na UI) ---- */
function levelTemp(c) { if (c < 0) return "ok"; return c >= 80 ? "crit" : c >= 65 ? "warn" : "ok"; }
function levelLoadPerCore(load, cores) { if (load < 0 || !cores) return "ok"; const n = load / cores; return n > 1.25 ? "crit" : n >= 0.75 ? "warn" : "ok"; }
function levelRam(pct) { return pct > 90 ? "crit" : pct >= 75 ? "warn" : "ok"; }
function levelBattVolt(v) { if (v <= 0) return "ok"; return v < 3.55 ? "crit" : v <= 3.75 ? "warn" : "ok"; }
function worst(a, b) { const r = { ok: 0, warn: 1, crit: 2 }; return r[b] > r[a] ? b : a; }

/* resumo systemd enxuto e cacheado (state + nº de falhas) */
function systemdLite() {
  return cached("health-systemd", 10000, async () => {
    const state = (await out("systemctl", ["is-system-running"], { timeout: 3000 })).trim() || "?";
    const failedRaw = await out("systemctl", ["--failed", "--no-legend", "--plain", "--no-pager"], { timeout: 4000 });
    const failed = failedRaw.split("\n").map(l => l.trim()).filter(Boolean);
    return { state, failed_count: failed.length, failed_units: failed.map(l => l.split(/\s+/)[0]).filter(Boolean).slice(0, 6) };
  });
}

async function get() {
  const st = status.get();
  const sd = await systemdLite();
  const items = [];
  let level = "ok";
  const add = (lvl, label, target) => { items.push({ level: lvl, label: label, target: target }); level = worst(level, lvl); };

  // systemd
  if (sd.failed_count > 0) add("warn", sd.failed_count + " serviço(s) com falha" + (sd.failed_units[0] ? ": " + sd.failed_units[0].replace(/\.service$/, "") : ""), "systemd");
  else if (sd.state && sd.state !== "running" && sd.state !== "?") add("warn", "systemd " + sd.state, "systemd");

  // temperatura
  const tl = levelTemp(st.temp); if (tl !== "ok") add(tl, "temperatura " + st.temp + "°C", "status");
  // RAM
  const rl = levelRam(st.mem.pct); if (rl !== "ok") add(rl, "RAM " + Math.round(st.mem.pct) + "%", "status");
  // rede
  const hasIp = !!(st.net && st.net.length);
  if (!hasIp) add("warn", "sem rede / sem IP", "network");
  // bateria (só alerta se NÃO estiver na tomada)
  const b = st.battery || {};
  if (b.ac !== 1) { const bl = levelBattVolt(b.volt); if (bl !== "ok") add(bl, "bateria baixa (" + (b.volt > 0 ? b.volt + "V" : "?") + ")", "status"); }
  // load
  const load1 = st.load_arr ? st.load_arr[0] : -1;
  const ll = levelLoadPerCore(load1, st.cores); if (ll !== "ok") add(ll, "load " + load1 + " / " + st.cores + " cores", "status");

  return {
    level: level,
    items: items,
    summary: {
      uptime: st.uptime, cores: st.cores,
      temp: st.temp, load: load1,
      mem_pct: +st.mem.pct.toFixed ? +st.mem.pct.toFixed(0) : st.mem.pct,
      net_ip: hasIp ? st.net[0].ip : null,
      bat_est: b.est, bat_volt: b.volt, bat_ac: b.ac, bat_trust: b.capacity_trust,
      systemd: sd.state, failed: sd.failed_count, failed_units: sd.failed_units,
    },
  };
}

module.exports = { get };
