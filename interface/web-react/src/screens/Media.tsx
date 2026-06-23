// Media.tsx — TESTE A/V: lista a mídia (/root/media) e toca via HTML5 (file://).
// Porta da view "media". B: para a mídia primeiro, depois volta.
import { useState, useEffect } from "react";
import { actions } from "../store";
import { useAgentPoll } from "../lib/useAgentPoll";
import { fmt } from "../lib/format";
import { Focusable, StateMsg } from "../components/ui";
import type { Dict } from "../types";

export default function Media() {
  const { data: d, error } = useAgentPoll<Dict>("/api/media", 60000);
  const [playing, setPlaying] = useState<Dict | null>(null);

  useEffect(() => {
    actions.registerBack(() => { if (playing) { setPlaying(null); return true; } return false; });
  }, [playing]);

  return (
    <div className="view">
      <div className="vtitle">TESTE A/V</div>
      <div className="hint">A: toca · B: para/volta · áudio e vídeo de vários formatos</div>
      {playing ? <Player item={playing} /> : null}
      {error ? <StateMsg kind="err" error={error} /> : !d ? <StateMsg /> : !(d.items || []).length ? (
        <StateMsg kind="empty">sem mídia em {d.dir || "/root/media"}</StateMsg>
      ) : (
        <div className="list">
          {(d.items as Dict[]).map((it, i) => (
            <Focusable key={i} className="row" onClick={() => setPlaying(it)}>
              <span className={"fstype t-" + it.kind}>{it.kind === "video" ? "VID" : "AUD"}</span>
              <span className="grow">{it.name}</span>
              <span className="r">{String(it.ext).toUpperCase()}</span>
              <span className="r">{fmt.bytes(it.size)}</span>
            </Focusable>
          ))}
        </div>
      )}
    </div>
  );
}

function Player({ item }: { item: Dict }) {
  const src = "file://" + item.path;
  return (
    <div className="media-player">
      {item.kind === "video"
        ? <video src={src} controls autoPlay style={{ maxWidth: "100%", maxHeight: "200px", display: "block" }} />
        : <audio src={src} controls autoPlay />}
      <div className="hint">tocando: {item.name} ({item.ext})</div>
    </div>
  );
}
