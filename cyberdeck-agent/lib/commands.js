"use strict";
/*
 * commands.js — ALLOWLIST de comandos "prontos" (substitui o /api/exec livre).
 *
 * A UI nunca manda uma string de shell: manda só uma CHAVE conhecida daqui.
 * Cada comando é (file, args[]) — execFile, sem shell. Read-only/diagnóstico.
 */
const { run } = require("./exec");

const COMMANDS = {
  // sistema
  uname:       { cat: "sistema",  desc: "Kernel e arquitetura",        cmd: ["uname", "-a"] },
  uptime:      { cat: "sistema",  desc: "Uptime e load",               cmd: ["uptime"] },
  os_release:  { cat: "sistema",  desc: "Identificação do SO",         cmd: ["cat", "/etc/os-release"] },
  date:        { cat: "sistema",  desc: "Data/hora e timezone",        cmd: ["date"] },
  whoami:      { cat: "sistema",  desc: "Usuário do serviço",          cmd: ["id"] },
  // hardware
  lscpu:       { cat: "hardware", desc: "Detalhes da CPU",             cmd: ["lscpu"] },
  cpuinfo:     { cat: "hardware", desc: "/proc/cpuinfo",               cmd: ["cat", "/proc/cpuinfo"] },
  meminfo:     { cat: "hardware", desc: "/proc/meminfo",               cmd: ["cat", "/proc/meminfo"] },
  free:        { cat: "hardware", desc: "Memória (human)",             cmd: ["free", "-h"] },
  lsusb:       { cat: "hardware", desc: "Dispositivos USB",            cmd: ["lsusb"] },
  sensors:     { cat: "hardware", desc: "Sensores (se houver)",        cmd: ["sensors"] },
  amixer:      { cat: "hardware", desc: "Controles de áudio (mixer)",  cmd: ["amixer", "scontrols"] },
  // rede
  ip_addr:     { cat: "rede",     desc: "Endereços IP",                cmd: ["ip", "addr"] },
  ip_route:    { cat: "rede",     desc: "Tabela de rotas",             cmd: ["ip", "route"] },
  ss:          { cat: "rede",     desc: "Sockets/portas",              cmd: ["ss", "-tunap"] },
  resolv:      { cat: "rede",     desc: "DNS (resolv.conf)",           cmd: ["cat", "/etc/resolv.conf"] },
  // storage
  df:          { cat: "storage",  desc: "Uso de disco",                cmd: ["df", "-h"] },
  lsblk:       { cat: "storage",  desc: "Blocos/partições",            cmd: ["lsblk"] },
  mounts:      { cat: "storage",  desc: "Montagens",                   cmd: ["cat", "/proc/mounts"] },
  // systemd
  failed:      { cat: "systemd",  desc: "Units falhas",                cmd: ["systemctl", "--failed", "--no-pager", "--plain"] },
  timers:      { cat: "systemd",  desc: "Timers ativos",               cmd: ["systemctl", "list-timers", "--no-pager"] },
  // logs / debug
  dmesg_err:   { cat: "debug",    desc: "dmesg erros/avisos",          cmd: ["dmesg", "--ctime", "--level=err,warn"] },
  journal_boot:{ cat: "debug",    desc: "journal deste boot (tail)",   cmd: ["journalctl", "-b", "-n", "80", "--no-pager", "--output=short-iso"] },
  top_cpu:     { cat: "debug",    desc: "Top processos por CPU",       cmd: ["sh", "-c", "ps -eo pid,user,pcpu,pmem,comm --sort=-pcpu 2>/dev/null | head -n 15"] },
};

function err(code, message) { const e = new Error(message); e.code = code; return e; }

// risco/custo p/ a UI marcar visualmente (nenhum comando aqui MUTA o sistema):
//   safe = leitura barata · diag = diagnóstico mais pesado (dmesg/journal/ss/top)
function riskOf(k) { return COMMANDS[k].cat === "debug" || /^(ss|lsusb|sensors)$/.test(k) ? "diag" : "safe"; }

function list() {
  return Object.keys(COMMANDS).map((k) => ({ key: k, cat: COMMANDS[k].cat, desc: COMMANDS[k].desc, cmd: COMMANDS[k].cmd.join(" "), risk: riskOf(k) }));
}

async function execKey(key) {
  const c = COMMANDS[key];
  if (!c) throw err("NOT_ALLOWED", "comando não permitido: " + key);
  const [file, ...args] = c.cmd;
  const r = await run(file, args, { timeout: 8000 });
  return {
    key,
    cmd: c.cmd.join(" "),
    code: r.code,
    ok: r.ok,
    timed_out: r.timedOut,
    ms: r.ms,
    output: (r.stdout + r.stderr).trim() || "(sem saída)",
  };
}

module.exports = { list, execKey, COMMANDS };
