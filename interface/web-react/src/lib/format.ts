// format.ts — formatação e severidade. Porta de web-vanilla/public/js/ui.js.
import type { Level } from "../types";

export const fmt = {
  bytes(n: number): string {
    n = Number(n); if (!isFinite(n) || n < 0) return "—";
    const u = ["B", "K", "M", "G", "T"]; let i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (i === 0 ? n : n.toFixed(1)) + u[i];
  },
  uptime(s: number): string {
    s = Math.floor(s || 0); const d = Math.floor(s / 86400); s %= 86400;
    const h = Math.floor(s / 3600); s %= 3600; const m = Math.floor(s / 60);
    return (d ? d + "d " : "") + h + "h " + m + "m";
  },
  clock(dt?: Date): string {
    dt = dt || new Date(); const p = (n: number) => String(n).padStart(2, "0");
    return p(dt.getHours()) + ":" + p(dt.getMinutes()) + ":" + p(dt.getSeconds());
  },
  pstate(s: string): string {
    return ({ R: "run", S: "sleep", D: "io", T: "stop", t: "trace", Z: "zombie", X: "dead", I: "idle" } as Record<string, string>)[s] || s;
  },
};

// severidade centralizada (mesma régua do backend lib/health.js) -> ok|warn|crit
export function level(kind: string, v: number | undefined, cores?: number): Level {
  if (v == null || v < 0) return "ok";
  switch (kind) {
    case "temp": return v >= 80 ? "crit" : v >= 65 ? "warn" : "ok";
    case "ram": return v > 90 ? "crit" : v >= 75 ? "warn" : "ok";
    case "storage": return v > 90 ? "crit" : v >= 80 ? "warn" : "ok";
    case "battVolt": return v < 3.55 ? "crit" : v <= 3.75 ? "warn" : "ok";
    case "loadPerCore": { const n = cores ? v / cores : v; return n > 1.25 ? "crit" : n >= 0.75 ? "warn" : "ok"; }
    default: return "ok";
  }
}

const SPARK = "▁▂▃▄▅▆▇█";
export function sparkline(arr: number[] | undefined, opts?: { n?: number; min?: number; max?: number }): string {
  arr = arr || []; opts = opts || {};
  if (!arr.length) return "—";
  const data = arr.slice(-(opts.n || 40));
  let min = opts.min != null ? opts.min : Math.min.apply(null, data);
  let max = opts.max != null ? opts.max : Math.max.apply(null, data);
  if (max <= min) max = min + 1;
  let s = "";
  for (let i = 0; i < data.length; i++) {
    let t = (data[i] - min) / (max - min); if (t < 0) t = 0; if (t > 1) t = 1;
    s += SPARK[Math.round(t * (SPARK.length - 1))];
  }
  return s;
}

const BTN_CLS: Record<string, string> = { A: "btn-a", B: "btn-b", X: "btn-x", Y: "btn-y" };
function esc(s: string): string { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
export function btnizeHtml(str: string): string {
  return esc(str)
    .replace(/\b(L1|R1|L2|R2|FN|Start|Select|A|B|X|Y)\b/g, (m) => '<b class="btn ' + (BTN_CLS[m] || "btn-o") + '">' + m + "</b>")
    .replace(/([←↑→↓↔↕]+)/g, '<b class="btn btn-o">$1</b>');
}
