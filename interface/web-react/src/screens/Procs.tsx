// Procs.tsx — processos: filtro/ordenação (chips) + lista paginada + detalhe + sinais.
// Porta da view "procs". Sort cicla num chip; filtros são chips; L1/R1 pagina.
import { useState, useEffect } from "react";
import { actions } from "../store";
import { api } from "../lib/api";
import { fmt } from "../lib/format";
import { usePager } from "../lib/usePager";
import { KV, Focusable, StateMsg } from "../components/ui";
import type { Dict, AgentError } from "../types";

const SORTS = ["cpu", "mem", "pid", "name"];
const FILTERS = ["ativos", "all", "node", "chromium", "cyberdeck", "running", "zombie"];
const SIZE = 10;

export default function Procs() {
  const [data, setData] = useState<Dict | null>(null);
  const [error, setError] = useState<AgentError | null>(null);
  const [sort, setSort] = useState("cpu");
  const [filter, setFilter] = useState("ativos");
  const [pid, setPid] = useState<number | null>(null);
  const { setPage, apply } = usePager();

  useEffect(() => {
    if (pid != null) return undefined;
    let alive = true;
    const tick = () => api.get<Dict>("/api/processes").then((d) => { if (alive) { setData(d); setError(null); } }).catch((e: AgentError) => { if (alive) setError(e); });
    tick();
    const t = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [pid]);

  useEffect(() => {
    actions.registerBack(() => { if (pid != null) { setPid(null); return true; } return false; });
  }, [pid]);

  if (pid != null) return <Detail pid={pid} onKilled={() => setPid(null)} />;
  if (error) return <div className="view"><div className="vtitle">PROCESSOS</div><StateMsg kind="err" error={error} /></div>;
  if (!data) return <div className="view"><div className="vtitle">PROCESSOS</div><StateMsg /></div>;

  const s = data.summary || {};
  let rows: Dict[] = (data.processes || []).filter((p: Dict) => {
    if (filter === "ativos") return p.cpu > 0 || p.state === "R";
    if (filter === "node") return /node/i.test(p.comm);
    if (filter === "chromium") return /chrom/i.test(p.comm);
    if (filter === "cyberdeck") return /cyberdeck/i.test(p.cmd);
    if (filter === "running") return p.state === "R";
    if (filter === "zombie") return p.state === "Z";
    return true;
  });
  rows = rows.slice().sort((a, b) => {
    if (sort === "mem") return b.rss_mb - a.rss_mb;
    if (sort === "pid") return a.pid - b.pid;
    if (sort === "name") return String(a.comm).localeCompare(String(b.comm));
    return b.cpu - a.cpu;
  });
  const { total, page: cur } = apply(rows.length, SIZE);
  const shown = rows.slice(cur * SIZE, cur * SIZE + SIZE);

  return (
    <div className="view">
      <div className="vtitle">PROCESSOS{total > 1 ? "  ·  pág " + (cur + 1) + "/" + total + " (L1/R1)" : ""}</div>
      <KV label="PROC" value={s.total + " · run " + s.running + " · zumbi " + s.zombie + " · ~" + (s.cpu_total || 0) + "% cpu"} />
      <div className="toolbar">
        <Focusable as="button" className="chip on" onClick={() => { setSort(SORTS[(SORTS.indexOf(sort) + 1) % SORTS.length]); setPage(0); }}>{"↓" + sort}</Focusable>
        {FILTERS.map((f) => <Focusable as="button" key={f} className={"chip" + (filter === f ? " on" : "")} onClick={() => { setFilter(f); setPage(0); }}>{f}</Focusable>)}
      </div>
      <div className="list">
        <div className="row list-head"><span className="c">PID</span><span className="grow">CMD</span><span className="pbar-h">CPU</span><span className="c r">%</span><span className="c r">RSS</span></div>
        {!shown.length ? <div className="hint">(nenhum processo neste filtro)</div> : shown.map((p) => (
          <Focusable key={p.pid} className="row" onClick={() => setPid(p.pid)}>
            <span className="c">{p.pid}</span>
            <span className="grow">{p.comm}</span>
            <span className="pbar"><i className={p.cpu >= 90 ? "crit" : p.cpu >= 50 ? "warn" : ""} style={{ width: Math.max(0, Math.min(100, p.cpu)) + "%" }} /></span>
            <span className="c r">{p.cpu}%</span>
            <span className="c r">{p.rss_mb}M</span>
          </Focusable>
        ))}
      </div>
    </div>
  );
}

function Detail({ pid, onKilled }: { pid: number; onKilled: () => void }) {
  const [d, setD] = useState<Dict | null>(null);
  const [error, setError] = useState<AgentError | null>(null);
  useEffect(() => { api.get<Dict>("/api/processes/" + pid).then(setD).catch(setError); }, [pid]);

  const kill = (sig: string) => {
    actions.openConfirm("ENVIAR " + sig + " · PID " + pid).then((ok) => {
      if (!ok) return;
      api.post("/api/processes/" + pid + "/signal", { signal: sig })
        .then(() => { actions.toast(sig + " enviado p/ " + pid); onKilled(); })
        .catch((e: AgentError) => actions.toast(e.message, true));
    });
  };

  return (
    <div className="view">
      <div className="vtitle">PID {pid}</div>
      {error ? <StateMsg kind="err" error={error} /> : !d ? <StateMsg /> : (
        <div>
          <KV label="COMM" value={d.comm} /><KV label="ESTADO" value={fmt.pstate(d.state)} />
          <KV label="USER" value={d.user} /><KV label="PPID" value={d.ppid} />
          <KV label="THREADS" value={d.threads} /><KV label="FD" value={d.fd_count} />
          <KV label="RSS" value={d.vm_rss} /><KV label="EXE" value={d.exe} /><KV label="CWD" value={d.cwd} />
          <div className="sub">CMDLINE</div>
          <pre className="box" tabIndex={0} data-focus="1">{d.cmdline}</pre>
          <div className="toolbar">
            <Focusable as="button" className="chip" onClick={() => kill("SIGTERM")}>SIGTERM</Focusable>
            <Focusable as="button" className="chip" onClick={() => kill("SIGKILL")}>SIGKILL</Focusable>
          </div>
          {d.children && d.children.length ? <><div className="sub">FILHOS</div>{d.children.map((c: Dict) => <KV key={c.pid} label={c.pid} value={c.comm} />)}</> : null}
          <div className="sub">STATUS</div>
          <pre className="box">{d.status}</pre>
        </div>
      )}
    </div>
  );
}
