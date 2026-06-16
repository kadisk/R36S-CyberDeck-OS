"use strict";
/*
 * http.js — helpers de resposta HTTP com formato JSON consistente.
 *
 *   sucesso: { "ok": true,  "data": {...} }
 *   erro:    { "ok": false, "error": { "code", "message", "details" } }
 *
 * A UI roda por file:// (origem "null"), então CORS é liberado.
 */

const CODES = {
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  PERMISSION_DENIED: 403,
  NOT_ALLOWED: 403,
  TIMEOUT: 504,
  INTERNAL: 500,
};

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Cache-Control", "no-store");
}

function sendJson(res, obj, httpCode) {
  let body;
  try { body = JSON.stringify(obj); }
  catch (e) { body = JSON.stringify({ ok: false, error: { code: "INTERNAL", message: "serialize failed" } }); }
  if (!res.headersSent) res.writeHead(httpCode || 200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

/** Resposta de sucesso. */
function ok(res, data) { sendJson(res, { ok: true, data: data == null ? {} : data }); }

/**
 * Resposta de erro. code -> mapeado p/ status HTTP (default 400).
 * Aceita Error ou string em `message`.
 */
function fail(res, code, message, details) {
  const httpCode = CODES[code] || 400;
  sendJson(res, {
    ok: false,
    error: { code: code || "BAD_REQUEST", message: String(message || code || "error"), details: details || undefined },
  }, httpCode);
}

/** Lê o corpo de um POST como JSON, com limite de tamanho. */
function readBody(req, maxBytes) {
  const limit = maxBytes || 65536;
  return new Promise((resolve) => {
    let body = "";
    let aborted = false;
    req.on("data", (c) => {
      body += c;
      if (body.length > limit) { aborted = true; req.destroy(); }
    });
    req.on("end", () => {
      if (aborted) return resolve({});
      try { resolve(JSON.parse(body || "{}")); } catch (e) { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

module.exports = { cors, sendJson, ok, fail, readBody, CODES };
