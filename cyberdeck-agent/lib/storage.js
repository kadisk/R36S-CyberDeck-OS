"use strict";
/*
 * storage.js — visão de armazenamento p/ a tela ARMAZENAMENTO e a expansão da rootfs.
 * Lê tamanhos de /sys + uso via df; identifica a rootfs (p2 do cartão de boot) e o
 * 2º cartão (o microSD que NÃO carrega a rootfs). Ações: expandir a rootfs
 * (growpart+resize2fs via cyberdeck-growfs.sh) e montar/desmontar o 2º cartão.
 */
const fs = require("fs");
const { run, out } = require("./exec");

function err(code, message) { const e = new Error(message); e.code = code; return e; }
function rd(p) { try { return fs.readFileSync(p, "utf8").trim(); } catch (e) { return ""; } }
function rdInt(p) { const v = parseInt(rd(p), 10); return isNaN(v) ? -1 : v; }

function rootDev() {
  const ln = rd("/proc/mounts").split("\n").find((l) => l.split(" ")[1] === "/");
  return ln ? ln.split(" ")[0] : "";
}
function diskOf(dev) {
  const base = dev.replace(/^\/dev\//, "");
  let m = base.match(/^(mmcblk\d+)p(\d+)$/);
  if (m) return { disk: "/dev/" + m[1], dbase: m[1], base, n: +m[2] };
  m = base.match(/^(.*?)(\d+)$/);
  if (m) return { disk: "/dev/" + m[1], dbase: m[1], base, n: +m[2] };
  return { disk: "/dev/" + base, dbase: base, base, n: 0 };
}
async function dfOf(mountp) {
  try {
    const r = await out("df", ["-B1", "--output=size,used,avail", mountp], { timeout: 4000 });
    const ln = r.trim().split("\n").pop().trim().split(/\s+/);
    return { size: +ln[0] || -1, used: +ln[1] || -1, avail: +ln[2] || -1 };
  } catch (e) { return { size: -1, used: -1, avail: -1 }; }
}
function mountInfo(mountp) {
  const ln = rd("/proc/mounts").split("\n").find((l) => l.split(" ")[1] === mountp);
  if (!ln) return null;
  const p = ln.split(" ");
  return { dev: p[0], mount: p[1], fstype: p[2] };
}

function secondCard(rootDisk) {
  let cards = [];
  try { cards = fs.readdirSync("/sys/class/block").filter((n) => /^mmcblk\d+$/.test(n)); } catch (e) {}
  const other = cards.map((n) => "/dev/" + n).filter((d) => d !== rootDisk);
  if (!other.length) return { present: false };
  const dev = other[0], dbase = dev.replace("/dev/", "");
  const sz = rdInt(`/sys/class/block/${dbase}/size`);
  const out0 = { present: true, dev, size_bytes: sz > 0 ? sz * 512 : -1, mounted: false };
  const mi = mountInfo("/media/sdcard");
  if (mi) { out0.mounted = true; out0.mount = mi.mount; out0.fstype = mi.fstype; }
  return out0;
}

async function summary() {
  const dev = rootDev();
  const { disk, dbase, base } = diskOf(dev);
  const df = await dfOf("/");
  const ds = rdInt(`/sys/class/block/${dbase}/size`);
  const ps = rdInt(`/sys/class/block/${base}/start`);
  const pl = rdInt(`/sys/class/block/${base}/size`);
  const disk_bytes = ds > 0 ? ds * 512 : -1;
  const expandable_bytes = (ds > 0 && ps >= 0 && pl > 0) ? (ds - (ps + pl)) * 512 : -1;
  const sec = secondCard(disk);
  if (sec.present && sec.mounted) Object.assign(sec, await dfOf("/media/sdcard"));
  return {
    rootfs: { dev, disk, size: df.size, used: df.used, avail: df.avail,
              usepct: df.size > 0 ? Math.round((100 * df.used) / df.size) : -1 },
    disk_bytes,
    expandable_bytes,
    expanded: fs.existsSync("/var/lib/cyberdeck/.fs-expanded"),
    second_card: sec,
  };
}

/* expande a rootfs (growpart + resize2fs) via o script idempotente. */
async function expand() {
  const r = await run("/usr/local/bin/cyberdeck-growfs.sh", ["--force"], { timeout: 90000 });
  const log = (r.stdout || r.stderr || "").trim().split("\n").slice(-8).join("\n");
  return { ok: r.ok, msg: r.ok ? "rootfs expandida (ver ARMAZENAMENTO)" : "falha ao expandir", log };
}

/* monta / desmonta o 2º cartão (allowlist: só /media/sdcard). */
async function mountCard() {
  const r = await run("/usr/local/bin/cyberdeck-mount-card.sh", [], { timeout: 10000 });
  return { ok: r.ok, msg: (r.stdout || r.stderr || "").trim().split("\n").pop() || "ok" };
}
async function unmountCard() {
  const r = await run("umount", ["-l", "/media/sdcard"], { timeout: 6000 });
  if (!r.ok && /not mounted|não montado/i.test(r.stderr || "")) return { ok: true, msg: "já desmontado" };
  return { ok: r.ok, msg: r.ok ? "2º cartão desmontado" : (r.stderr || "").trim() };
}

module.exports = { summary, expand, mountCard, unmountCard };
