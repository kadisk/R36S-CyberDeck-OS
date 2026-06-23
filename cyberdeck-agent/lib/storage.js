"use strict";
/*
 * storage.js — visão de armazenamento p/ a tela ARMAZENAMENTO.
 * Mostra o layout de partições do cartão de boot (lsblk), o uso da rootfs (df), o
 * espaço REALMENTE expansível (só se a rootfs for a ÚLTIMA partição) e o 2º cartão
 * (slot extra). Ações: expandir a rootfs (growpart+resize2fs) e montar/desmontar o
 * 2º cartão. Não-destrutivo (não formata/apaga partições).
 */
const fs = require("fs");
const { run, out } = require("./exec");

function rd(p) { try { return fs.readFileSync(p, "utf8").trim(); } catch (e) { return ""; } }
function rdInt(p) { const v = parseInt(rd(p), 10); return isNaN(v) ? -1 : v; }

function rootDev() {
  const ln = rd("/proc/mounts").split("\n").find((l) => l.split(" ")[1] === "/");
  return ln ? ln.split(" ")[0] : "";
}
function diskOf(dev) {
  const base = dev.replace(/^\/dev\//, "");
  let m = base.match(/^(mmcblk\d+)p(\d+)$/);
  if (m) return { disk: "/dev/" + m[1], dbase: m[1], base };
  m = base.match(/^(.*?)(\d+)$/);
  if (m) return { disk: "/dev/" + m[1], dbase: m[1], base };
  return { disk: "/dev/" + base, dbase: base, base };
}
async function dfOf(mountp) {
  try {
    const r = await out("df", ["-B1", "--output=size,used,avail", mountp], { timeout: 4000 });
    const ln = r.trim().split("\n").pop().trim().split(/\s+/);
    return { size: +ln[0] || -1, used: +ln[1] || -1, avail: +ln[2] || -1 };
  } catch (e) { return { size: -1, used: -1, avail: -1 }; }
}
function mountOf(mountp) {
  const ln = rd("/proc/mounts").split("\n").find((l) => l.split(" ")[1] === mountp);
  if (!ln) return null;
  const p = ln.split(" ");
  return { dev: p[0], mount: p[1], fstype: p[2] };
}

/* partições do disco via lsblk (fstype/label/mount); geometria via /sys. */
async function partsOf(disk, dbase) {
  let parts = [];
  try {
    const r = await out("lsblk", ["-b", "-J", "-o", "NAME,SIZE,FSTYPE,LABEL,MOUNTPOINT,TYPE", disk], { timeout: 4000 });
    const j = JSON.parse(r);
    const dev = (j.blockdevices || [])[0];
    for (const c of (dev && dev.children) || []) {
      if (c.type !== "part") continue;
      const name = c.name;
      parts.push({
        name, dev: "/dev/" + name, size: c.size || -1,
        fstype: c.fstype || "", label: c.label || "", mount: c.mountpoint || "",
        start: rdInt(`/sys/block/${dbase}/${name}/start`),
        sectors: rdInt(`/sys/block/${dbase}/${name}/size`),
      });
    }
  } catch (e) {}
  return parts;
}

async function summary() {
  const dev = rootDev();
  const { disk, dbase, base } = diskOf(dev);
  const df = await dfOf("/");
  const diskSectors = rdInt(`/sys/block/${dbase}/size`);
  const parts = await partsOf(disk, dbase);

  // a rootfs é a ÚLTIMA partição? só então dá p/ crescer p/ o fim do disco.
  const rootp = parts.find((p) => p.dev === dev) || { start: rdInt(`/sys/block/${dbase}/${base}/start`), sectors: rdInt(`/sys/block/${dbase}/${base}/size`) };
  const rootEnd = (rootp.start >= 0 && rootp.sectors > 0) ? rootp.start + rootp.sectors : -1;
  const maxEnd = parts.reduce((m, p) => Math.max(m, (p.start >= 0 && p.sectors > 0) ? p.start + p.sectors : 0), rootEnd);
  const isLast = rootEnd >= 0 && rootEnd >= maxEnd;
  const freeAfter = (isLast && diskSectors > 0 && rootEnd > 0) ? (diskSectors - rootEnd) : 0;
  const expandable_bytes = freeAfter > 0 ? freeAfter * 512 : 0;
  const blocked_by = isLast ? null : "outra partição após a rootfs";

  const sec = secondCard(disk);
  if (sec.present && sec.mounted) Object.assign(sec, await dfOf(sec.mount));

  return {
    rootfs: { dev, size: df.size, used: df.used, avail: df.avail,
              usepct: df.size > 0 ? Math.round((100 * df.used) / df.size) : -1 },
    disk: { dev: disk, size: diskSectors > 0 ? diskSectors * 512 : -1 },
    parts: parts.map((p) => ({ dev: p.dev, size: p.size, fstype: p.fstype, label: p.label, mount: p.mount,
                               role: p.dev === dev ? "rootfs" : (p.name.endsWith("p1") ? "boot" : "dados") })),
    rootfs_growable: expandable_bytes > 1048576,
    expandable_bytes, blocked_by,
    expanded: fs.existsSync("/var/lib/cyberdeck/.fs-expanded"),
    second_card: sec,
  };
}

function secondCard(rootDisk) {
  let cards = [];
  try { cards = fs.readdirSync("/sys/class/block").filter((n) => /^mmcblk\d+$/.test(n)); } catch (e) {}
  const other = cards.map((n) => "/dev/" + n).filter((d) => d !== rootDisk);
  if (!other.length) return { present: false };
  const dev = other[0], dbase = dev.replace("/dev/", "");
  const sz = rdInt(`/sys/class/block/${dbase}/size`);
  const o = { present: true, dev, size_bytes: sz > 0 ? sz * 512 : -1, mounted: false };
  const mi = mountOf("/media/sdcard");
  if (mi) { o.mounted = true; o.mount = mi.mount; o.fstype = mi.fstype; }
  return o;
}

async function expand() {
  const r = await run("/usr/local/bin/cyberdeck-growfs.sh", ["--force"], { timeout: 90000 });
  const log = (r.stdout || r.stderr || "").trim().split("\n").slice(-8).join("\n");
  return { ok: r.ok, msg: r.ok ? "rootfs expandida (ver ARMAZENAMENTO)" : "falha ao expandir", log };
}
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
