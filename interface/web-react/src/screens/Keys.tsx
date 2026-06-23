// Keys.tsx — TESTE DE BOTÕES: acende a célula do controle pressionado + analógicos/eixos.
// Faz seu PRÓPRIO polling do gamepad (o useInput não navega nesta tela; sai com Start+Select).
import { useState, useEffect, useRef } from "react";

const GP_RAW: Record<string, number> = { B: 0, A: 1, X: 2, Y: 3, L1: 4, R1: 5, R2: 6, L2: 7, UP: 8, DOWN: 9, LEFT: 10, RIGHT: 11, SELECT: 12, START: 13, FN: 16 };
const GP_STD: Record<string, number> = { A: 0, B: 1, X: 2, Y: 3, L1: 4, R1: 5, L2: 6, R2: 7, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
const NAME2KEY: Record<string, string> = { A: "A", B: "B", X: "X", Y: "Y", L1: "L1", R1: "R1", L2: "L2", R2: "R2", Select: "SELECT", Start: "START", FN: "FN", "↑": "UP", "↓": "DOWN", "←": "LEFT", "→": "RIGHT" };
const KT_BTNS = ["L2", "L1", "R1", "R2", "Select", "FN", "Start", "↑", "↓", "←", "→", "Y", "X", "A", "B"];
const btnClass = (n: string) => ({ A: "btn-a", B: "btn-b", X: "btn-x", Y: "btn-y" } as Record<string, string>)[n] || "btn-o";

interface Snap { id: string; map: Record<string, number>; pressed: boolean[]; axes: number[]; }

export default function Keys() {
  const [snap, setSnap] = useState<Snap | null>(null);
  const sigRef = useRef("");
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const pads = typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [];
      const gp = pads && pads[0];
      if (gp) {
        const map = gp.mapping === "standard" ? GP_STD : GP_RAW;
        const pressed = gp.buttons.map((b) => b.pressed);
        const axes = Array.prototype.slice.call(gp.axes).map((a: number) => Math.round(a * 100) / 100);
        const sig = gp.id + "|" + pressed.map((p) => (p ? 1 : 0)).join("") + "|" + axes.join(",");
        if (sig !== sigRef.current) { sigRef.current = sig; setSnap({ id: gp.id, map, pressed, axes }); }
      } else if (sigRef.current !== "none") { sigRef.current = "none"; setSnap(null); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const hit = (name: string): boolean => {
    if (!snap) return false;
    const idx = snap.map[NAME2KEY[name]];
    return idx != null && !!snap.pressed[idx];
  };
  const f = (v: number) => (v >= 0 ? "+" : "") + v.toFixed(2);
  const ax = snap?.axes || [];
  const pressedIdx = snap ? snap.pressed.map((p, i) => (p ? i : -1)).filter((i) => i >= 0) : [];

  return (
    <div className="view">
      <div className="vtitle">TESTE DE BOTÕES</div>
      <div className="hint">Aperte cada controle — a célula acende quando pressionado. (Start+Select sai)</div>
      <div className="kv"><span>GAMEPAD</span><b>{snap ? '"' + snap.id + '"' : "não detectado"}</b></div>
      <div className="kt-pad">
        {KT_BTNS.map((name) => (
          <span key={name} className={"ktn btn " + btnClass(name) + (hit(name) ? " hit" : "")} data-btn={name}>{name}</span>
        ))}
      </div>
      <div className="kv"><span>ANALÓGICO ESQ</span><b>{ax.length >= 2 ? "x " + f(ax[0]) + " · y " + f(ax[1]) : "—"}</b></div>
      <div className="kv"><span>ANALÓGICO DIR</span><b>{ax.length >= 4 ? "x " + f(ax[2]) + " · y " + f(ax[3]) : "—"}</b></div>
      <pre className="box">{snap ? "axes " + ax.map((a, j) => j + ":" + a.toFixed(2)).join("  ") + "\nbotões idx: " + (pressedIdx.join(", ") || "—") : "(aguardando gamepad…)"}</pre>
    </div>
  );
}
