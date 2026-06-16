"use strict";
/*
 * exec.js — execução SEGURA de comandos externos.
 *
 * Regra do projeto: nunca passar string de shell vinda da UI. Sempre execFile
 * com (file, args[]) — sem shell, sem interpolação, sem `exec()` de string.
 * Todo comando tem timeout e maxBuffer. Erros viram { ok:false } estruturado.
 */
const { execFile } = require("child_process");

const DEFAULT_TIMEOUT = 6000;
const DEFAULT_MAXBUF = 1 << 20; // 1 MiB

/**
 * run(file, args, opts) -> Promise<{ ok, code, signal, stdout, stderr }>
 * Nunca rejeita: erros de execução voltam no objeto (ok=false).
 */
function run(file, args, opts) {
  opts = opts || {};
  const t0 = Date.now();
  return new Promise((resolve) => {
    let done = false;
    const finish = (o) => { if (!done) { done = true; o.ms = Date.now() - t0; resolve(o); } };
    let child;
    try {
      child = execFile(file, Array.isArray(args) ? args : [], {
        timeout: opts.timeout || DEFAULT_TIMEOUT,
        maxBuffer: opts.maxBuffer || DEFAULT_MAXBUF,
        killSignal: "SIGKILL",
        env: opts.env ? Object.assign({}, process.env, opts.env) : process.env,
      }, (err, stdout, stderr) => {
        finish({
          ok: !err,
          code: err && typeof err.code === "number" ? err.code : (err ? 1 : 0),
          signal: err && err.signal ? err.signal : null,
          timedOut: !!(err && err.killed && err.signal === "SIGKILL"),
          stdout: stdout != null ? String(stdout) : "",
          stderr: stderr != null ? String(stderr) : "",
        });
      });
    } catch (e) {
      return finish({ ok: false, code: 127, signal: null, stdout: "", stderr: String(e.message || e) });
    }
    child.on("error", (e) => finish({ ok: false, code: 127, signal: null, stdout: "", stderr: String(e.message || e) }));
  });
}

/** Conveniência: só o stdout (string), "" em erro. */
async function out(file, args, opts) {
  const r = await run(file, args, opts);
  return r.stdout || "";
}

module.exports = { run, out, DEFAULT_TIMEOUT };
