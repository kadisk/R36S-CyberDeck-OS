// App.tsx — casca: topbar + abas + tela ativa (#content) + rodapé + overlays.
// Monta a camada de input e o poll global de /api/status.
import { useEffect } from "react";
import { useStore, actions } from "./store";
import { sectionOf } from "./sections";
import { onAgentChange, api } from "./lib/api";
import { useInput } from "./input/useInput";
import { SCREENS } from "./screens/registry";
import TopBar from "./components/TopBar";
import Tabs from "./components/Tabs";
import Footer from "./components/Footer";
import FnMenu from "./components/FnMenu";
import Confirm from "./components/Confirm";
import Toast from "./components/Toast";
import type { StatusData } from "./types";

export default function App() {
  const s = useStore();
  useInput();

  useEffect(() => {
    // abrir direto numa seção via #hash (ex.: index.html#procs) — útil p/ teste
    const h = (location.hash || "").replace("#", "");
    if (h && sectionOf(h)) actions.go(h);
    onAgentChange(actions.setAgent);
    api.get<{ fontScale?: number }>("/api/settings", { timeout: 4000 }).then((s) => actions.applyFontScale(s.fontScale || 1)).catch(() => {});
    const tick = () => api.get<StatusData>("/api/status", { timeout: 4000 }).then(actions.setStatus).catch(() => {});
    tick();
    const t = setInterval(tick, 2000);
    return () => clearInterval(t);
  }, []);

  const subKey = s.subs[s.section];
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const c = document.getElementById("content");
      const f = c && c.querySelector("[data-focus]");
      if (f) try { (f as HTMLElement).focus(); } catch (e) {}
    });
    return () => cancelAnimationFrame(id);
  }, [s.section, subKey]);

  const Screen = SCREENS[s.section] || SCREENS.home;
  return (
    <div id="app">
      <TopBar />
      <Tabs />
      <div id="content"><Screen /></div>
      <Footer />
      <FnMenu />
      <Confirm />
      <Toast />
    </div>
  );
}
