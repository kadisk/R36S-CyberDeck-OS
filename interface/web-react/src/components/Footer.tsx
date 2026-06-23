// Footer.tsx — dica por seção (A/B/X/Y coloridos via btnize) + estado do agente.
import { useStore } from "../store";
import { HINTS } from "../sections";
import { btnizeHtml } from "../lib/format";

export default function Footer() {
  const s = useStore();
  const txt = HINTS[s.section] || "A: ok · B: voltar · ←→: abas · ↑↓: foco";
  return (
    <div id="hints">
      <span dangerouslySetInnerHTML={{ __html: btnizeHtml(txt) }} />
      <span style={{ flex: 1 }} />
      <span id="agent-state" className={s.agentOnline ? "on" : "off"}>
        agente: {s.agentOnline ? "ON" : "OFF"}
      </span>
    </div>
  );
}
