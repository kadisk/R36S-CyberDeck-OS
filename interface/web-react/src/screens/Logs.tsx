// Logs.tsx — origem (L1/R1) + severidade + lista colorida + detalhe. Porta da view "logs".
import { useState, useEffect } from "react";
import { actions, useStore } from "../store";
import { api } from "../lib/api";
import { SubBar, Focusable, Badge, StateMsg } from "../components/ui";
import type { AgentError } from "../types";

const LOG_SRC = ["dmesg", "journal", "agent", "kiosk", "ui"];
const LOG_SEV = ["all", "error", "warning", "info"];
function sevOf(l: string): "err" | "warn" | "info" {
  return /\b(fail|failed|failure|error|err|exit-code|cannot|denied|panic|oops|segfault)\b/i.test(l) ? "err"
    : /\b(warn|warning)\b/i.test(l) ? "warn" : "info";
}

interface Detail { line: string; sev: "err" | "warn" | "info"; }

export default function Logs() {
  useStore();
  const sub = actions.getSub("logs");
  const source = LOG_SRC[sub] || "dmesg";
  const [sev, setSev] = useState("all");
  const [text, setText] = useState("(carregando…)");
  const [err, setErr] = useState<AgentError | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      const q = sev === "all" ? "" : "&severity=" + sev;
      api.get<any>("/api/logs?source=" + source + q + "&lines=150")
        .then((d) => { if (alive) { setText(d.lines || "(sem saída)"); setErr(null); } })
        .catch((e: AgentError) => { if (alive) setErr(e); });
    };
    load();
    const t = setInterval(() => { if (!detail) load(); }, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [source, sev, detail]);

  useEffect(() => {
    actions.registerBack(() => { if (detail) { setDetail(null); return true; } return false; });
  }, [detail]);

  if (detail) return <DetailView line={detail.line} sev={detail.sev} source={source} />;

  const lines = String(text).split("\n");
  return (
    <div className="view">
      <div className="vtitle">LOGS · {source}</div>
      <SubBar labels={LOG_SRC} active={sub} />
      <div className="toolbar">
        {LOG_SEV.map((x) => (
          <Focusable as="button" key={x} className={"chip" + (sev === x ? " on" : "")} onClick={() => setSev(x)}>{x}</Focusable>
        ))}
      </div>
      {err ? <StateMsg kind="err" error={err} /> : (
        <div className="box full" id="logs-out">
          {lines.map((l, i) => (
            <Focusable key={i} className={"logline " + sevOf(l)} onClick={() => setDetail({ line: l, sev: sevOf(l) })}>{l || " "}</Focusable>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailView({ line, sev, source }: { line: string; sev: "err" | "warn" | "info"; source: string }) {
  const m = String(line).match(/^(\[[^\]]+\]|\S+T\S+)\s+([\s\S]*)$/);
  return (
    <div className="view">
      <div className="vtitle">LOG · detalhe</div>
      <div className="out-head">
        <Badge text={sev.toUpperCase()} kind={sev === "err" ? "crit" : sev === "warn" ? "warn" : "off"} />
        {"  " + source}
      </div>
      {m ? <div className="kv"><span>QUANDO</span><b>{m[1].replace(/^\[|\]$/g, "")}</b></div> : null}
      <div className="sub">MENSAGEM</div>
      <pre className="box full" tabIndex={0} data-focus="1">{m ? m[2] : line}</pre>
    </div>
  );
}
