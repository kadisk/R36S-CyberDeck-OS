// sections.ts — seções da web-react. Tabs (tab:true) na barra superior; as demais são
// acessadas pelo menu FN. `subs` = subpáginas trocadas por L1/R1.
export interface Section { id: string; title: string; tab: boolean; endpoint: string | null; live?: boolean; subs?: string[]; }

export const SECTIONS: Section[] = [
  { id: "home", title: "HOME", tab: true, endpoint: null },
  { id: "status", title: "STATUS", tab: true, endpoint: "/api/status", live: true, subs: ["AO VIVO", "ENERGIA", "TENDÊNCIA"] },
  { id: "procs", title: "PROCS", tab: true, endpoint: "/api/processes", live: true },
  { id: "net", title: "NET", tab: true, endpoint: "/api/network/summary", live: true },
  { id: "logs", title: "LOGS", tab: true, endpoint: null, subs: ["dmesg", "journal", "agent", "kiosk", "ui"] },
  { id: "device", title: "DEVICE", tab: true, endpoint: "/api/device", subs: ["ID", "CPU", "DISPLAY", "BOOT", "INPUT"] },
  { id: "fs", title: "FS", tab: true, endpoint: null },
  { id: "systemd", title: "SVC", tab: true, endpoint: null, live: true },
  { id: "cmd", title: "CMD", tab: true, endpoint: null },
  // acessadas pelo menu FN:
  { id: "kernel", title: "KERNEL", tab: false, endpoint: "/api/kernel" },
  { id: "tools", title: "AJUSTES", tab: false, endpoint: null, subs: ["DISPLAY", "AUDIO"] },
  { id: "storage", title: "DISCO", tab: false, endpoint: "/api/storage" },
  { id: "media", title: "MEDIA", tab: false, endpoint: null },
  { id: "keys", title: "KEYS", tab: false, endpoint: null },
];

export const TAB_IDS: string[] = SECTIONS.filter((s) => s.tab).map((s) => s.id);
export function sectionOf(id: string): Section | undefined { return SECTIONS.find((s) => s.id === id); }

export const HINTS: Record<string, string> = {
  home: "A: abrir · FN: menu · ←→: abas · ↑↓: foco",
  status: "L1/R1: subpágina · ←→: abas · B: voltar",
  procs: "A: detalhe · L1/R1: página · B: voltar",
  net: "A: ação · ←→: abas · B: voltar",
  logs: "A: detalhe · L1/R1: origem · B: voltar",
  device: "L1/R1: subpágina · ←→: abas · B: voltar",
  fs: "A: abrir · L1/R1: página · B: voltar",
  systemd: "A: detalhe/ação · L1/R1: página · B: voltar",
  cmd: "A: executar · B: voltar",
  kernel: "A: nó no FS · B: voltar",
  tools: "A: aplicar · L1/R1: subpágina · B: voltar",
  storage: "A: ação · B: voltar",
  media: "A: tocar · B: parar/voltar",
  keys: "aperte os botões · Start+Select: sair",
};
