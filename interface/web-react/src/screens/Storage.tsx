// Storage.tsx — ARMAZENAMENTO: rootfs + partições + expandir + 2º cartão. Porta da view "storage".
import { useState, useEffect, useCallback } from "react";
import { actions } from "../store";
import { api } from "../lib/api";
import { fmt } from "../lib/format";
import { KV, Gauge, Focusable, StateMsg } from "../components/ui";
import type { Dict, AgentError } from "../types";

export default function Storage() {
  const [d, setD] = useState<Dict | null>(null);
  const [error, setError] = useState<AgentError | null>(null);
  const load = useCallback(() => { api.get<Dict>("/api/storage").then((r) => { setD(r); setError(null); }).catch(setError); }, []);
  useEffect(() => { load(); }, [load]);

  const expand = () => {
    actions.openConfirm("EXPANDIR ROOTFS · usa o cartão inteiro (não apaga dados)").then((ok) => {
      if (!ok) return;
      actions.toast("expandindo…");
      api.post<Dict>("/api/actions", { key: "expand-rootfs" }).then((r) => { actions.toast(r.msg || "ok"); load(); }).catch((e: AgentError) => actions.toast(e.message, true));
    });
  };
  const card = (op: string) => api.post<Dict>("/api/storage/" + op, {}).then((r) => { actions.toast(r.msg || "ok"); load(); }).catch((e: AgentError) => actions.toast(e.message, true));

  if (error) return <div className="view"><div className="vtitle">ARMAZENAMENTO</div><StateMsg kind="err" error={error} /></div>;
  if (!d) return <div className="view"><div className="vtitle">ARMAZENAMENTO</div><StateMsg /></div>;

  const r: Dict = d.rootfs || {}, disk: Dict = d.disk || {}, sc: Dict = d.second_card || {};
  return (
    <div className="view">
      <div className="vtitle">ARMAZENAMENTO</div>
      {r.usepct >= 0 ? <Gauge label="ROOTFS" pct={r.usepct} /> : null}
      <KV label="ROOTFS" value={r.size >= 0 ? fmt.bytes(r.used) + " / " + fmt.bytes(r.size) + " livre " + fmt.bytes(r.avail) : "—"} />
      <KV label="CARTÃO" value={(disk.dev || "—") + "  " + fmt.bytes(disk.size)} />
      <div className="sub">PARTIÇÕES</div>
      <div className="list">
        {(d.parts || []).map((p: Dict, i: number) => (
          <div className="row" key={i}>
            <span className="fstype">{String(p.role).toUpperCase()}</span>
            <span className="grow">{p.dev.replace("/dev/", "") + (p.label ? " " + p.label : "")}</span>
            <span className="r">{p.fstype || "?"}</span>
            <span className="r">{fmt.bytes(p.size)}</span>
          </div>
        ))}
      </div>
      {d.rootfs_growable ? (
        <div className="list">
          <Focusable className="row" onClick={expand}><span className="grow">Expandir rootfs p/ o cartão inteiro</span><span className="r">+{fmt.bytes(d.expandable_bytes)}</span></Focusable>
        </div>
      ) : <div className="hint">{d.blocked_by ? "rootfs não expansível: " + d.blocked_by : "rootfs já ocupa o máximo disponível"}</div>}
      <div className="sub">2º CARTÃO (slot extra)</div>
      {!sc.present ? <div className="hint">nenhum 2º cartão detectado</div> : (
        <div>
          <KV label="DISPOSITIVO" value={sc.dev || "—"} />
          <KV label="ESTADO" value={sc.mounted ? "montado em " + sc.mount + " (" + (sc.fstype || "?") + ")" : "não montado"} />
          {sc.mounted && sc.size >= 0 ? <KV label="ESPAÇO" value={fmt.bytes(sc.avail) + " livre de " + fmt.bytes(sc.size)} />
            : sc.size_bytes >= 0 ? <KV label="TAMANHO" value={fmt.bytes(sc.size_bytes)} /> : null}
          <div className="list">
            <Focusable className="row" onClick={() => card(sc.mounted ? "unmount" : "mount")}><span className="grow">{sc.mounted ? "Desmontar 2º cartão" : "Montar 2º cartão"}</span></Focusable>
          </div>
          {sc.mounted ? <div className="hint">arquivos de mídia aqui aparecem em TESTE A/V</div> : null}
        </div>
      )}
    </div>
  );
}
