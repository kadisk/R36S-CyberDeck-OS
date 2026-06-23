// useInput.ts — camada de input. Porta de web-vanilla/public/js/gamepad.js:
// teclado (dev), Gamepad API (R36S odroidgo3-joypad), ponteiro virtual (analóg. esq via
// driver do X) e scroll (analóg. dir). Opera no DOM [data-focus] da ÁREA ATIVA (#content
// ou #fnmenu) e dispara as ações do store. Montado UMA vez no App.
import { useEffect } from "react";
import { getState, actions } from "../store";

type Dir = "up" | "down" | "left" | "right";

export function useInput(): void {
  useEffect(() => {
    const confirmOpen = () => !!getState().confirm;
    const fnOpen = () => getState().fnOpen;
    const activeEl = (): HTMLElement | null => document.getElementById(fnOpen() ? "fnmenu" : "content");
    function focusables(): HTMLElement[] {
      const root = activeEl(); if (!root) return [];
      return Array.prototype.slice.call(root.querySelectorAll("[data-focus]"))
        .filter((e: HTMLElement) => e.offsetParent !== null || e.getClientRects().length);
    }
    function moveFocus(dir: number): void {
      const items = focusables(); if (!items.length) return;
      let i = items.indexOf(document.activeElement as HTMLElement);
      i = (i < 0 ? (dir > 0 ? 0 : items.length - 1) : i + dir + items.length) % items.length;
      items[i].focus(); try { items[i].scrollIntoView({ block: "nearest" }); } catch (e) {}
    }
    const focusInto = (el: HTMLElement | null) => { if (!el) return; try { el.focus(); el.scrollIntoView({ block: "nearest" }); } catch (e) {} };
    const activeTabEl = () => document.querySelector("#tabs .tab.active") as HTMLElement | null;
    const isTab = (el: Element | null) => !!(el && el.classList && el.classList.contains("tab"));

    function move(dir: Dir): void {
      if (confirmOpen()) return;
      hidePointer();
      if (fnOpen()) { if (dir === "up" || dir === "down") moveFocus(dir === "down" ? 1 : -1); return; }
      const cur = document.activeElement as HTMLElement | null;
      if (isTab(cur)) {
        if (dir === "left" || dir === "right") { actions.nextTab(dir === "right" ? 1 : -1); const nt = activeTabEl(); if (nt) nt.focus(); }
        else if (dir === "down") { const f0 = focusables()[0]; if (f0) focusInto(f0); }
        return;
      }
      const items = focusables();
      if (!items.length) {
        if (dir === "left") actions.nextTab(-1); else if (dir === "right") actions.nextTab(1);
        else if (dir === "up") { const t0 = activeTabEl(); if (t0) t0.focus(); }
        return;
      }
      if (!cur || items.indexOf(cur) < 0) { focusInto(items[0]); return; }
      const cr = cur.getBoundingClientRect();
      const ccx = cr.left + cr.width / 2, ccy = cr.top + cr.height / 2;
      let best: HTMLElement | null = null, bestScore = Infinity;
      for (let k = 0; k < items.length; k++) {
        const el = items[k]; if (el === cur) continue;
        const r = el.getBoundingClientRect();
        const dx = (r.left + r.width / 2) - ccx, dy = (r.top + r.height / 2) - ccy;
        let ok = false, primary = 0, cross = 0;
        if (dir === "left") { ok = dx < -1; primary = -dx; cross = Math.abs(dy); }
        else if (dir === "right") { ok = dx > 1; primary = dx; cross = Math.abs(dy); }
        else if (dir === "up") { ok = dy < -1; primary = -dy; cross = Math.abs(dx); }
        else { ok = dy > 1; primary = dy; cross = Math.abs(dx); }
        if (!ok) continue;
        const score = cross * 3 + primary;
        if (score < bestScore) { bestScore = score; best = el; }
      }
      if (best) focusInto(best);
      else if (dir === "left") actions.nextTab(-1);
      else if (dir === "right") actions.nextTab(1);
      else if (dir === "up") { const t = activeTabEl(); if (t) t.focus(); }
    }
    function activate(): void {
      const el = document.activeElement as HTMLElement | null;
      if (el && el !== document.body && el.click) el.click();
    }

    function onKey(e: KeyboardEvent): void {
      switch (e.key) {
        case "AudioVolumeUp": actions.volume("volume-up"); e.preventDefault(); return;
        case "AudioVolumeDown": actions.volume("volume-down"); e.preventDefault(); return;
        case "AudioVolumeMute": actions.volume("volume-mute"); e.preventDefault(); return;
        case "F12": case "PrintScreen": actions.screenshot(); e.preventDefault(); return;
        default: break;
      }
      if (confirmOpen()) {
        if (e.key === "Enter" || e.key === " ") { actions.resolveConfirm(true); e.preventDefault(); }
        else if (e.key === "Escape" || e.key === "Backspace") { actions.resolveConfirm(false); e.preventDefault(); }
        return;
      }
      if (fnOpen()) {
        if (e.key === "Escape" || e.key === "Backspace" || e.key === "f" || e.key === "F") actions.closeFn();
        else if (e.key === "Enter" || e.key === " ") activate();
        else if (e.key === "ArrowDown") move("down");
        else if (e.key === "ArrowUp") move("up");
        e.preventDefault(); return;
      }
      switch (e.key) {
        case "ArrowRight": move("right"); break;
        case "ArrowLeft": move("left"); break;
        case "ArrowDown": move("down"); break;
        case "ArrowUp": move("up"); break;
        case "Tab": moveFocus(e.shiftKey ? -1 : 1); break;
        case "Enter": activate(); break;
        case "f": case "F": actions.toggleFn(); break;
        case "Escape": case "Backspace": actions.back(); break;
        case "[": actions.subCycle(-1); break;
        case "]": actions.subCycle(1); break;
        case "PageDown": scrollContent(120); break;
        case "PageUp": scrollContent(-120); break;
        default: return;
      }
      e.preventDefault();
    }
    function scrollContent(dy: number): void { const c = document.getElementById("content"); if (c) c.scrollTop += dy; }

    // ---- ponteiro (analógico esq. via driver do X) + scroll (analóg. dir.) ----
    let px = window.innerWidth / 2, py = window.innerHeight / 2;
    let pointerVisible = false;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const HIDE_MS = 2800;
    const startT = Date.now(); let lpx = NaN, lpy = NaN;
    function setPointer(on: boolean): void { if (pointerVisible === on) return; pointerVisible = on; document.body.classList.toggle("pointer-on", on); }
    function showPointer(): void { setPointer(true); if (hideTimer) clearTimeout(hideTimer); hideTimer = setTimeout(() => setPointer(false), HIDE_MS); }
    function hidePointer(): void { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } setPointer(false); }
    function focusableUnder(x: number, y: number): HTMLElement | null {
      let el: HTMLElement | null = document.elementFromPoint(x, y) as HTMLElement | null;
      while (el && el !== document.body) { if (el.getAttribute && el.getAttribute("data-focus")) return el; el = el.parentElement; }
      return null;
    }
    function onMouseMove(e: MouseEvent): void {
      const nx = e.clientX, ny = e.clientY;
      if (isNaN(lpx) || Date.now() - startT < 1000) { lpx = nx; lpy = ny; px = nx; py = ny; return; }
      const moved = Math.abs(nx - lpx) + Math.abs(ny - lpy);
      lpx = nx; lpy = ny; px = nx; py = ny;
      if (moved < 2) return;
      showPointer();
      const f = focusableUnder(px, py);
      if (f && f !== document.activeElement) { try { f.focus(); } catch (e2) {} }
    }
    function clickAtPointer(): boolean { const el = focusableUnder(px, py); if (!el) return false; try { el.focus(); } catch (e) {} el.click(); return true; }
    function scrollTarget(): HTMLElement | null {
      let el: HTMLElement | null = (document.elementFromPoint(px, py) as HTMLElement | null) || activeEl();
      while (el && el !== document.body) {
        let cs: CSSStyleDeclaration | Record<string, string>;
        try { cs = getComputedStyle(el); } catch (e) { cs = {}; }
        if (el.scrollHeight > el.clientHeight && /(auto|scroll)/.test((cs as CSSStyleDeclaration).overflowY || "")) return el;
        el = el.parentElement;
      }
      return document.getElementById("content");
    }
    function doScroll(dy: number): void { const el = scrollTarget(); if (el) el.scrollTop += dy; }

    // ---- Gamepad API (R36S: odroidgo3-joypad) ----
    const GP_RAW: Record<string, number> = { B: 0, A: 1, X: 2, Y: 3, L1: 4, R1: 5, R2: 6, L2: 7, UP: 8, DOWN: 9, LEFT: 10, RIGHT: 11, SELECT: 12, START: 13, FN: 16 };
    const GP_STD: Record<string, number> = { A: 0, B: 1, X: 2, Y: 3, L1: 4, R1: 5, L2: 6, R2: 7, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
    const mapFor = (gp: Gamepad): Record<string, number> => (gp.mapping === "standard" ? GP_STD : GP_RAW);
    let prev: boolean[] = [], comboShot = false, raf = 0;
    function edge(gp: Gamepad, idx: number | undefined, fn: () => void): void {
      if (idx == null) return;
      const p = !!(gp.buttons[idx] && gp.buttons[idx].pressed);
      if (p && !prev[idx]) fn();
      prev[idx] = p;
    }
    const hasGamepad = typeof navigator.getGamepads === "function";
    function poll(): void {
      const pads = hasGamepad ? navigator.getGamepads() : [];
      const gp = pads && pads[0];
      if (gp) {
        const M = mapFor(gp);
        const l2 = !!(gp.buttons[M.L2] && gp.buttons[M.L2].pressed);
        const r2 = !!(gp.buttons[M.R2] && gp.buttons[M.R2].pressed);
        if (l2 && r2) { if (!comboShot) { comboShot = true; actions.screenshot(); } } else { comboShot = false; }
        edge(gp, M.L1, () => { if (!confirmOpen()) actions.subCycle(-1); });
        edge(gp, M.R1, () => { if (!confirmOpen()) actions.subCycle(1); });
        edge(gp, M.A, () => { if (confirmOpen()) actions.resolveConfirm(true); else if (pointerVisible) { if (!clickAtPointer()) activate(); } else activate(); });
        edge(gp, M.B, () => { if (confirmOpen()) actions.resolveConfirm(false); else if (fnOpen()) actions.closeFn(); else actions.back(); });
        edge(gp, M.START, () => { if (!confirmOpen()) activate(); });
        edge(gp, M.SELECT, () => { if (confirmOpen()) actions.resolveConfirm(false); else if (fnOpen()) actions.closeFn(); else actions.back(); });
        edge(gp, M.FN, () => { if (!confirmOpen()) actions.toggleFn(); });
        edge(gp, M.RIGHT, () => move("right"));
        edge(gp, M.LEFT, () => move("left"));
        edge(gp, M.DOWN, () => move("down"));
        edge(gp, M.UP, () => move("up"));
        const ax = gp.axes || [], DZ = 0.20, SS = 18;
        const ry = ax[3] || 0;
        if (Math.abs(ry) > DZ) doScroll(ry * SS);
      }
      raf = requestAnimationFrame(poll);
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("mousemove", onMouseMove);
    if (hasGamepad) raf = requestAnimationFrame(poll);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousemove", onMouseMove);
      if (raf) cancelAnimationFrame(raf);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);
}
