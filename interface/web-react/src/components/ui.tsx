// ui.tsx — componentes reutilizáveis (porta de js/ui.js). Itens focáveis levam
// data-focus + tabIndex p/ a camada de input (useInput) navegar por geometria.
import type { ReactNode } from "react";
import { level } from "../lib/format";
import type { AgentError, Level } from "../types";

interface FocusableProps {
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  onClick?: () => void;
  children?: ReactNode;
}
export function Focusable({ as = "div", className = "", onClick, children }: FocusableProps) {
  const Tag = as as any;
  return (
    <Tag className={className} tabIndex={0} data-focus="1" onClick={onClick}>
      {children}
    </Tag>
  );
}

export function KV({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="kv">
      <span>{label}</span>
      <b>{value == null || value === "" ? "—" : value}</b>
    </div>
  );
}

export function MCard({ ti, v, s }: { ti: ReactNode; v: ReactNode; s?: ReactNode }) {
  return (
    <div className="mcard">
      <div className="ti">{ti}</div>
      <div className="v">{v == null || v === "" ? "—" : v}</div>
      {s ? <div className="s">{s}</div> : null}
    </div>
  );
}

export function Gauge({ label, pct }: { label: string; pct: number }) {
  pct = Math.max(0, Math.min(100, pct || 0));
  const cls = pct >= 90 ? "crit" : pct >= 70 ? "warn" : "";
  return (
    <div className="gauge">
      <label>{label}</label>
      <div className="bar"><i className={cls} style={{ width: pct + "%" }} /></div>
      <span className="val">{Math.round(pct)}%</span>
    </div>
  );
}

export function Tile({ lbl, val, sub, kind, pct }: { lbl: string; val: ReactNode; sub?: ReactNode; kind?: Level; pct?: number | null }) {
  const cls = kind && kind !== "ok" ? " " + kind : "";
  return (
    <div className={"tile" + cls}>
      <div className="tile-lbl">{lbl}</div>
      <div className="tile-val">{val}</div>
      {sub != null ? <div className="tile-sub">{sub}</div> : null}
      {pct != null ? <div className="tile-bar"><i style={{ width: Math.max(0, Math.min(100, pct)) + "%" }} /></div> : null}
    </div>
  );
}

export function Badge({ text, kind }: { text: string; kind?: string }) {
  return <span className={"badge " + (kind || "off")}>{text}</span>;
}

export function StateMsg({ kind, error, children }: { kind?: "err" | "empty" | "loading"; error?: AgentError | null; children?: ReactNode }) {
  if (kind === "err") {
    const msg = error && error.business ? error.message + " [" + (error.code || "ERR") + "]"
      : "agente offline — verifique o cyberdeck-agent";
    return <div className="state-msg err"><span className="icon">/!\</span>{msg}</div>;
  }
  if (kind === "empty") return <div className="state-msg"><span className="icon">[ ]</span>{children || "sem dados"}</div>;
  return <div className="state-msg loading"><span className="icon">...</span>{children || "carregando…"}</div>;
}

export function SubBar({ labels, active }: { labels: string[]; active: number }) {
  return (
    <div className="subbar">
      {labels.map((l, i) => (
        <div key={l} className={"subtab" + (i === active ? " on" : "")}>{l}</div>
      ))}
    </div>
  );
}

export { level };
