// Device.tsx — ID / CPU / DISPLAY / BOOT / INPUT. Porta da view "device".
import { actions, useStore } from "../store";
import { useAgentPoll } from "../lib/useAgentPoll";
import { fmt } from "../lib/format";
import { KV, MCard, SubBar, StateMsg } from "../components/ui";
import type { Dict } from "../types";

const SUBS = ["ID", "CPU", "DISPLAY", "BOOT", "INPUT"];
type Pair = [string, unknown];

function Group({ name, pairs }: { name?: string; pairs: (Pair | null | undefined)[] }) {
  return (
    <>
      {name ? <div className="sub">{name}</div> : null}
      {pairs.filter(Boolean).map((p, i) => <KV key={i} label={(p as Pair)[0]} value={(p as Pair)[1] as any} />)}
    </>
  );
}

export default function Device() {
  useStore();
  const sub = actions.getSub("device");
  const { data: d, error } = useAgentPoll<Dict>("/api/device", 60000);
  return (
    <div className="view">
      <div className="vtitle">DEVICE · {SUBS[sub]}</div>
      <SubBar labels={SUBS} active={sub} />
      {error ? <StateMsg kind="err" error={error} /> : !d ? <StateMsg /> : <Body d={d} sub={sub} />}
    </div>
  );
}

function Body({ d, sub }: { d: Dict; sub: number }) {
  const id = d.identity || {}, hw = d.hardware || {}, k = d.kernel || {}, dp = d.display || {}, ip = d.input || {};
  if (sub === 0) {
    return <Group pairs={[["HOST", id.hostname], ["DISTRO", id.distro], ["KERNEL", id.kernel], ["ARCH", id.arch],
      ["UPTIME", fmt.uptime(id.uptime_s)], ["TZ", id.timezone], ["USER", id.user], ["ROOTFS", id.rootfs]]} />;
  }
  if (sub === 1) {
    const soc = (hw.soc || "").replace(/^Rockchip\s+/, "");
    const gpu = (hw.gpu || "").replace(/^ARM\s+/, "").replace(/\s*\(.*\)/, "");
    const gpuArch = (String(hw.gpu || "").match(/\(([^)]+)\)/) || [])[1] || "";
    return (
      <div>
        <div className="minicards">
          <MCard ti="SoC" v={soc || "—"} s={(hw.cores || "?") + " cores"} />
          <MCard ti="RAM" v={hw.mem ? hw.mem.total_mb + " MB" : "—"} s={hw.mem ? "livre " + hw.mem.available_mb : ""} />
          <MCard ti="GPU" v={gpu || "—"} s={gpuArch} />
        </div>
        <div className="kv2">
          {(hw.freq || []).map((f: Dict, i: number) => <KV key={i} label={"CPU" + f.cpu} value={(f.cur_mhz > 0 ? f.cur_mhz : "?") + " MHz"} />)}
        </div>
        {(hw.thermals || []).map((t: Dict, i: number) => <KV key={i} label={"TEMP " + t.type} value={t.temp_c >= 0 ? t.temp_c + " °C" : "—"} />)}
        <KV label="SWAP/ZRAM" value={hw.mem && hw.mem.swap_total_mb > 0 ? hw.mem.swap_total_mb + " MB" : (hw.zram && hw.zram.length && hw.zram[0].mb > 0 ? hw.zram[0].mb + " MB zram" : "inativo")} />
        <KV label="GOVERNOR" value={hw.freq && hw.freq[0] ? hw.freq[0].governor : "—"} />
      </div>
    );
  }
  if (sub === 2) {
    const fb = dp.framebuffer || {}, bl = dp.backlight || {};
    const panelModel = dp.panel ? dp.panel.replace(/^[^,]*,/, "").split(/[\s—]/)[0] : "—";
    return (
      <div>
        <div className="minicards">
          <MCard ti="FB" v={fb.virtual_size || "—"} s={fb.bits_per_pixel ? "@" + fb.bits_per_pixel + "bpp" : ""} />
          <MCard ti="LUZ" v={bl.pct >= 0 ? bl.pct + "%" : "—"} s={bl.cur != null ? bl.cur + "/" + bl.max : ""} />
          <MCard ti="PAINEL" v={panelModel} s="MIPI-DSI" />
        </div>
        <Group name="ARMAZENAMENTO" pairs={(hw.storage || []).map((st: Dict): Pair => [st.dev, st.gb + " GB" + (st.ro ? " (ro)" : "") + (st.model ? " · " + st.model : "")])} />
      </div>
    );
  }
  if (sub === 3) {
    return (
      <div>
        <Group pairs={[["VERSION", k.version], ["MODELO DT", k.dtb_model || hw.model], ["MÓDULOS", k.modules_count]]} />
        <div className="hint">detalhes completos em KERNEL</div>
      </div>
    );
  }
  const usb = ip.usb || [];
  return (
    <div>
      {(ip.devices || []).map((dv: Dict, i: number) => <KV key={i} label={(dv.joypad ? "* " : "") + (dv.event || "?")} value={dv.name} />)}
      <div className="sub">USB</div>
      {!usb.length ? <div className="hint">(nenhum USB)</div> : usb.map((u: Dict, i: number) => <KV key={i} label={u.id || "?"} value={u.name || u.raw || ""} />)}
    </div>
  );
}
