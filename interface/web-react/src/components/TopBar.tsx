// TopBar.tsx — marca + badge REACT + host + rede ON/OFF + temp + bateria + relógio.
import { useEffect, useState } from "react";
import { useStore } from "../store";
import { fmt, level } from "../lib/format";

export default function TopBar() {
  const s = useStore();
  const [clock, setClock] = useState(fmt.clock());
  useEffect(() => { const t = setInterval(() => setClock(fmt.clock()), 1000); return () => clearInterval(t); }, []);

  const d = s.lastStatus || {};
  const n = (d.net && d.net[0]) || {};
  const hasIp = !!n.ip;
  const tempCls = "tb " + level("temp", d.temp);
  const b = d.battery || {};
  const useEst = b.capacity_trust === "low" && b.est != null && b.est >= 0;
  const pct = useEst ? (b.est as number) : (b.pct != null && b.pct >= 0 ? b.pct : (b.est ?? -1));
  let batCls = "tb";
  if (b.ac !== 1 && pct >= 0 && pct < 10) batCls = "tb crit";
  else if (b.ac !== 1 && pct >= 0 && pct < 25) batCls = "tb warn";

  return (
    <div id="topbar">
      <span className="brand">R36S//CYBERDECK</span>
      <span className="brand-ui">REACT</span>
      <span className="tb">{d.host || "host —"}</span>
      <span className="spacer" />
      <span className={"tb" + (hasIp ? " ok" : " warn")}>{hasIp ? "NET ON" : "NET OFF"}</span>
      <span className={tempCls}>{d.temp != null && d.temp >= 0 ? d.temp + "°C" : "—°C"}</span>
      <span className={batCls}>
        {"BAT " + (pct >= 0 ? (useEst ? "~" : "") + pct + "%" : "—") + (b.ac === 1 ? " AC" : "")}
      </span>
      <span className="tb">{clock}</span>
    </div>
  );
}
