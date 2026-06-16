"use strict";
/*
 * network.js — rede detalhada. Prefere /sys/class/net e poucos comandos
 * (ip, ss, iwgetid) com fallback gracioso quando não existirem.
 */
const fs = require("fs");
const os = require("os");
const { rd, rdInt } = require("./util");
const { out } = require("./exec");

function ifaceState(name) {
  const base = `/sys/class/net/${name}`;
  const speed = rdInt(`${base}/speed`);
  return {
    name,
    mac: rd(`${base}/address`).trim(),
    operstate: rd(`${base}/operstate`).trim(),
    mtu: rdInt(`${base}/mtu`),
    speed_mbps: speed > 0 ? speed : -1,
    carrier: rdInt(`${base}/carrier`) === 1,
    rx_bytes: rdInt(`${base}/statistics/rx_bytes`),
    tx_bytes: rdInt(`${base}/statistics/tx_bytes`),
    rx_errors: rdInt(`${base}/statistics/rx_errors`),
    tx_errors: rdInt(`${base}/statistics/tx_errors`),
    wireless: fs.existsSync(`${base}/wireless`) || fs.existsSync(`${base}/phy80211`),
  };
}

function interfaces() {
  let names = [];
  try { names = fs.readdirSync("/sys/class/net"); } catch (e) {}
  const ipMap = {};
  const nis = os.networkInterfaces();
  for (const n in nis) ipMap[n] = nis[n].map((a) => ({ family: (a.family === 4 || a.family === "IPv4") ? "v4" : "v6", address: a.address }));
  return names.filter((n) => n !== "lo").map((n) => {
    const st = ifaceState(n);
    st.addrs = ipMap[n] || [];
    return st;
  });
}

async function summary() {
  const route = (await out("ip", ["route"], { timeout: 2500 })).trim();
  const gw = (route.match(/default via (\S+)/) || [])[1] || "";
  const dev = (route.match(/default via \S+ dev (\S+)/) || [])[1] || "";
  const ssid = (await out("iwgetid", ["-r"], { timeout: 2000 })).trim();
  let signal = -1;
  if (ssid && dev) {
    const wl = await out("sh", ["-c", `cat /proc/net/wireless 2>/dev/null`], { timeout: 1500 });
    const line = wl.split("\n").find((l) => l.includes(dev + ":"));
    if (line) { const m = line.trim().split(/\s+/); if (m[3]) signal = parseInt(m[3], 10); }
  }
  return {
    interfaces: interfaces(),
    gateway: gw,
    default_iface: dev,
    dns: (rd("/etc/resolv.conf").match(/nameserver\s+(\S+)/g) || []).map((s) => s.split(/\s+/)[1]),
    ssid: ssid || "",
    signal_dbm: signal,
  };
}

async function routes() {
  const r = await out("ip", ["route"], { timeout: 2500 });
  return r.split("\n").map((l) => l.trim()).filter(Boolean);
}

/** Conexões/portas via `ss`; cai p/ /proc/net se ss faltar. Limitado. */
async function connections(limit) {
  limit = limit || 120;
  const r = await out("ss", ["-tunap"], { timeout: 3000 });
  if (r) {
    const lines = r.split("\n").map((l) => l.trim()).filter(Boolean);
    return { source: "ss", rows: lines.slice(0, limit + 1) };
  }
  // fallback bruto
  const tcp = rd("/proc/net/tcp").split("\n").slice(1).filter(Boolean).length;
  return { source: "proc", rows: [`(ss indisponível) conexões tcp aproximadas: ${tcp}`] };
}

module.exports = { summary, interfaces, routes, connections };
