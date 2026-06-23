// Fs.tsx — navegador read-only do rootfs: atalhos + lista paginada + viewer de texto.
// Porta da view "fs". L1/R1 pagina; A abre dir/arquivo; B sobe um nível / sai do viewer.
import { useState, useEffect } from "react";
import { actions, useStore } from "../store";
import { api } from "../lib/api";
import { fmt } from "../lib/format";
import { usePager } from "../lib/usePager";
import { Focusable, StateMsg } from "../components/ui";
import type { Dict, AgentError } from "../types";

const SIZE = 10;
const typeLabel = (t: string) => ({ dir: "DIR", symlink: "LINK", file: "FILE", block: "BLK", char: "CHR" } as Record<string, string>)[t] || "?";

export default function Fs() {
  const path = useStore().fsPath;
  const [mode, setMode] = useState<"list" | "view">("list");
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  const { setPage, apply } = usePager();

  useEffect(() => { api.get<Dict>("/api/fs/bookmarks").then((d) => setBookmarks(d.bookmarks || [])).catch(() => {}); }, []);

  const nav = (p: string) => { actions.setFsPath(p); setMode("list"); setPage(0); };
  useEffect(() => {
    actions.registerBack(() => {
      if (mode === "view") { setMode("list"); actions.setFsPath(path.replace(/\/[^/]*$/, "") || "/"); return true; }
      if (path !== "/") { nav(path.replace(/\/[^/]*$/, "") || "/"); return true; }
      return false;
    });
  }, [mode, path]);

  if (mode === "view") return <FileView path={path} />;
  return <Listing path={path} bookmarks={bookmarks} nav={nav} apply={apply} onOpen={(e) => {
    const full = (path === "/" ? "" : path) + "/" + e.name;
    if (e.type === "dir" || e.type === "symlink") nav(full);
    else if (e.type === "file") { actions.setFsPath(full); setMode("view"); }
    else actions.toast("arquivo especial: " + e.type, true);
  }} />;
}

function Listing({ path, bookmarks, nav, onOpen, apply }: { path: string; bookmarks: string[]; nav: (p: string) => void; onOpen: (e: Dict) => void; apply: (c: number, s: number) => { total: number; page: number } }) {
  const [d, setD] = useState<Dict | null>(null);
  const [error, setError] = useState<AgentError | null>(null);
  useEffect(() => { setD(null); setError(null); api.get<Dict>("/api/fs/list?path=" + encodeURIComponent(path)).then(setD).catch(setError); }, [path]);

  if (error) return <div className="view"><div className="vtitle">FS</div><div className="crumb">{path}</div><StateMsg kind="err" error={error} /></div>;
  if (!d) return <div className="view"><div className="vtitle">FS</div><div className="crumb">{path}</div><StateMsg /></div>;

  const entries: Dict[] = d.entries || [];
  const { total, page } = apply(entries.length, SIZE);
  const shown = entries.slice(page * SIZE, page * SIZE + SIZE);

  return (
    <div className="view">
      <div className="vtitle">FS{total > 1 ? "  ·  pág " + (page + 1) + "/" + total + " (L1/R1)" : ""}</div>
      <div className="crumb">{path}</div>
      {bookmarks.length ? (
        <div className="toolbar">{bookmarks.map((p) => <Focusable as="button" key={p} className="chip" onClick={() => nav(p)}>{p}</Focusable>)}</div>
      ) : null}
      <div className="list">
        {d.parent != null ? (
          <Focusable className="row" onClick={() => nav(d.parent)}><span className="fstype">UP</span><span className="grow">..</span></Focusable>
        ) : null}
        {shown.map((e, i) => (
          <Focusable key={i} className="row" onClick={() => onOpen(e)}>
            <span className={"fstype t-" + e.type}>{typeLabel(e.type)}</span>
            <span className="grow">{e.name + (e.type === "symlink" ? " → " + (e.target || "") : "")}</span>
            <span className="c r">{e.type === "file" ? fmt.bytes(e.size) : ""}</span>
            <span className="c r">{e.mode}</span>
          </Focusable>
        ))}
        {d.truncated ? <div className="hint">… lista truncada ({d.count} itens)</div> : null}
      </div>
    </div>
  );
}

function FileView({ path }: { path: string }) {
  const [d, setD] = useState<Dict | null>(null);
  const [error, setError] = useState<AgentError | null>(null);
  useEffect(() => { api.get<Dict>("/api/fs/read?path=" + encodeURIComponent(path)).then(setD).catch(setError); }, [path]);
  return (
    <div className="view">
      <div className="vtitle">FILE  {path}</div>
      {error ? <StateMsg kind="err" error={error} /> : !d ? <StateMsg /> : d.type === "text" ? (
        <>
          {d.truncated ? <div className="hint">arquivo truncado em {fmt.bytes(d.bytes)}</div> : null}
          <pre className="box full" tabIndex={0} data-focus="1">{d.content || "(vazio)"}</pre>
        </>
      ) : <StateMsg kind="empty">{d.message || "não é texto"}</StateMsg>}
    </div>
  );
}
