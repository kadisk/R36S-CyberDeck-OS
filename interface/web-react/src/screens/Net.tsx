// Net.tsx — estado de rede + checklist + ações Wi-Fi (conectar/reconectar/buscar/conexões).
// Porta da view "network".
import { useState } from "react";
import { actions } from "../store";
import { useAgentPoll } from "../lib/useAgentPoll";
import { api } from "../lib/api";
import { KV, Badge, Focusable, StateMsg } from "../components/ui";
import type { NetSummary, AgentError } from "../types";

type Extra =
  | { type: "loading" }
  | { type: "err"; error: AgentError }
  | { type: "scan"; ssids: string[] }
  | { type: "conns"; rows: string[] }
  | null;

function Check({ ok, label, warnIfNo }: { ok: boolean; label: string; warnIfNo?: boolean }) {
  const mark = ok ? "✓" : (warnIfNo ? "×" : "?");
  return <div className={"chkline " + (ok ? "ok" : warnIfNo ? "warn" : "off")}>{mark + " " + label}</div>;
}

export default function Net() {
  const { data: d, error } = useAgentPoll<NetSummary>("/api/network/summary", 5000);
  const [extra, setExtra] = useState<Extra>(null);

  const act = (key: string) => {
    actions.toast("…");
    api.post<any>("/api/actions", { key }).then((r) => actions.toast((r && r.msg) || "ok")).catch((e: AgentError) => actions.toast("erro: " + (e.message || e), true));
  };
  const scan = () => { setExtra({ type: "loading" }); api.post<any>("/api/network/wifi/scan", {}).then((r) => setExtra({ type: "scan", ssids: r.ssids || [] })).catch((e: AgentError) => setExtra({ type: "err", error: e })); };
  const conns = () => { setExtra({ type: "loading" }); api.get<any>("/api/network/connections?limit=80").then((r) => setExtra({ type: "conns", rows: r.rows || [] })).catch((e: AgentError) => setExtra({ type: "err", error: e })); };

  if (error) return <div className="view"><div className="vtitle">REDE</div><StateMsg kind="err" error={error} /></div>;
  if (!d) return <div className="view"><div className="vtitle">REDE</div><StateMsg /></div>;

  const ext = (d.interfaces || []).filter((i) => i.name !== "lo");
  const up = ext.filter((i) => i.operstate === "up" || i.carrier);
  const ipIf = ext.filter((i) => (i.addrs || []).some((a) => a.family === "v4" && !/^127\./.test(a.address)));
  const ip = ipIf.length ? ((ipIf[0].addrs || []).filter((a) => a.family === "v4")[0] || {}).address : null;
  const dns = (d.dns || []).filter((x) => x && !/^127\./.test(x));
  const online = !!(d.gateway && ip);

  return (
    <div className="view">
      <div className="vtitle">REDE</div>
      <div className="kv"><span>REDE</span><b><Badge text={online ? "ONLINE" : "OFF"} kind={online ? "ok" : "warn"} /></b></div>
      <KV label="INTERFACE" value={ext.length ? ext.map((i) => i.name).join(", ") : "—"} />
      <KV label="IP" value={ip || "—"} />
      <KV label="GATEWAY" value={d.gateway || "—"} />
      <KV label="DNS" value={dns.join(", ") || "—"} />
      <KV label="SSID" value={d.ssid || "(n/a)"} />
      <div className="sub">DIAGNÓSTICO</div>
      <Check ok={ext.length > 0} label="interface externa detectada (dongle USB)" warnIfNo />
      <Check ok={up.length > 0} label="link ativo" warnIfNo />
      <Check ok={!!ip} label="IP recebido" warnIfNo />
      <Check ok={!!d.gateway} label="gateway configurado" warnIfNo />
      <Check ok={dns.length > 0} label="DNS configurado" />
      <div className="toolbar">
        <Focusable as="button" className="chip" onClick={() => act("wifi-up")}>conectar</Focusable>
        <Focusable as="button" className="chip" onClick={() => act("wifi-reconnect")}>reconectar</Focusable>
        <Focusable as="button" className="chip" onClick={scan}>buscar redes</Focusable>
        <Focusable as="button" className="chip" onClick={conns}>conexões (ss)</Focusable>
      </div>
      <ExtraView extra={extra} />
    </div>
  );
}

function ExtraView({ extra }: { extra: Extra }) {
  if (!extra) return null;
  if (extra.type === "loading") return <StateMsg />;
  if (extra.type === "err") return <StateMsg kind="err" error={extra.error} />;
  if (extra.type === "scan") {
    return (
      <div>
        <div className="sub">{"REDES VISÍVEIS (" + extra.ssids.length + ")"}</div>
        {!extra.ssids.length ? <div className="chkline off">? nenhuma rede (dongle/driver ok?)</div>
          : extra.ssids.map((s, i) => <div key={i} className="chkline">{"· " + s}</div>)}
      </div>
    );
  }
  return <pre className="box">{(extra.rows || []).join("\n")}</pre>;
}
