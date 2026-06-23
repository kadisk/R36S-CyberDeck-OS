// types.ts — formas principais das respostas do cyberdeck-agent (parciais; o agente é a fonte).
export interface AgentError extends Error { business?: boolean; code?: string; }

export interface Mem { pct: number; used: number; total: number; used_mb?: number; total_mb?: number; available_mb?: number; swap_total_mb?: number; }
export interface Battery { pct?: number; est?: number; volt?: number; ocv?: number; curr?: number; ac?: number; status?: string; capacity_trust?: string; }
export interface NetIfBrief { iface?: string; ip?: string; name?: string; }

export interface StatusData {
  host?: string; cpu?: number; mem?: Mem; temp?: number; load_arr?: number[];
  cores?: number; uptime?: number; battery?: Battery; net?: NetIfBrief[];
  brightness?: { pct: number };
}

export interface HealthItem { level: string; label: string; target: string; }
export interface HealthData {
  level?: string;
  summary?: { net_ip?: string; systemd?: string; failed?: number };
  items?: HealthItem[];
}

export interface NetAddr { family: string; address: string; }
export interface NetIface { name: string; operstate?: string; carrier?: boolean; addrs?: NetAddr[]; }
export interface NetSummary { interfaces?: NetIface[]; gateway?: string; dns?: string[]; ssid?: string; signal_dbm?: number; }

// DEVICE e demais payloads aninhados são dinâmicos: tipagem frouxa proposital.
export type Dict = Record<string, any>;

export type Level = "ok" | "warn" | "crit";
