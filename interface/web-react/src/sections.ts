// sections.ts — abas/seções do 1º corte (fundação). As demais (PROCS/FS/SVC/CMD/...)
// entram na 2ª leva. `subs` = subpáginas trocadas por L1/R1.
export interface Section { id: string; title: string; tab: boolean; endpoint: string | null; live?: boolean; subs?: string[]; }

export const SECTIONS: Section[] = [
  { id: "home", title: "INÍCIO", tab: true, endpoint: null },
  { id: "status", title: "STATUS", tab: true, endpoint: "/api/status", live: true, subs: ["AO VIVO", "ENERGIA", "TENDÊNCIA"] },
  { id: "net", title: "REDE", tab: true, endpoint: "/api/network/summary", live: true },
  { id: "logs", title: "LOGS", tab: true, endpoint: null, subs: ["dmesg", "journal", "agent", "kiosk", "ui"] },
  { id: "device", title: "APAR.", tab: true, endpoint: "/api/device", subs: ["ID", "CPU", "DISPLAY", "BOOT", "INPUT"] },
];

export const TAB_IDS: string[] = SECTIONS.filter((s) => s.tab).map((s) => s.id);
export function sectionOf(id: string): Section | undefined { return SECTIONS.find((s) => s.id === id); }

export const HINTS: Record<string, string> = {
  home: "A: abrir · FN: menu · ←→: abas · ↑↓: foco",
  status: "L1/R1: subpágina · ←→: abas · B: voltar",
  net: "A: ação · ←→: abas · B: voltar",
  logs: "A: detalhe · L1/R1: origem · B: voltar",
  device: "L1/R1: subpágina · ←→: abas · B: voltar",
};
