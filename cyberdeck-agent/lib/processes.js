"use strict";
/*
 * processes.js — monitor de processos lendo /proc (sem depender de `ps`).
 * CPU% é instantâneo (delta entre duas listagens). Sinais via process.kill
 * com allowlist (SIGTERM/SIGKILL/SIGHUP/SIGINT).
 */
const fs = require("fs");
const os = require("os");
const { rd, rdInt } = require("./util");

const CLK_TCK = 100;            // padrão no Linux/arm
const PAGE = 4096;              // tamanho de página (RK3326)
const SIGNALS = new Set(["SIGTERM", "SIGKILL", "SIGHUP", "SIGINT"]);

function err(code, message) { const e = new Error(message); e.code = code; return e; }

/* uid -> nome (cache simples lido de /etc/passwd). */
let _uidMap = null;
function uidName(uid) {
  if (!_uidMap) {
    _uidMap = {};
    for (const line of rd("/etc/passwd").split("\n")) {
      const p = line.split(":");
      if (p.length >= 3) _uidMap[p[2]] = p[0];
    }
  }
  return _uidMap[String(uid)] || String(uid);
}

/* delta de CPU por pid entre chamadas. */
let _prev = new Map();
let _prevTime = 0;

function parseStat(pid) {
  const raw = rd(`/proc/${pid}/stat`);
  if (!raw) return null;
  const lp = raw.indexOf("(");
  const rp = raw.lastIndexOf(")");
  if (lp < 0 || rp < 0) return null;
  const comm = raw.slice(lp + 1, rp);
  const rest = raw.slice(rp + 2).split(/\s+/);
  // rest[0]=state, [1]=ppid ... offsets a partir do campo 3 (state)
  return {
    pid: parseInt(pid, 10),
    comm,
    state: rest[0],
    ppid: parseInt(rest[1], 10),
    utime: parseInt(rest[11], 10) || 0,
    stime: parseInt(rest[12], 10) || 0,
    starttime: parseInt(rest[19], 10) || 0,
    vsize: parseInt(rest[20], 10) || 0,
    rss_pages: parseInt(rest[21], 10) || 0,
  };
}

function statusFields(pid) {
  const o = {};
  for (const line of rd(`/proc/${pid}/status`).split("\n")) {
    const m = line.match(/^(\w+):\s+(.*)$/);
    if (m) o[m[1]] = m[2].trim();
  }
  return o;
}

function cmdline(pid) {
  const raw = rd(`/proc/${pid}/cmdline`);
  if (!raw) return "";
  return raw.replace(/\0+$/g, "").split("\0").join(" ").trim();
}

function pidList() {
  let names = [];
  try { names = fs.readdirSync("/proc"); } catch (e) { return []; }
  return names.filter((n) => /^\d+$/.test(n));
}

/** Lista completa com resumo agregado. */
function list() {
  const now = Date.now();
  const dt = _prevTime ? (now - _prevTime) / 1000 : 0;
  const totalRam = os.totalmem();
  const cur = new Map();
  const rows = [];
  const summary = { total: 0, running: 0, sleeping: 0, stopped: 0, zombie: 0, other: 0 };

  for (const pid of pidList()) {
    const st = parseStat(pid);
    if (!st) continue;
    summary.total++;
    switch (st.state) {
      case "R": summary.running++; break;
      case "S": case "D": summary.sleeping++; break;
      case "T": case "t": summary.stopped++; break;
      case "Z": summary.zombie++; break;
      default: summary.other++;
    }
    const jiffies = st.utime + st.stime;
    cur.set(st.pid, jiffies);
    let cpu = 0;
    if (dt > 0 && _prev.has(st.pid)) {
      const dj = jiffies - _prev.get(st.pid);
      cpu = (100 * (dj / CLK_TCK)) / dt; // % de UM core
    }
    const stf = statusFields(pid);
    const uid = (stf.Uid || "0").split(/\s+/)[0];
    const rssMb = +((st.rss_pages * PAGE) / 1048576).toFixed(1);
    rows.push({
      pid: st.pid,
      ppid: st.ppid,
      user: uidName(uid),
      state: st.state,
      cpu: +cpu.toFixed(1),
      mem_pct: +((st.rss_pages * PAGE * 100) / totalRam).toFixed(1),
      rss_mb: rssMb,
      vsz_mb: +(st.vsize / 1048576).toFixed(1),
      comm: st.comm,
      cmd: cmdline(pid) || st.comm,
    });
  }
  _prev = cur;
  _prevTime = now;

  rows.sort((a, b) => b.cpu - a.cpu);
  const topCpu = rows[0] || null;
  const topMem = rows.slice().sort((a, b) => b.rss_mb - a.rss_mb)[0] || null;
  summary.cpu_total = +rows.reduce((s, r) => s + r.cpu, 0).toFixed(1);
  summary.mem_total_pct = +rows.reduce((s, r) => s + r.mem_pct, 0).toFixed(1);
  summary.top_cpu = topCpu ? { pid: topCpu.pid, comm: topCpu.comm, cpu: topCpu.cpu } : null;
  summary.top_mem = topMem ? { pid: topMem.pid, comm: topMem.comm, rss_mb: topMem.rss_mb } : null;

  return { summary, processes: rows };
}

/** Detalhe de um PID. */
function detail(pid) {
  pid = parseInt(pid, 10);
  if (!Number.isInteger(pid) || pid <= 0) throw err("BAD_REQUEST", "pid inválido");
  const st = parseStat(pid);
  if (!st) throw err("NOT_FOUND", "processo não existe: " + pid);
  const stf = statusFields(pid);
  const safe = (fn) => { try { return fn(); } catch (e) { return ""; } };
  const fdCount = (() => { try { return fs.readdirSync(`/proc/${pid}/fd`).length; } catch (e) { return -1; } })();
  const children = pidList().map(parseStat).filter((p) => p && p.ppid === pid).map((p) => ({ pid: p.pid, comm: p.comm }));
  const uid = (stf.Uid || "0").split(/\s+/)[0];
  return {
    pid,
    ppid: st.ppid,
    comm: st.comm,
    state: st.state,
    user: uidName(uid),
    cmdline: cmdline(pid) || st.comm,
    exe: safe(() => fs.readlinkSync(`/proc/${pid}/exe`)),
    cwd: safe(() => fs.readlinkSync(`/proc/${pid}/cwd`)),
    cgroup: rd(`/proc/${pid}/cgroup`).trim().split("\n").slice(0, 3).join("\n"),
    fd_count: fdCount,
    threads: parseInt(stf.Threads, 10) || -1,
    vm_rss: stf.VmRSS || "",
    vm_size: stf.VmSize || "",
    vm_peak: stf.VmPeak || "",
    status: rd(`/proc/${pid}/status`).trim(),
    children,
  };
}

/** Envia sinal (allowlist). */
function signal(pid, sig) {
  pid = parseInt(pid, 10);
  if (!Number.isInteger(pid) || pid <= 1) throw err("BAD_REQUEST", "pid inválido");
  if (!SIGNALS.has(sig)) throw err("NOT_ALLOWED", "sinal não permitido: " + sig);
  try { process.kill(pid, sig); return { pid, signal: sig, sent: true }; }
  catch (e) {
    if (e.code === "ESRCH") throw err("NOT_FOUND", "processo não existe");
    if (e.code === "EPERM") throw err("PERMISSION_DENIED", "sem permissão p/ sinalizar " + pid);
    throw err("INTERNAL", e.message);
  }
}

module.exports = { list, detail, signal, SIGNALS };
