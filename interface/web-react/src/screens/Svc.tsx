// Svc.tsx — serviços systemd: resumo + filtro (chips) + lista paginada + detalhe
// (ações restart/stop/start + journal). Porta da view "systemd". L1/R1 pagina.
import { useState, useEffect } from "react";
import { actions } from "../store";
import { api } from "../lib/api";
import { usePager } from "../lib/usePager";
import { KV, Badge, Focusable, StateMsg } from "../components/ui";
import type { Dict, AgentError } from "../types";

const FILTERS = ["all", "running", "failed", "cyberdeck"];
const SIZE = 11;
const isFailed = (s: Dict) => s.active === "failed" || s.sub === "failed";

export default function Svc() {
  const [unit, setUnit] = useState<string | null>(null);
  useEffect(() => {
    actions.registerBack(() => { if (unit) { setUnit(null); return true; } return false; });
  }, [unit]);
  if (unit) return <Detail unit={unit} onChanged={() => setUnit(null)} />;
  return <List onOpen={setUnit} />;
}

function List({ onOpen }: { onOpen: (u: string) => void }) {
  const [data, setData] = useState<Dict | null>(null);
  const [sum, setSum] = useState<Dict | null>(null);
  const [error, setError] = useState<AgentError | null>(null);
  const [filter, setFilter] = useState("all");
  const { setPage, apply } = usePager();

  useEffect(() => {
    let alive = true;
    const tick = () => {
      api.get<Dict>("/api/systemd/services").then((d) => { if (alive) { setData(d); setError(null); } }).catch((e: AgentError) => { if (alive) setError(e); });
      api.get<Dict>("/api/systemd/summary").then((s) => { if (alive) setSum(s); }).catch(() => {});
    };
    tick();
    const t = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (error) return <div className="view"><div className="vtitle">SERVIÇOS</div><StateMsg kind="err" error={error} /></div>;

  let items: Dict[] = (data?.services || []).filter((s: Dict) => {
    if (filter === "running") return s.sub === "running";
    if (filter === "failed") return isFailed(s);
    if (filter === "cyberdeck") return /cyberdeck/.test(s.unit);
    return true;
  });
  const rank = (s: Dict) => (isFailed(s) ? 0 : s.sub === "running" ? 1 : 2);
  items = items.slice().sort((a, b) => (rank(a) - rank(b)) || String(a.unit).localeCompare(String(b.unit)));
  const { total, page } = apply(items.length, SIZE);
  const shown = items.slice(page * SIZE, page * SIZE + SIZE);

  return (
    <div className="view">
      <div className="vtitle">SERVIÇOS{total > 1 ? "  ·  pág " + (page + 1) + "/" + total + " (L1/R1)" : ""}</div>
      {sum ? (
        <div className={"panel" + (sum.failed > 0 ? " panel-emphasis" : "")}>
          <div className="svc-sum">
            <Badge text={sum.state} kind={sum.state === "running" ? "ok" : sum.state === "degraded" ? "warn" : "off"} />
            {"  " + sum.units_total + " units · " + sum.running + " run · " + sum.failed + " falhos"}
          </div>
        </div>
      ) : null}
      <div className="toolbar">
        {FILTERS.map((f) => <Focusable as="button" key={f} className={"chip" + (filter === f ? " on" : "")} onClick={() => { setFilter(f); setPage(0); }}>{f}</Focusable>)}
      </div>
      <div className="list">
        {!data ? <StateMsg /> : !shown.length ? <div className="hint">(nenhum serviço neste filtro)</div> : shown.map((s) => (
          <Focusable key={s.unit} className="row" onClick={() => onOpen(s.unit)}>
            <span className="grow">{s.unit.replace(/\.service$/, "")}</span>
            <span className={"r " + (s.sub === "running" ? "st-run" : isFailed(s) ? "st-crit" : "st-dim")}>{s.sub}</span>
          </Focusable>
        ))}
      </div>
    </div>
  );
}

function Detail({ unit, onChanged }: { unit: string; onChanged: () => void }) {
  const [d, setD] = useState<Dict | null>(null);
  const [error, setError] = useState<AgentError | null>(null);
  const [journal, setJournal] = useState<string | null>(null);
  const load = () => api.get<Dict>("/api/systemd/service?unit=" + encodeURIComponent(unit)).then(setD).catch(setError);
  useEffect(() => { load(); }, [unit]);

  const doAction = (act: string) => {
    actions.openConfirm(act.toUpperCase() + " · " + unit).then((ok) => {
      if (!ok) return;
      api.post<Dict>("/api/systemd/action", { action: act, unit })
        .then((r) => { actions.toast(r.ok ? act + " ok" : "falhou: " + r.output, !r.ok); onChanged(); })
        .catch((e: AgentError) => actions.toast(e.message, true));
    });
  };
  const showLogs = () => { setJournal("(carregando…)"); api.get<Dict>("/api/systemd/logs?unit=" + encodeURIComponent(unit) + "&lines=120").then((r) => setJournal(r.lines)).catch((e: AgentError) => setJournal(e.business ? e.message : "(agente offline)")); };

  return (
    <div className="view">
      <div className="vtitle">SVC  {unit}</div>
      {error ? <StateMsg kind="err" error={error} /> : !d ? <StateMsg /> : (
        <div>
          <div className="kv"><span>ESTADO</span><b><Badge text={d.active + "/" + d.sub} kind={d.sub === "running" ? "run" : d.active === "failed" ? "crit" : "off"} /></b></div>
          <KV label="ENABLED" value={d.enabled} /><KV label="PID" value={d.main_pid || "—"} />
          <KV label="MEM" value={d.memory_mb >= 0 ? d.memory_mb + " MB" : "—"} />
          <KV label="DESDE" value={d.started} /><KV label="DESC" value={d.description} />
          <div className="toolbar">
            <Focusable as="button" className="chip" onClick={() => doAction("restart")}>RESTART</Focusable>
            <Focusable as="button" className="chip" onClick={() => doAction("stop")}>STOP</Focusable>
            <Focusable as="button" className="chip" onClick={() => doAction("start")}>START</Focusable>
            <Focusable as="button" className="chip" onClick={showLogs}>LOGS</Focusable>
          </div>
          <div className="sub">STATUS</div>
          <pre className="box">{d.status_text || "—"}</pre>
          {journal != null ? <><div className="sub">JOURNAL</div><pre className="box">{journal}</pre></> : null}
        </div>
      )}
    </div>
  );
}
