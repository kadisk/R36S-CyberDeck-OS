// api.ts — cliente do cyberdeck-agent. Porta de web-vanilla/public/js/api.js.
// Contrato: { ok:true, data } | { ok:false, error:{code,message} }. Resolve em `data`;
// erro de negócio vira Error com .business=true e .code. Falha de rede => agente offline.
import type { AgentError } from "../types";

export const AGENT = "http://127.0.0.1:8080";

type AgentListener = (online: boolean) => void;
let agentListener: AgentListener = () => {};
export function onAgentChange(fn: AgentListener): void { agentListener = fn; }

export interface ReqOpts { method?: string; body?: unknown; timeout?: number; }

function req<T = any>(path: string, opts: ReqOpts): Promise<T> {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), opts.timeout || 9000) : null;
  const init: RequestInit = { method: opts.method || "GET", signal: ctrl ? ctrl.signal : undefined };
  if (opts.body) { init.headers = { "Content-Type": "application/json" }; init.body = JSON.stringify(opts.body); }
  return fetch(AGENT + path, init)
    .then((r) => r.json().catch(() => ({ ok: false, error: { code: "BAD_JSON", message: "resposta inválida" } })))
    .then((j: any) => {
      agentListener(true);
      if (j && j.ok) return j.data as T;
      const e: AgentError = new Error((j && j.error && j.error.message) || "erro");
      e.business = true; e.code = (j && j.error && j.error.code) || "ERR";
      throw e;
    })
    .catch((e: AgentError) => { if (!e.business) agentListener(false); throw e; })
    .then((v: T) => { if (timer) clearTimeout(timer); return v; }, (e: AgentError) => { if (timer) clearTimeout(timer); throw e; });
}

export const api = {
  get: <T = any>(path: string, opts?: ReqOpts) => req<T>(path, opts || {}),
  post: <T = any>(path: string, body?: unknown, opts?: ReqOpts) =>
    req<T>(path, { ...(opts || {}), method: "POST", body: body || {} }),
};
