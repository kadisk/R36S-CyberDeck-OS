// useAgentPoll.ts — busca uma rota do agente com intervalo (porta do loop "vivo" do app.js).
import { useState, useEffect } from "react";
import { api } from "./api";
import type { AgentError } from "../types";

export function useAgentPoll<T = any>(endpoint: string | null, intervalMs = 4000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<AgentError | null>(null);
  useEffect(() => {
    if (!endpoint) return undefined;
    let alive = true;
    const tick = () => api.get<T>(endpoint, { timeout: 6000 })
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e: AgentError) => { if (alive) setError(e); });
    tick();
    const t = setInterval(tick, intervalMs);
    return () => { alive = false; clearInterval(t); };
  }, [endpoint, intervalMs]);
  return { data, error };
}
