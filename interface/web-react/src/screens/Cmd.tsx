// Cmd.tsx — comandos prontos (allowlist): categorias -> comandos -> saída.
// Porta da view "cmd". B: saída->comandos->categorias.
import { useState, useEffect } from "react";
import { actions } from "../store";
import { api } from "../lib/api";
import { Focusable, Badge, StateMsg } from "../components/ui";
import type { Dict, AgentError } from "../types";

export default function Cmd() {
  const [cmds, setCmds] = useState<Dict[] | null>(null);
  const [error, setError] = useState<AgentError | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [out, setOut] = useState<{ key: string; r: Dict | null; err?: string } | null>(null);

  useEffect(() => { api.get<Dict>("/api/commands").then((d) => setCmds(d.commands || [])).catch(setError); }, []);
  useEffect(() => {
    actions.registerBack(() => {
      if (out) { setOut(null); return true; }
      if (cat) { setCat(null); return true; }
      return false;
    });
  }, [out, cat]);

  const run = (key: string) => {
    setOut({ key, r: null });
    api.post<Dict>("/api/commands/exec", { key })
      .then((r) => setOut({ key, r }))
      .catch((e: AgentError) => setOut({ key, r: null, err: e.business ? e.message : "(agente offline)" }));
  };

  if (error) return <div className="view"><div className="vtitle">COMANDOS</div><StateMsg kind="err" error={error} /></div>;
  if (!cmds) return <div className="view"><div className="vtitle">COMANDOS</div><StateMsg /></div>;

  if (out) {
    const r = out.r;
    const st = !r ? "…" : r.timed_out ? "TIMEOUT" : r.ok ? "OK" : "ERRO";
    const stk = !r ? "off" : r.timed_out ? "crit" : r.ok ? "ok" : "crit";
    return (
      <div className="view">
        <div className="vtitle">CMD  {out.key}</div>
        <div className="out-head">
          <Badge text={st} kind={stk} />
          {r ? "  $ " + r.cmd + "  ·  exit " + r.code + " · " + (r.ms != null ? r.ms + "ms" : "") : "  … executando …"}
        </div>
        <pre className="box full" tabIndex={0} data-focus="1">{out.err ? out.err : (r ? r.output : "")}</pre>
      </div>
    );
  }

  const cats: Record<string, Dict[]> = {};
  cmds.forEach((c) => { (cats[c.cat] = cats[c.cat] || []).push(c); });

  if (!cat) {
    return (
      <div className="view">
        <div className="vtitle">COMANDOS</div>
        <div className="hint">A: abrir · B: voltar</div>
        <div className="cards">
          {Object.keys(cats).map((c) => (
            <Focusable key={c} className="card" onClick={() => setCat(c)}>
              <span className="ti">{c.toUpperCase()}</span>
              <span className="de">{cats[c].length + " comandos"}</span>
            </Focusable>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="view">
      <div className="vtitle">CMD · {cat.toUpperCase()}</div>
      <div className="hint">A: executar · B: voltar</div>
      <div className="list">
        {(cats[cat] || []).map((c) => (
          <Focusable key={c.key} className="row" onClick={() => run(c.key)}>
            <span className={"tag-" + (c.risk || "safe")}>{"[" + (c.risk === "diag" ? "DIAG" : "SAFE") + "]"}</span>
            <span className="grow">{c.desc}</span>
            <span className="r">{c.cmd}</span>
          </Focusable>
        ))}
      </div>
    </div>
  );
}
