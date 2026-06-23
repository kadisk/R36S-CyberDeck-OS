// Tools.tsx — AJUSTES: DISPLAY (fonte/screenshot/brilho) e AUDIO (volume). Subpáginas L1/R1.
// Porta da view "tools".
import { useState, useEffect } from "react";
import { actions, useStore } from "../store";
import { useAgentPoll } from "../lib/useAgentPoll";
import { api } from "../lib/api";
import { KV, Gauge, Focusable, SubBar } from "../components/ui";
import type { Dict } from "../types";

const SUBS = ["DISPLAY", "AUDIO"];
function bucket(key: string): string {
  if (/^bright-/.test(key)) return "DISPLAY";
  if (/^(volume|audio)-/.test(key)) return "AUDIO";
  if (key === "reload-ui" || key === "restart-agent") return "SYSTEM";
  return "DANGER";
}

export default function Tools() {
  const s = useStore();
  const sub = actions.getSub("tools");
  const { data } = useAgentPoll<Dict>("/api/actions", 60000);
  const acts: Dict[] = (data?.actions) || [];
  const run = (a: Dict) => actions.action(a.key, a.label, a.dangerous);

  return (
    <div className="view">
      <div className="vtitle">AJUSTES · {SUBS[sub]}</div>
      <SubBar labels={SUBS} active={sub} />
      {sub === 0 ? <Display acts={acts} run={run} fontScale={s.fontScale} bri={s.lastStatus?.brightness?.pct ?? -1} />
        : <Audio acts={acts} run={run} />}
    </div>
  );
}

function Display({ acts, run, fontScale, bri }: { acts: Dict[]; run: (a: Dict) => void; fontScale: number; bri: number }) {
  return (
    <div>
      <div className="list">
        <Focusable className="row" onClick={() => actions.setFontScale(+0.1)}><span className="grow">Fonte +</span><span className="r">{Math.round(fontScale * 100)}%</span></Focusable>
        <Focusable className="row" onClick={() => actions.setFontScale(-0.1)}><span className="grow">Fonte −</span></Focusable>
        <Focusable className="row" onClick={() => actions.resetFontScale()}><span className="grow">Fonte reset</span></Focusable>
        <Focusable className="row" onClick={() => actions.screenshot()}><span className="grow">Screenshot</span><span className="r btn btn-o">L2+R2</span></Focusable>
        {acts.filter((a) => bucket(a.key) === "DISPLAY").map((a) => (
          <Focusable key={a.key} className="row" onClick={() => run(a)}><span className="grow">{a.label}</span></Focusable>
        ))}
      </div>
      {bri >= 0 ? <Gauge label="BRILHO" pct={bri} /> : null}
    </div>
  );
}

function Audio({ acts, run }: { acts: Dict[]; run: (a: Dict) => void }) {
  const [vol, setVol] = useState<Dict | null>(null);
  const refresh = () => api.get<Dict>("/api/volume").then(setVol).catch(() => {});
  useEffect(() => { refresh(); }, []);
  return (
    <div>
      {vol ? (
        <>
          {vol.pct >= 0 ? <Gauge label="VOLUME" pct={vol.pct} /> : null}
          <KV label="ESTADO" value={(vol.muted ? "MUDO" : "ativo") + (vol.control ? " · " + vol.control : " · (sem controle)")} />
        </>
      ) : null}
      <div className="list">
        {acts.filter((a) => bucket(a.key) === "AUDIO").map((a) => (
          <Focusable key={a.key} className="row" onClick={() => { run(a); if (/^volume-/.test(a.key)) setTimeout(refresh, 400); }}><span className="grow">{a.label}</span></Focusable>
        ))}
      </div>
    </div>
  );
}
