"use strict";
/*
 * kernel.js — informações DETALHADAS de kernel e Device Tree (DTB).
 * Tudo de /proc e /proc/device-tree (sem comandos). Cacheado 5s.
 */
const fs = require("fs");
const os = require("os");
const { rd, rdInt, dtClean, cached } = require("./util");

function sysctl(k) { return rd("/proc/sys/kernel/" + k).trim(); }

/* módulos carregados: nome, tamanho, refcount e quem usa. */
function modules() {
  return rd("/proc/modules").split("\n").filter(Boolean).map((l) => {
    const p = l.split(/\s+/); // name size refcount used_by state addr
    return {
      name: p[0],
      size_kb: p[1] ? Math.round(parseInt(p[1], 10) / 1024) : -1,
      used: parseInt(p[2], 10) || 0,
      by: (p[3] && p[3] !== "-") ? p[3].replace(/,$/, "") : "",
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

/* strings de "compatible" são separadas por NUL. */
function compatList(p) { return rd(p).split("\0").map((s) => s.trim()).filter(Boolean); }

/* Device Tree: modelo, compatibilidade, bootargs e nós de topo. */
function deviceTree() {
  const base = "/proc/device-tree";
  const present = fs.existsSync(base);
  const dt = {
    present,
    model: dtClean(rd(base + "/model")),
    compatible: compatList(base + "/compatible"),
    serial: dtClean(rd(base + "/serial-number")),
    bootargs: dtClean(rd(base + "/chosen/bootargs")),
    nodes: [],
  };
  if (present) {
    let names = [];
    try {
      names = fs.readdirSync(base).filter((n) => {
        try { return fs.statSync(base + "/" + n).isDirectory(); } catch (e) { return false; }
      });
    } catch (e) {}
    // p/ cada nó de topo, tenta a 1ª string de compatible (resumo do subsistema)
    dt.nodes = names.sort().map((n) => {
      const comp = compatList(base + "/" + n + "/compatible");
      return { name: n, compatible: comp[0] || "" };
    });
  }
  return dt;
}

function collectKernel() {
  const mods = modules();
  let config = "";
  if (fs.existsSync("/proc/config.gz")) config = "/proc/config.gz";
  else if (fs.existsSync("/boot/config-" + os.release())) config = "/boot/config-" + os.release();
  return {
    version: rd("/proc/version").trim(),
    ostype: sysctl("ostype"),
    osrelease: sysctl("osrelease") || os.release(),
    arch: os.arch(),
    hostname: sysctl("hostname") || os.hostname(),
    cmdline: rd("/proc/cmdline").trim(),
    tainted: rdInt("/proc/sys/kernel/tainted"),
    printk: sysctl("printk"),
    config_source: config,
    modules_total: mods.length,
    modules: mods,
    dtb: deviceTree(),
  };
}

function get() { return cached("kernel", 5000, collectKernel); }

module.exports = { get };
