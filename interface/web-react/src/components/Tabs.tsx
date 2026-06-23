// Tabs.tsx — barra de abas. Ativa = store.section; clique/foco navegáveis pela camada de input.
import { useStore, actions } from "../store";
import { SECTIONS } from "../sections";

export default function Tabs() {
  const s = useStore();
  return (
    <div id="tabs">
      {SECTIONS.filter((m) => m.tab).map((m) => (
        <button
          key={m.id}
          className={"tab" + (m.id === s.section ? " active" : "")}
          tabIndex={0}
          onClick={() => actions.go(m.id)}
        >
          {m.title}
        </button>
      ))}
    </div>
  );
}
