// store.ts — estado global observável (fora da árvore React, p/ a camada de input acessar)
// + ações (navegação, FN, confirm, toast, volume, screenshot). Porta do router/controlador
// de web-vanilla/public/app.js. Componentes assinam via useStore() (useSyncExternalStore).
import { useSyncExternalStore } from "react";
import { api } from "./lib/api";
import { history } from "./lib/history";
import { TAB_IDS, sectionOf } from "./sections";
import type { StatusData, AgentError } from "./types";

interface ConfirmState { label: string; resolve: (v: boolean) => void; }
interface ToastState { msg: string; err: boolean; }

interface State {
  section: string;
  subs: Record<string, number>;
  agentOnline: boolean;
  fnOpen: boolean;
  confirm: ConfirmState | null;
  toast: ToastState | null;
  lastStatus: StatusData | null;
  screenBack: (() => boolean) | null;
}

const state: State = {
  section: "home",
  subs: {},
  agentOnline: false,
  fnOpen: false,
  confirm: null,
  toast: null,
  lastStatus: null,
  screenBack: null,
};

let version = 0;
const listeners = new Set<() => void>();
function emit(): void { version++; listeners.forEach((l) => l()); }

function subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; }
function getSnapshot(): number { return version; }
export function getState(): State { return state; }
export function useStore(): State { useSyncExternalStore(subscribe, getSnapshot); return state; }

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const actions = {
  go(id: string): void {
    if (!sectionOf(id)) return;
    state.fnOpen = false;
    state.section = id;
    state.screenBack = null;
    emit();
  },
  nextTab(dir: number): void {
    let i = TAB_IDS.indexOf(state.section);
    if (i < 0) i = 0;
    i = (i + dir + TAB_IDS.length) % TAB_IDS.length;
    actions.go(TAB_IDS[i]);
  },
  back(): void {
    if (state.fnOpen) { state.fnOpen = false; emit(); return; }
    if (typeof state.screenBack === "function" && state.screenBack()) return;
    if (state.section !== "home") actions.go("home");
  },
  registerBack(fn: (() => boolean) | null): void { state.screenBack = fn; },

  getSub(id: string): number { return state.subs[id] || 0; },
  setSub(id: string, idx: number): void { state.subs[id] = idx; emit(); },
  subCycle(dir: number): void {
    const sec = sectionOf(state.section);
    const n = (sec && sec.subs && sec.subs.length) || 0;
    if (!n) return;
    const cur = state.subs[state.section] || 0;
    state.subs[state.section] = (cur + dir + n) % n;
    emit();
  },

  toggleFn(): void { state.fnOpen = !state.fnOpen; emit(); },
  closeFn(): void { if (state.fnOpen) { state.fnOpen = false; emit(); } },

  openConfirm(label: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => { state.confirm = { label, resolve }; emit(); });
  },
  resolveConfirm(val: boolean): void {
    const c = state.confirm; state.confirm = null; emit();
    if (c) c.resolve(val);
  },

  toast(msg: string, err?: boolean): void {
    state.toast = { msg, err: !!err }; emit();
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { state.toast = null; emit(); }, 2600);
  },

  setAgent(on: boolean): void {
    const v = !!on;
    if (state.agentOnline !== v) { state.agentOnline = v; emit(); }
  },
  setStatus(d: StatusData): void {
    state.lastStatus = d;
    if (d.cpu != null && d.cpu >= 0) history.push("cpu", d.cpu);
    if (d.mem) history.push("ram", d.mem.pct);
    if (d.temp != null && d.temp >= 0) history.push("temp", d.temp);
    if (d.load_arr) history.push("load", d.load_arr[0]);
    const b = d.battery || {};
    if (b.est != null && b.est >= 0) history.push("bat", b.est);
    else if (b.volt && b.volt > 0) history.push("bat", b.volt);
    emit();
  },

  action(key: string, label?: string, danger?: boolean): void {
    const doIt = () => api.post("/api/actions", { key })
      .then((r: any) => actions.toast((r && r.msg) || "ok"))
      .catch((e: AgentError) => actions.toast(e.business ? e.message : "agente offline", true));
    if (danger && label) actions.openConfirm(label).then((ok) => { if (ok) doIt(); });
    else doIt();
  },
  volume(key: string): void {
    api.post("/api/actions", { key })
      .then((d: any) => actions.toast((d && d.msg) || "volume"))
      .catch((e: AgentError) => actions.toast(e.business ? e.message : "agente offline", true));
  },
  screenshot(silent?: boolean): void {
    setTimeout(() => {
      api.post("/api/screenshot", {}, { timeout: 12000 })
        .then((d: any) => { if (!silent) actions.toast("salvo: " + (d && d.file ? d.file.replace(/^.*\//, "") : "ok")); })
        .catch((e: AgentError) => { if (!silent) actions.toast(e.business ? e.message : "falha no screenshot (agente offline)", true); });
    }, silent ? 120 : 250);
  },
};
