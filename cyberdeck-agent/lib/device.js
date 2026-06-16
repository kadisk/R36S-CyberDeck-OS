"use strict";
/*
 * device.js — inspeção completa do hardware/SO (DEVICE).
 * Prefere /proc e /sys; usa poucos comandos (lsusb) com fallback gracioso.
 * Resultado organizado em seções: identity, hardware, kernel, display, input.
 */
const fs = require("fs");
const os = require("os");
const { rd, rdInt, dtClean, firstLine, cached } = require("./util");
const { out } = require("./exec");

function osRelease() {
  const o = {};
  for (const line of rd("/etc/os-release").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/i);
    if (m) o[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return o;
}

function cpuModel() {
  const ci = rd("/proc/cpuinfo");
  const m = ci.match(/model name\s*:\s*(.+)/i) || ci.match(/Hardware\s*:\s*(.+)/i) || ci.match(/Processor\s*:\s*(.+)/i);
  if (m) return m[1].trim();
  const c = os.cpus();
  return c[0] ? c[0].model : "?";
}

/** Frequência por core (cur/min/max em MHz) lendo cpufreq. */
function perCpuFreq() {
  const out = [];
  let i = 0;
  while (fs.existsSync(`/sys/devices/system/cpu/cpu${i}`)) {
    const base = `/sys/devices/system/cpu/cpu${i}/cpufreq`;
    const cur = rdInt(`${base}/scaling_cur_freq`);
    const min = rdInt(`${base}/scaling_min_freq`);
    const max = rdInt(`${base}/scaling_max_freq`);
    const gov = rd(`${base}/scaling_governor`).trim();
    out.push({
      cpu: i,
      cur_mhz: cur > 0 ? Math.round(cur / 1000) : -1,
      min_mhz: min > 0 ? Math.round(min / 1000) : -1,
      max_mhz: max > 0 ? Math.round(max / 1000) : -1,
      governor: gov || "",
    });
    i++;
  }
  return out;
}

/** Todas as thermal_zone com tipo e temperatura. */
function thermals() {
  const out = [];
  let i = 0;
  while (fs.existsSync(`/sys/class/thermal/thermal_zone${i}`)) {
    const t = rdInt(`/sys/class/thermal/thermal_zone${i}/temp`);
    out.push({ zone: i, type: rd(`/sys/class/thermal/thermal_zone${i}/type`).trim(), temp_c: t > 0 ? +(t / 1000).toFixed(1) : -1 });
    i++;
  }
  return out;
}

function meminfo() {
  const mi = {};
  for (const line of rd("/proc/meminfo").split("\n")) {
    const m = line.match(/^(\w+):\s+(\d+)/);
    if (m) mi[m[1]] = parseInt(m[2], 10); // kB
  }
  const kb = (k) => (mi[k] != null ? Math.round(mi[k] / 1024) : -1); // -> MB
  return {
    total_mb: kb("MemTotal"),
    free_mb: kb("MemFree"),
    available_mb: kb("MemAvailable"),
    buffers_mb: kb("Buffers"),
    cached_mb: kb("Cached"),
    swap_total_mb: kb("SwapTotal"),
    swap_free_mb: kb("SwapFree"),
  };
}

function zram() {
  const out = [];
  try {
    for (const n of fs.readdirSync("/sys/block")) {
      if (!/^zram/.test(n)) continue;
      const sz = rdInt(`/sys/block/${n}/disksize`);
      out.push({ dev: n, mb: sz > 0 ? Math.round(sz / 1048576) : -1, comp: rd(`/sys/block/${n}/comp_algorithm`).trim() });
    }
  } catch (e) {}
  return out;
}

function storage() {
  const out = [];
  try {
    for (const b of fs.readdirSync("/sys/block")) {
      if (!/^(mmcblk|sd|nvme)/.test(b)) continue;
      const sect = rdInt(`/sys/block/${b}/size`);
      out.push({
        dev: b,
        gb: sect > 0 ? +((sect * 512) / 1e9).toFixed(1) : -1,
        ro: rdInt(`/sys/block/${b}/ro`) === 1,
        model: rd(`/sys/block/${b}/device/model`).trim() || rd(`/sys/block/${b}/device/name`).trim(),
      });
    }
  } catch (e) {}
  return out;
}

function mounts() {
  const out = [];
  for (const line of rd("/proc/mounts").split("\n")) {
    const p = line.split(/\s+/);
    if (p.length < 4) continue;
    if (/^(cgroup|cgroup2|sysfs|proc|devpts|mqueue|debugfs|tracefs|securityfs|pstore|bpf|configfs)$/.test(p[2])) continue;
    out.push({ src: p[0], target: p[1], fstype: p[2], opts: (p[3] || "").split(",").slice(0, 4).join(",") });
  }
  return out.slice(0, 60);
}

function framebuffer() {
  const fb = {};
  fb.dev = fs.existsSync("/dev/fb0") ? "/dev/fb0" : "";
  fb.virtual_size = rd("/sys/class/graphics/fb0/virtual_size").trim();
  fb.bits_per_pixel = rdInt("/sys/class/graphics/fb0/bits_per_pixel");
  fb.name = rd("/sys/class/graphics/fb0/name").trim();
  return fb;
}

function backlightInfo() {
  try {
    const d = fs.readdirSync("/sys/class/backlight");
    if (!d.length) return { name: "", cur: -1, max: -1, pct: -1 };
    const dir = `/sys/class/backlight/${d[0]}`;
    const cur = rdInt(`${dir}/brightness`), max = rdInt(`${dir}/max_brightness`);
    return { name: d[0], cur, max, pct: max > 0 ? Math.round((100 * cur) / max) : -1 };
  } catch (e) { return { name: "", cur: -1, max: -1, pct: -1 }; }
}

/** Dispositivos de input via /proc/bus/input/devices. */
function inputDevices() {
  const txt = rd("/proc/bus/input/devices");
  const blocks = txt.split(/\n\s*\n/);
  const out = [];
  for (const b of blocks) {
    const name = (b.match(/N: Name="([^"]*)"/) || [])[1];
    if (!name) continue;
    const handlers = (b.match(/H: Handlers=(.+)/) || [])[1] || "";
    const ev = (handlers.match(/event\d+/) || [])[0] || "";
    out.push({
      name,
      event: ev ? `/dev/input/${ev}` : "",
      handlers: handlers.trim(),
      joypad: /joypad|gamepad|odroidgo/i.test(name),
    });
  }
  return out;
}

async function usbDevices() {
  const r = await out("lsusb", [], { timeout: 3000 });
  if (!r) return [];
  return r.split("\n").map(l => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/Bus (\d+) Device (\d+): ID ([0-9a-f:]+)\s*(.*)/i);
    return m ? { bus: m[1], dev: m[2], id: m[3], name: m[4] || "" } : { raw: l };
  });
}

function modulesLoaded() {
  return rd("/proc/modules").split("\n").map(l => l.split(/\s+/)[0]).filter(Boolean);
}

/** Coleta tudo. Cacheado 8s (a maior parte é estática). */
async function collect() {
  const orel = osRelease();
  const freq = perCpuFreq();
  const mem = meminfo();
  const tz = rd("/etc/timezone").trim();
  const dmesgHw = await out("sh", ["-c", "dmesg 2>/dev/null | grep -iE 'rk3326|mali|panel|dsi|rk817|backlight|joypad|gpu' | tail -n 30"], { timeout: 3000 });

  return {
    identity: {
      hostname: os.hostname(),
      distro: orel.PRETTY_NAME || "R36S CyberDeck OS",
      os_id: orel.ID || "",
      os_version: orel.VERSION || orel.VERSION_ID || "",
      kernel: os.release(),
      arch: os.arch(),
      cmdline: rd("/proc/cmdline").trim(),
      uptime_s: Math.floor(os.uptime()),
      timezone: tz,
      datetime: new Date().toISOString(),
      user: (() => { try { return os.userInfo().username; } catch (e) { return String(process.getuid && process.getuid()); } })(),
      rootfs: (mounts().find(m => m.target === "/") || {}).src || "",
    },
    hardware: {
      model: dtClean(rd("/proc/device-tree/model")) || "R36S",
      compatible: dtClean(rd("/proc/device-tree/compatible")),
      soc: "Rockchip RK3326",
      cpu_model: cpuModel(),
      cores: os.cpus().length,
      freq,
      thermals: thermals(),
      mem,
      zram: zram(),
      gpu: "ARM Mali-G31 (Bifrost)",
      pmic: "RK817 (PMIC + áudio + bateria)",
      storage: storage(),
      mounts: mounts(),
    },
    kernel: {
      version: rd("/proc/version").trim(),
      cmdline: rd("/proc/cmdline").trim(),
      dtb_model: dtClean(rd("/proc/device-tree/model")),
      modules_count: modulesLoaded().length,
      modules: modulesLoaded().slice(0, 80),
      dmesg_hw: dmesgHw.trim(),
    },
    display: {
      framebuffer: framebuffer(),
      backlight: backlightInfo(),
      panel: "elida,kd35t133 — 640x480 MIPI-DSI",
    },
    input: {
      devices: inputDevices(),
      usb: await usbDevices(),
    },
  };
}

function get() { return cached("device", 8000, collect); }

module.exports = { get, osRelease };
