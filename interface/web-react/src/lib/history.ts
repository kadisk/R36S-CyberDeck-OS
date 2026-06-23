// history.ts — buffers em anel p/ sparklines (CPU/RAM/TEMP/LOAD/BAT). Porta de js/history.js.
const CAP = 120;
const buffers: Record<string, number[]> = {};
export const history = {
  push(key: string, v: number): void {
    if (typeof v !== "number" || !isFinite(v)) return;
    const b = buffers[key] || (buffers[key] = []);
    b.push(v); if (b.length > CAP) b.shift();
  },
  get(key: string): number[] { return buffers[key] || []; },
};
