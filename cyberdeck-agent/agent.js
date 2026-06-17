#!/usr/bin/env node
"use strict";
/*
 * cyberdeck-agent — backend de dados do R36S CyberDeck OS (Node.js, SEM deps).
 *
 * Servidor HTTP em 127.0.0.1:PORT que alimenta a CyberDeck UI (file://) com
 * inspeção de hardware/SO, navegação read-only do rootfs, systemd, processos,
 * rede e logs. Toda resposta é JSON no formato:
 *     sucesso: { "ok": true,  "data": {...} }
 *     erro:    { "ok": false, "error": { "code", "message", "details" } }
 *
 * Segurança: NÃO existe execução arbitrária de shell. Comandos e ações são
 * allowlist (lib/commands.js, lib/actions.js, lib/systemd.js). Tudo via execFile.
 *
 * Endpoints — ver README/STACK. Uso: node agent.js [porta]   (default 8080)
 */
const http = require("http");

const { cors, ok, fail, readBody } = require("./lib/http");
const status = require("./lib/status");
const device = require("./lib/device");
const network = require("./lib/network");
const systemd = require("./lib/systemd");
const processes = require("./lib/processes");
const fsbrowse = require("./lib/fsbrowse");
const logs = require("./lib/logs");
const commands = require("./lib/commands");
const actions = require("./lib/actions");
const settings = require("./lib/settings");
const screenshot = require("./lib/screenshot");
const kernel = require("./lib/kernel");
const health = require("./lib/health");

const PORT = parseInt(process.argv[2] || "8080", 10);
let AGENT_VERSION = "0.0.0";
try { AGENT_VERSION = require("./package.json").version || AGENT_VERSION; } catch (e) {}

/* Converte um erro lançado pelos módulos em resposta {ok:false}. */
function onError(res, e) {
  const code = (e && e.code && typeof e.code === "string" && /^[A-Z_]+$/.test(e.code)) ? e.code : "INTERNAL";
  fail(res, code, (e && e.message) || "erro interno");
}

/* ---------- GET ---------- */
async function handleGet(res, pathname, q) {
  switch (true) {
    case pathname === "/" || pathname === "/api/status":
      return ok(res, status.get());
    case pathname === "/api/ping":
      return ok(res, { up: true, pid: process.pid, node: process.version, version: AGENT_VERSION });
    case pathname === "/api/health":
      return ok(res, await health.get());

    case pathname === "/api/device":
      return ok(res, await device.get());
    case pathname === "/api/kernel":
      return ok(res, kernel.get());

    case pathname === "/api/network" || pathname === "/api/network/summary":
      return ok(res, await network.summary());
    case pathname === "/api/network/interfaces":
      return ok(res, { interfaces: network.interfaces() });
    case pathname === "/api/network/routes":
      return ok(res, { routes: await network.routes() });
    case pathname === "/api/network/connections":
      return ok(res, await network.connections(parseInt(q.get("limit"), 10)));

    case pathname === "/api/systemd" || pathname === "/api/systemd/summary":
      return ok(res, await systemd.summary());
    case pathname === "/api/systemd/services":
      return ok(res, { services: await systemd.services() });
    case pathname === "/api/systemd/service":
      return ok(res, await systemd.service(q.get("unit")));
    case pathname === "/api/systemd/logs":
      return ok(res, await systemd.logs(q.get("unit"), q.get("lines")));

    case pathname === "/api/processes":
      return ok(res, processes.list());
    case /^\/api\/processes\/\d+$/.test(pathname):
      return ok(res, processes.detail(pathname.split("/").pop()));

    case pathname === "/api/fs/list":
      return ok(res, fsbrowse.list(q.get("path")));
    case pathname === "/api/fs/read":
      return ok(res, fsbrowse.read(q.get("path")));
    case pathname === "/api/fs/bookmarks":
      return ok(res, { bookmarks: fsbrowse.bookmarks() });

    case pathname === "/api/logs":
      return ok(res, await logs.get(q.get("source") || "dmesg",
        { severity: q.get("severity"), lines: q.get("lines"), q: q.get("q") }));
    case pathname === "/api/logs/sources":
      return ok(res, { sources: logs.sources() });

    case pathname === "/api/commands":
      return ok(res, { commands: commands.list() });
    case pathname === "/api/actions":
      return ok(res, { actions: actions.list() });
    case pathname === "/api/settings":
      return ok(res, settings.read());

    default:
      return fail(res, "NOT_FOUND", "rota não encontrada: " + pathname);
  }
}

/* ---------- POST ---------- */
async function handlePost(res, pathname, body) {
  // /api/processes/:pid/signal
  const sigM = pathname.match(/^\/api\/processes\/(\d+)\/signal$/);
  if (sigM) return ok(res, processes.signal(sigM[1], String(body.signal || "")));

  switch (pathname) {
    case "/api/commands/exec":
      return ok(res, await commands.execKey(String(body.key || "")));
    case "/api/actions":
    case "/api/action":
      return ok(res, await actions.run(String(body.key || body.action || "")));
    case "/api/systemd/action":
      return ok(res, await systemd.action(String(body.action || ""), String(body.unit || "")));
    case "/api/settings":
      return ok(res, settings.write({ fontScale: body.fontScale }));
    case "/api/screenshot":
      return ok(res, await screenshot.capture(body.version || AGENT_VERSION));
    default:
      return fail(res, "NOT_FOUND", "rota não encontrada: " + pathname);
  }
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  let pathname, q;
  try { const u = new URL(req.url, "http://127.0.0.1"); pathname = u.pathname; q = u.searchParams; }
  catch (e) { return fail(res, "BAD_REQUEST", "URL inválida"); }

  try {
    if (req.method === "GET") return await handleGet(res, pathname, q);
    if (req.method === "POST") { const body = await readBody(req); return await handlePost(res, pathname, body); }
    return fail(res, "BAD_REQUEST", "método não suportado");
  } catch (e) {
    return onError(res, e);
  }
});

server.listen(PORT, "127.0.0.1", () =>
  console.error(`[cyberdeck-agent] http://127.0.0.1:${PORT}/  (Node ${process.version})`));
