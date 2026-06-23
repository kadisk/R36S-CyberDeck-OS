// Home.tsx — cockpit: saúde + métricas (CPU/RAM/TEMP/BAT) + atalhos. Porta da view "welcome".
import { useStore, actions } from "../store";
import { useAgentPoll } from "../lib/useAgentPoll";
import { level } from "../lib/format";
import { Focusable, Tile } from "../components/ui";
import type { HealthData } from "../types";

const CARDS = [
  { id: "status", ic: "%", ti: "STATUS", de: "CPU, RAM, temp, energia" },
  { id: "net", ic: "~", ti: "REDE", de: "Rede e conexões" },
  { id: "logs", ic: "!", ti: "LOGS", de: "dmesg / journal" },
  { id: "device", ic: "#", ti: "APAR.", de: "Hardware e SO" },
];

function Health({ d }: { d: HealthData | null }) {
  if (!d) return <div className="health"><div className="health-line crit">agente OFF — sem dados de saúde</div></div>;
  const s = d.summary || {};
  const lvl = d.level || "ok";
  const lvlTxt = ({ ok: "SYS OK", warn: "SYS WARN", crit: "SYS CRIT" } as Record<string, string>)[lvl] || "SYS ?";
  return (
    <div className="health">
      <div className={"health-line " + lvl}>
        <b>{lvlTxt}</b>
        {"  agente ON · " + (s.net_ip ? "rede " + s.net_ip : "sem rede") + " · systemd " + (s.systemd || "?") + (s.failed && s.failed > 0 ? " (" + s.failed + " falha)" : "")}
      </div>
      {(d.items || []).map((it, i) => (
        <Focusable key={i} className={"alert " + it.level} onClick={() => actions.go(it.target)}>
          {"! " + it.label}
        </Focusable>
      ))}
    </div>
  );
}

export default function Home() {
  const s = useStore();
  const { data: health } = useAgentPoll<HealthData>("/api/health", 4000);
  const d = s.lastStatus || {};
  const bt = d.battery || {};
  const batVal = bt.ac === 1 ? "AC" : (bt.est != null && bt.est >= 0 ? bt.est + "%" : (bt.volt && bt.volt > 0 ? bt.volt + "V" : "—"));
  return (
    <div className="view">
      <Health d={health} />
      <div className="tiles">
        <Tile lbl="CPU" val={d.cpu != null && d.cpu >= 0 ? Math.round(d.cpu) + "%" : "—"} kind={level("ram", d.cpu)} pct={d.cpu != null && d.cpu >= 0 ? d.cpu : null} />
        <Tile lbl="RAM" val={d.mem ? Math.round(d.mem.pct) + "%" : "—"} kind={level("ram", d.mem ? d.mem.pct : 0)} pct={d.mem ? d.mem.pct : null} />
        <Tile lbl="TEMP" val={d.temp != null && d.temp >= 0 ? d.temp + "°" : "—"} sub={level("temp", d.temp) === "ok" ? "ok" : "alto"} kind={level("temp", d.temp)} />
        <Tile lbl="BAT" val={batVal} sub={bt.volt && bt.volt > 0 ? bt.volt + "V" : ""} kind="ok" />
      </div>
      <div className="cards">
        {CARDS.map((c) => (
          <Focusable key={c.id} className="card" onClick={() => actions.go(c.id)}>
            <span className="ic">{c.ic}</span>
            <span className="ti">{c.ti}</span>
            <span className="de">{c.de}</span>
          </Focusable>
        ))}
      </div>
    </div>
  );
}
