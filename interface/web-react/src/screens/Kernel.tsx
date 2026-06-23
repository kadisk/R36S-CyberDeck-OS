// Kernel.tsx — KERNEL & Device Tree: campos + version/cmdline + DTB + nós (A abre no FS)
// + módulos carregados. Porta da view "kernel".
import { actions } from "../store";
import { useAgentPoll } from "../lib/useAgentPoll";
import { KV, Focusable, StateMsg } from "../components/ui";
import type { Dict } from "../types";

export default function Kernel() {
  const { data: d, error } = useAgentPoll<Dict>("/api/kernel", 60000);
  if (error) return <div className="view"><div className="vtitle">KERNEL & DEVICE TREE</div><StateMsg kind="err" error={error} /></div>;
  if (!d) return <div className="view"><div className="vtitle">KERNEL & DEVICE TREE</div><StateMsg /></div>;
  const dt: Dict = d.dtb || {};
  return (
    <div className="view">
      <div className="vtitle">KERNEL & DEVICE TREE</div>
      <div className="sub">KERNEL</div>
      <KV label="RELEASE" value={d.osrelease} /><KV label="TIPO" value={d.ostype} />
      <KV label="ARCH" value={d.arch} /><KV label="HOST" value={d.hostname} />
      <KV label="TAINTED" value={d.tainted === 0 ? "0 (limpo)" : d.tainted} />
      <KV label="CONFIG" value={d.config_source || "—"} /><KV label="MÓDULOS" value={d.modules_total} />
      <div className="sub">VERSION</div><pre className="box">{d.version || "—"}</pre>
      <div className="sub">CMDLINE / BOOTARGS</div><pre className="box">{d.cmdline || "—"}</pre>
      <div className="sub">DEVICE TREE (DTB)</div>
      <KV label="PRESENTE" value={dt.present ? "/proc/device-tree" : "não"} />
      <KV label="MODELO" value={dt.model} /><KV label="SERIAL" value={dt.serial || "—"} />
      {dt.compatible && dt.compatible.length ? <><div className="sub">COMPATIBLE</div><pre className="box">{dt.compatible.join("\n")}</pre></> : null}
      {dt.bootargs ? <><div className="sub">DTB bootargs (chosen)</div><pre className="box">{dt.bootargs}</pre></> : null}
      {dt.nodes && dt.nodes.length ? (
        <>
          <div className="sub">NÓS ({dt.nodes.length}) — A abre no FS</div>
          <div className="list">
            {dt.nodes.map((n: Dict, i: number) => (
              <Focusable key={i} className="row" onClick={() => actions.openFs("/proc/device-tree/" + n.name)}>
                <span className="grow">{n.name}</span><span className="r">{n.compatible}</span>
              </Focusable>
            ))}
          </div>
        </>
      ) : null}
      <div className="sub">MÓDULOS ({(d.modules || []).length})</div>
      <div className="list">
        <div className="row list-head"><span className="grow">módulo</span><span className="c r">KB</span><span className="c r">uso</span></div>
        {(d.modules || []).map((m: Dict, i: number) => (
          <div className="row" key={i}><span className="grow">{m.name}</span><span className="c r">{m.size_kb}</span><span className="c r">{m.used + (m.by ? " · " + m.by : "")}</span></div>
        ))}
      </div>
    </div>
  );
}
