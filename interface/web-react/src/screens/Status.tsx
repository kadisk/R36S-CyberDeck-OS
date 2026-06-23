// Status.tsx — AO VIVO / ENERGIA / TENDÊNCIA. Porta da view "status".
import { useStore, actions } from "../store";
import { fmt, level, sparkline } from "../lib/format";
import { history } from "../lib/history";
import { KV, MCard, Gauge, Tile, SubBar, StateMsg } from "../components/ui";
import type { StatusData } from "../types";

const SUBS = ["AO VIVO", "ENERGIA", "TENDÊNCIA"];

export default function Status() {
  const s = useStore();
  const sub = actions.getSub("status");
  const d = s.lastStatus;
  return (
    <div className="view">
      <div className="vtitle">STATUS · {SUBS[sub]}</div>
      <SubBar labels={SUBS} active={sub} />
      {!d ? <StateMsg /> : <Body d={d} sub={sub} />}
    </div>
  );
}

function Body({ d, sub }: { d: StatusData; sub: number }) {
  if (sub === 0) {
    const l1 = d.load_arr ? d.load_arr[0] : -1;
    const n = (d.net && d.net[0]) || {};
    return (
      <div>
        <div className="tiles">
          <Tile lbl="CPU" val={(d.cpu != null && d.cpu >= 0 ? Math.round(d.cpu) : 0) + "%"} kind={level("ram", d.cpu)} pct={d.cpu != null && d.cpu >= 0 ? d.cpu : null} />
          <Tile lbl="RAM" val={d.mem ? Math.round(d.mem.pct) + "%" : "—"} kind={level("ram", d.mem ? d.mem.pct : 0)} pct={d.mem ? d.mem.pct : null} />
          <Tile lbl="TEMP" val={d.temp != null && d.temp >= 0 ? d.temp + "°" : "—"} sub={level("temp", d.temp) === "ok" ? "ok" : "alto"} kind={level("temp", d.temp)} />
          <Tile lbl="LOAD" val={l1 >= 0 ? l1 : "—"} sub={(d.cores || "?") + " cores"} kind={level("loadPerCore", l1, d.cores)} />
        </div>
        <KV label="MEM" value={d.mem ? d.mem.used + " / " + d.mem.total + " MB" : "—"} />
        <KV label="UPTIME" value={fmt.uptime(d.uptime || 0)} />
        <KV label="REDE" value={n.iface ? n.iface + " " + n.ip : "sem rede"} />
      </div>
    );
  }
  if (sub === 1) {
    const bt = d.battery || {}, lowTrust = bt.capacity_trust === "low";
    return (
      <div>
        <div className="minicards">
          <MCard ti="BAT" v={bt.est != null && bt.est >= 0 ? bt.est + "%" : "—"} s={bt.ac === 1 ? "carregando" : "estimado"} />
          <MCard ti="TENSÃO" v={bt.volt && bt.volt > 0 ? bt.volt + "V" : "—"} s={bt.curr !== -1 && bt.curr != null ? bt.curr + " mA" : ""} />
          <MCard ti="OCV" v={bt.ocv && bt.ocv > 0 ? bt.ocv + "V" : "—"} s={bt.status || ""} />
        </div>
        <KV label="RAW (rk817)" value={(bt.pct != null && bt.pct >= 0 ? bt.pct + "% capacity" : "—") + (lowTrust ? " · instável" : "")} />
        {d.brightness && d.brightness.pct >= 0 ? <Gauge label="BRILHO" pct={d.brightness.pct} /> : null}
        <KV label="TEMP" value={d.temp != null && d.temp >= 0 ? d.temp + " °C" : "—"} />
      </div>
    );
  }
  if (history.get("cpu").length > 1) {
    return (
      <div>
        <KV label="CPU" value={sparkline(history.get("cpu"), { min: 0, max: 100 })} />
        <KV label="RAM" value={sparkline(history.get("ram"), { min: 0, max: 100 })} />
        <KV label="TEMP" value={sparkline(history.get("temp"))} />
        <KV label="LOAD" value={sparkline(history.get("load"))} />
        <KV label="BAT" value={sparkline(history.get("bat"))} />
        <div className="hint">tendência da sessão (~2 min)</div>
      </div>
    );
  }
  return <StateMsg kind="empty">coletando histórico…</StateMsg>;
}
