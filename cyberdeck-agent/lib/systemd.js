"use strict";
/*
 * systemd.js — resumo, lista, detalhe, logs e AÇÕES controladas.
 *
 * Segurança:
 *   - nome de unit validado por regex estrita (sem espaços/;/&/| etc);
 *   - ações restritas a uma allowlist (start/stop/restart/enable/disable);
 *   - sempre execFile (sem shell). A confirmação fica na UI.
 */
const { run, out } = require("./exec");

const UNIT_RE = /^[A-Za-z0-9@._:\\-]+\.(service|socket|target|timer|mount|path|slice|scope|device|swap)$/;
const ACTIONS = new Set(["start", "stop", "restart", "reload", "enable", "disable"]);

function err(code, message) { const e = new Error(message); e.code = code; return e; }
function validUnit(u) { return typeof u === "string" && u.length <= 128 && UNIT_RE.test(u); }

async function summary() {
  const state = (await out("systemctl", ["is-system-running"], { timeout: 3000 })).trim() || "?";
  const analyze = (await out("systemd-analyze", [], { timeout: 4000 })).trim().split("\n")[0] || "";
  const target = (await out("systemctl", ["get-default"], { timeout: 2000 })).trim();
  const allUnits = await out("systemctl", ["list-units", "--type=service", "--all", "--no-pager", "--plain", "--no-legend"], { timeout: 5000 });
  const lines = allUnits.split("\n").map((l) => l.trim()).filter(Boolean);
  let running = 0, failed = 0;
  for (const l of lines) {
    const p = l.split(/\s+/);
    if (p[2] === "active" && p[3] === "running") running++;
    if (p[2] === "failed" || p[3] === "failed") failed++;
  }
  return {
    state,
    boot: analyze,
    default_target: target,
    units_total: lines.length,
    running,
    failed,
  };
}

/** Lista de serviços com load/active/sub/descrição. */
async function services() {
  const raw = await out("systemctl", ["list-units", "--type=service", "--all", "--no-pager", "--plain", "--no-legend"], { timeout: 6000 });
  const out_ = [];
  for (const line of raw.split("\n")) {
    const l = line.trim();
    if (!l) continue;
    const m = l.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/);
    if (!m) continue;
    out_.push({ unit: m[1], load: m[2], active: m[3], sub: m[4], description: m[5] });
  }
  return out_;
}

/** Detalhe de um serviço: status + propriedades + unit file. */
async function service(unit) {
  if (!validUnit(unit)) throw err("BAD_REQUEST", "unit inválida");
  const props = await out("systemctl", ["show", unit,
    "--property=Id,Description,LoadState,ActiveState,SubState,UnitFileState,MainPID,MemoryCurrent,ExecMainStartTimestamp,FragmentPath,Restart,ActiveEnterTimestamp"],
    { timeout: 4000 });
  const p = {};
  for (const line of props.split("\n")) { const i = line.indexOf("="); if (i > 0) p[line.slice(0, i)] = line.slice(i + 1); }
  const statusText = await out("systemctl", ["status", unit, "--no-pager", "-n", "0"], { timeout: 4000 });
  let unitFile = "";
  if (p.FragmentPath) unitFile = await out("cat", [p.FragmentPath], { timeout: 2000 });
  const mem = parseInt(p.MemoryCurrent, 10);
  return {
    unit,
    id: p.Id || unit,
    description: p.Description || "",
    load: p.LoadState || "",
    active: p.ActiveState || "",
    sub: p.SubState || "",
    enabled: p.UnitFileState || "",
    main_pid: parseInt(p.MainPID, 10) || 0,
    memory_mb: Number.isFinite(mem) && mem > 0 ? +(mem / 1048576).toFixed(1) : -1,
    started: p.ActiveEnterTimestamp || p.ExecMainStartTimestamp || "",
    restart: p.Restart || "",
    fragment_path: p.FragmentPath || "",
    status_text: statusText.trim(),
    unit_file: unitFile.trim(),
  };
}

/** Logs recentes via journalctl -u. */
async function logs(unit, lines) {
  if (!validUnit(unit)) throw err("BAD_REQUEST", "unit inválida");
  const n = String(Math.max(10, Math.min(500, parseInt(lines, 10) || 150)));
  const r = await out("journalctl", ["-u", unit, "-n", n, "--no-pager", "--output=short-iso"], { timeout: 6000 });
  return { unit, lines: r.trim() || "(sem logs)" };
}

/** Ação controlada (allowlist). A confirmação é responsabilidade da UI. */
async function action(act, unit) {
  if (!ACTIONS.has(act)) throw err("NOT_ALLOWED", "ação não permitida: " + act);
  if (!validUnit(unit)) throw err("BAD_REQUEST", "unit inválida");
  const r = await run("systemctl", [act, unit], { timeout: 8000 });
  return {
    action: act,
    unit,
    ok: r.ok,
    code: r.code,
    output: (r.stdout + r.stderr).trim() || (r.ok ? "ok" : "falhou"),
  };
}

module.exports = { summary, services, service, logs, action, validUnit, ACTIONS };
