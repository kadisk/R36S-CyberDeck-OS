/* views.js — todas as telas da CyberDeck UI.
 * Cada view: { id, build()->el, show(), refresh()?, onStatus(d)?, back()->bool, live }
 * Padrão master/detail dentro da própria view; back() trata o nível interno. */
(function () {
  "use strict";
  var h = CD.ui.h, UI = CD.ui, api = CD.api, S = CD.state;

  /* metadados/ordem das seções, agrupadas por SEMÂNTICA (informação x função):
   *   MONITOR     = informação ao vivo       SISTEMA = inspeção do SO
   *   AÇÕES       = executar/alterar          DIAGNÓSTICO = depuração
   * A ordem aqui dita tanto a barra de abas (tab=true) quanto os cards da HOME. */
  var META = [
    { id: "welcome", title: "HOME",    icon: "⌂", desc: "Painel inicial",          group: "",            tab: true },
    { id: "status",  title: "STATUS",  icon: "%", desc: "CPU, RAM, temp, energia",  group: "MONITOR",     tab: true },
    { id: "procs",   title: "PROCS",   icon: "=", desc: "Processos em tempo real",  group: "MONITOR",     tab: true },
    { id: "network", title: "NET",     icon: "~", desc: "Rede e conexões",          group: "MONITOR",     tab: true },
    { id: "logs",    title: "LOGS",    icon: "!", desc: "dmesg / journal",          group: "MONITOR",     tab: true },
    { id: "device",  title: "DEVICE",  icon: "#", desc: "Hardware e SO",            group: "SISTEMA",     tab: true },
    { id: "kernel",  title: "KERNEL",  icon: "K", desc: "Kernel & Device Tree",     group: "SISTEMA",     tab: false },
    { id: "fs",      title: "FS",      icon: "/", desc: "Navegar o rootfs",         group: "SISTEMA",     tab: true },
    { id: "systemd", title: "SVC",     icon: "*", desc: "Serviços systemd",         group: "SISTEMA",     tab: true },
    { id: "cmd",     title: "CMD",     icon: ">", desc: "Comandos prontos",         group: "AÇÕES",       tab: true },
    { id: "tools",   title: "TOOLS",   icon: "+", desc: "Ações e display",          group: "AÇÕES",       tab: true },
    { id: "keys",    title: "KEYS",    icon: "@", desc: "Teste de gamepad",         group: "DIAGNÓSTICO", tab: false },
  ];
  CD.META = META;
  var GROUPS = ["MONITOR", "SISTEMA", "AÇÕES", "DIAGNÓSTICO"];

  var V = {};
  function reg(impl) { V[impl.id] = impl; }
  function title(t) { return h("div", { cls: "vtitle", text: t }); }
  function refocus(el) { if (CD.focusFirst) CD.focusFirst(el); }

  /* row helper: cols = array de {t, cls, grow} */
  function row(cols, onClick, focus) {
    var attrs = { cls: "row" };
    if (focus) { attrs.focus = true; }
    if (onClick) attrs.on = { click: onClick };
    return h("div", attrs, cols.map(function (c) {
      return h("span", { cls: (c.grow ? "grow " : "c ") + (c.cls || "") }, String(c.t == null ? "" : c.t));
    }));
  }

  /* render genérico async: mostra loading, chama loader(), passa data p/ render() */
  function asyncRender(host, loader, render) {
    UI.clear(host); host.appendChild(UI.loading());
    return loader().then(function (d) { UI.clear(host); render(d); refocus(host); })
      .catch(function (e) { UI.clear(host); host.appendChild(UI.errBox(e)); });
  }

  /* ============================ WELCOME ============================ */
  reg({
    id: "welcome", live: false,
    build: function () {
      var el = h("div", { cls: "view", id: "view-welcome" });
      el.appendChild(h("div", { cls: "welcome-head" }, [
        h("div", { cls: "big", text: "R36S CYBERDECK" }),
        h("div", { cls: "sm", id: "wel-sub", text: "painel técnico portátil" }),
      ]));
      // cards agrupados por categoria semântica (cada grupo com seu cabeçalho)
      GROUPS.forEach(function (g) {
        var items = META.filter(function (m) { return m.group === g; });
        if (!items.length) return;
        el.appendChild(h("div", { cls: "sub", text: g }));
        var cards = h("div", { cls: "cards" });
        items.forEach(function (m) {
          cards.appendChild(h("div", { cls: "card", focus: true, on: { click: function () { CD.go(m.id); } } }, [
            h("span", { cls: "ic", text: m.icon }),
            h("span", { cls: "ti", text: m.title }),
            h("span", { cls: "de", text: m.desc }),
          ]));
        });
        el.appendChild(cards);
      });
      this.el = el; return el;
    },
    show: function () { refocus(this.el); },
    onStatus: function (d) {
      var sub = document.getElementById("wel-sub");
      if (sub && d) sub.textContent = (d.host || "") + " · up " + UI.fmt.uptime(d.uptime) + " · " + (d.cores || "?") + " cores";
    },
    back: function () { return false; },
  });

  /* ============================ STATUS ============================ */
  reg({
    id: "status", live: false,
    build: function () {
      var el = h("div", { cls: "view", id: "view-status" });
      el.appendChild(title("STATUS DO SISTEMA"));
      this.body = h("div"); el.appendChild(this.body);
      this.el = el; return el;
    },
    show: function () { if (CD.lastStatus) this.onStatus(CD.lastStatus); else this.body.appendChild(UI.loading()); },
    onStatus: function (d) {
      if (!d) return;
      var b = UI.clear(this.body);
      b.appendChild(UI.gauge("CPU", d.cpu >= 0 ? d.cpu : 0));
      if (d.mem) b.appendChild(UI.gauge("RAM", d.mem.pct));
      if (d.brightness && d.brightness.pct >= 0) b.appendChild(UI.gauge("LUZ", d.brightness.pct));
      b.appendChild(UI.kv("MEM", d.mem ? (d.mem.used + " / " + d.mem.total + " MB") : "—"));
      b.appendChild(UI.kv("LOAD", d.load));
      b.appendChild(UI.kv("UPTIME", UI.fmt.uptime(d.uptime)));
      b.appendChild(UI.kv("TEMP", d.temp >= 0 ? d.temp + " °C" : "—"));
      var bt = d.battery || {};
      var lowTrust = bt.capacity_trust === "low";
      b.appendChild(UI.kv("BATERIA", (bt.pct >= 0 ? bt.pct + "%" : "—") + (bt.status ? " " + bt.status : "") + (bt.ac === 1 ? " [AC]" : "") + (lowTrust ? "  (instável)" : "")));
      b.appendChild(UI.kv("ESTIMADO ~", (bt.est >= 0 ? bt.est + "%" : "—") + (bt.ocv > 0 ? " · OCV " + bt.ocv + " V" : "")));
      b.appendChild(UI.kv("TENSÃO/CORR.", (bt.volt > 0 ? bt.volt + " V" : "—") + (bt.curr !== -1 && bt.curr != null ? " · " + bt.curr + " mA" : "")));
      var n = (d.net && d.net[0]) || {};
      b.appendChild(UI.kv("REDE", n.iface ? (n.iface + " " + n.ip) : "(sem rede)"));
    },
    back: function () { return false; },
  });

  /* ============================ DEVICE ============================ */
  function kvGroup(host, name, pairs) {
    host.appendChild(h("div", { cls: "sub", text: name }));
    pairs.forEach(function (p) { if (p) host.appendChild(UI.kv(p[0], p[1])); });
  }
  reg({
    id: "device", live: false,
    build: function () { var el = h("div", { cls: "view", id: "view-device" }); el.appendChild(title("DISPOSITIVO & SISTEMA")); this.body = h("div"); el.appendChild(this.body); this.el = el; return el; },
    show: function () {
      var self = this;
      asyncRender(this.body, function () { return api.get("/api/device", { timeout: 12000 }); }, function (d) {
        var b = self.body, id = d.identity || {}, hw = d.hardware || {}, k = d.kernel || {}, dp = d.display || {}, ip = d.input || {};
        kvGroup(b, "IDENTIDADE", [["HOST", id.hostname], ["DISTRO", id.distro], ["KERNEL", id.kernel], ["ARCH", id.arch],
          ["UPTIME", UI.fmt.uptime(id.uptime_s)], ["TZ", id.timezone], ["USER", id.user], ["ROOTFS", id.rootfs]]);
        kvGroup(b, "HARDWARE", [["MODELO", hw.model], ["SoC", hw.soc], ["CPU", hw.cpu_model], ["CORES", hw.cores],
          ["GPU", hw.gpu], ["PMIC", hw.pmic],
          ["RAM", hw.mem ? (hw.mem.total_mb + " MB (livre " + hw.mem.available_mb + ")") : "—"],
          ["SWAP/ZRAM", hw.mem && hw.mem.swap_total_mb > 0 ? hw.mem.swap_total_mb + " MB" : (hw.zram && hw.zram.length ? hw.zram[0].mb + " MB zram" : "—")]]);
        (hw.freq || []).forEach(function (f) { b.appendChild(UI.kv("CPU" + f.cpu, (f.cur_mhz > 0 ? f.cur_mhz : "?") + " MHz (" + f.min_mhz + "–" + f.max_mhz + ") " + f.governor)); });
        (hw.thermals || []).forEach(function (t) { b.appendChild(UI.kv("TEMP " + t.type, t.temp_c >= 0 ? t.temp_c + " °C" : "—")); });
        kvGroup(b, "ARMAZENAMENTO", (hw.storage || []).map(function (s) { return [s.dev, s.gb + " GB" + (s.ro ? " (ro)" : "") + (s.model ? " · " + s.model : "")]; }));
        kvGroup(b, "TELA", [["FB", dp.framebuffer ? (dp.framebuffer.name + " " + dp.framebuffer.virtual_size + " @" + dp.framebuffer.bits_per_pixel + "bpp") : "—"],
          ["BACKLIGHT", dp.backlight ? (dp.backlight.cur + "/" + dp.backlight.max + " (" + dp.backlight.pct + "%)") : "—"], ["PANEL", dp.panel]]);
        kvGroup(b, "KERNEL/BOOT", [["VERSION", k.version], ["MÓDULOS", k.modules_count], ["CMDLINE", k.cmdline]]);
        if (k.dmesg_hw) { b.appendChild(h("div", { cls: "sub", text: "DMESG (hw)" })); b.appendChild(h("pre", { cls: "box", text: k.dmesg_hw })); }
        b.appendChild(h("div", { cls: "sub", text: "INPUT" }));
        (ip.devices || []).forEach(function (dv) { b.appendChild(UI.kv((dv.joypad ? "* " : "") + (dv.event || "?"), dv.name)); });
        b.appendChild(h("div", { cls: "sub", text: "USB" }));
        (ip.usb || []).forEach(function (u) { b.appendChild(UI.kv(u.id || "?", u.name || u.raw || "")); });
      });
    },
    back: function () { return false; },
  });

  /* ============================ FS ============================ */
  reg({
    id: "fs", live: false,
    build: function () { var el = h("div", { cls: "view", id: "view-fs" }); this.el = el; return el; },
    show: function () { this.render(); },
    render: function () {
      var self = this, el = UI.clear(this.el);
      if (S.fs.mode === "view") return this.renderFile();
      el.appendChild(title("FS  " + S.fs.path));
      // atalhos
      var tb = h("div", { cls: "toolbar" });
      api.get("/api/fs/bookmarks").then(function (d) {
        (d.bookmarks || []).forEach(function (p) {
          tb.appendChild(h("button", { cls: "chip", focus: true, text: p, on: { click: function () { self.nav(p); } } }));
        });
      }).catch(function () {});
      el.appendChild(tb);
      var listHost = h("div"); el.appendChild(listHost);
      asyncRender(listHost, function () { return api.get("/api/fs/list?path=" + encodeURIComponent(S.fs.path)); }, function (d) {
        var list = h("div", { cls: "list" });
        if (d.parent != null) list.appendChild(row([{ t: "[..]", grow: true }], function () { self.nav(d.parent); }, true));
        (d.entries || []).forEach(function (e) {
          var tag = e.type === "dir" ? "/" : e.type === "symlink" ? "→" : e.type === "file" ? " " : "•";
          var sz = e.type === "file" ? UI.fmt.bytes(e.size) : (e.type === "symlink" ? "→" + (e.target || "") : e.type);
          list.appendChild(row([
            { t: tag + e.name, grow: true },
            { t: e.mode, cls: "r" }, { t: sz, cls: "r" },
          ], function () { self.open(e); }, true));
        });
        if (d.truncated) list.appendChild(h("div", { cls: "hint", text: "… lista truncada (" + d.count + " itens)" }));
        listHost.appendChild(list);
        refocus(self.el);
      });
    },
    renderFile: function () {
      var self = this, el = UI.clear(this.el);
      el.appendChild(title("FILE  " + S.fs.path));
      var host = h("div"); el.appendChild(host);
      asyncRender(host, function () { return api.get("/api/fs/read?path=" + encodeURIComponent(S.fs.path)); }, function (d) {
        if (d.type === "text") {
          if (d.truncated) host.appendChild(h("div", { cls: "hint", text: "arquivo truncado em " + UI.fmt.bytes(d.bytes) }));
          host.appendChild(h("pre", { cls: "box full", focus: true, text: d.content || "(vazio)" }));
        } else {
          host.appendChild(UI.empty(d.message || "não é texto"));
        }
        refocus(self.el);
      });
    },
    nav: function (p) { S.fs.path = p; S.fs.mode = "list"; this.render(); },
    open: function (e) {
      var full = (S.fs.path === "/" ? "" : S.fs.path) + "/" + e.name;
      if (e.type === "dir" || e.type === "symlink") this.nav(full);
      else if (e.type === "file") { S.fs.path = full; S.fs.mode = "view"; this.render(); }
      else UI.toast("arquivo especial: " + e.type, true);
    },
    back: function () {
      if (S.fs.mode === "view") { S.fs.mode = "list"; S.fs.path = S.fs.path.replace(/\/[^/]*$/, "") || "/"; this.render(); return true; }
      if (S.fs.path !== "/") { this.nav(S.fs.path.replace(/\/[^/]*$/, "") || "/"); return true; }
      return false;
    },
  });

  /* ============================ SYSTEMD ============================ */
  var SD_FILTERS = ["all", "running", "failed", "cyberdeck"];
  reg({
    id: "systemd", live: false,
    build: function () { var el = h("div", { cls: "view", id: "view-systemd" }); this.el = el; return el; },
    show: function () { this.render(); },
    refresh: function () { if (S.systemd.mode === "list") this.render(); },
    render: function () {
      if (S.systemd.mode === "detail") return this.renderDetail();
      var self = this, el = UI.clear(this.el);
      el.appendChild(title("SERVIÇOS (systemd)"));
      var sumHost = h("div"); el.appendChild(sumHost);
      api.get("/api/systemd/summary").then(function (s) {
        UI.clear(sumHost);
        var badge = s.state === "running" ? "ok" : s.state === "degraded" ? "warn" : "off";
        var k = UI.kv("ESTADO", ""); k.lastChild.appendChild(UI.badge(s.state, badge)); sumHost.appendChild(k);
        sumHost.appendChild(UI.kv("UNITS", s.units_total + " · " + s.running + " run · " + s.failed + " falhos"));
        sumHost.appendChild(UI.kv("TARGET", s.default_target));
        sumHost.appendChild(UI.kv("BOOT", s.boot));
      }).catch(function () {});
      var tb = h("div", { cls: "toolbar" });
      SD_FILTERS.forEach(function (f) {
        tb.appendChild(h("button", { cls: "chip" + (S.systemd.filter === f ? " on" : ""), focus: true, text: f,
          on: { click: function () { S.systemd.filter = f; self.render(); } } }));
      });
      el.appendChild(tb);
      var listHost = h("div"); el.appendChild(listHost);
      asyncRender(listHost, function () { return api.get("/api/systemd/services"); }, function (d) {
        var list = h("div", { cls: "list" });
        var f = S.systemd.filter;
        (d.services || []).filter(function (s) {
          if (f === "running") return s.sub === "running";
          if (f === "failed") return s.active === "failed" || s.sub === "failed";
          if (f === "cyberdeck") return /cyberdeck/.test(s.unit);
          return true;
        }).forEach(function (s) {
          var stcls = s.sub === "running" ? "st-run" : (s.active === "failed" || s.sub === "failed") ? "st-crit" : "st-dim";
          list.appendChild(row([
            { t: s.unit.replace(/\.service$/, ""), grow: true },
            { t: s.sub, cls: "r " + stcls },
          ], function () { S.systemd.unit = s.unit; S.systemd.mode = "detail"; self.render(); }, true));
        });
        listHost.appendChild(list);
        refocus(self.el);
      });
    },
    renderDetail: function () {
      var self = this, unit = S.systemd.unit, el = UI.clear(this.el);
      el.appendChild(title("SVC  " + unit));
      var host = h("div"); el.appendChild(host);
      asyncRender(host, function () { return api.get("/api/systemd/service?unit=" + encodeURIComponent(unit)); }, function (d) {
        var kind = d.sub === "running" ? "run" : d.active === "failed" ? "crit" : "off";
        var k = UI.kv("ESTADO", ""); k.lastChild.appendChild(UI.badge(d.active + "/" + d.sub, kind)); host.appendChild(k);
        host.appendChild(UI.kv("ENABLED", d.enabled));
        host.appendChild(UI.kv("PID", d.main_pid || "—"));
        host.appendChild(UI.kv("MEM", d.memory_mb >= 0 ? d.memory_mb + " MB" : "—"));
        host.appendChild(UI.kv("DESDE", d.started));
        host.appendChild(UI.kv("DESC", d.description));
        // ações
        var bar = h("div", { cls: "toolbar" });
        [["restart", "RESTART"], ["stop", "STOP"], ["start", "START"]].forEach(function (a) {
          bar.appendChild(h("button", { cls: "chip", focus: true, text: a[1], on: { click: function () { self.doAction(a[0], unit); } } }));
        });
        bar.appendChild(h("button", { cls: "chip", focus: true, text: "LOGS", on: { click: function () { self.showLogs(unit, host); } } }));
        host.appendChild(bar);
        host.appendChild(h("div", { cls: "sub", text: "STATUS" }));
        host.appendChild(h("pre", { cls: "box", text: d.status_text || "—" }));
        self.logHost = h("div"); host.appendChild(self.logHost);
        refocus(self.el);
      });
    },
    showLogs: function (unit, host) {
      var lh = this.logHost; if (!lh) return;
      UI.clear(lh); lh.appendChild(h("div", { cls: "sub", text: "JOURNAL" })); lh.appendChild(UI.loading());
      api.get("/api/systemd/logs?unit=" + encodeURIComponent(unit) + "&lines=120").then(function (d) {
        UI.clear(lh); lh.appendChild(h("div", { cls: "sub", text: "JOURNAL" }));
        lh.appendChild(h("pre", { cls: "box", text: d.lines }));
      }).catch(function (e) { UI.clear(lh); lh.appendChild(UI.errBox(e)); });
    },
    doAction: function (act, unit) {
      var self = this;
      UI.confirm(act.toUpperCase() + "\n" + unit).then(function (ok) {
        if (!ok) return;
        api.post("/api/systemd/action", { action: act, unit: unit }).then(function (r) {
          UI.toast(r.ok ? (act + " ok") : ("falhou: " + r.output), !r.ok); self.render();
        }).catch(function (e) { UI.toast(e.message, true); });
      });
    },
    back: function () { if (S.systemd.mode === "detail") { S.systemd.mode = "list"; this.render(); return true; } return false; },
  });

  /* ============================ PROCS ============================ */
  var PROC_SORTS = ["cpu", "mem", "pid", "name"];
  var PROC_FILTERS = ["all", "node", "chromium", "cyberdeck", "running", "zombie"];
  reg({
    id: "procs", live: true,
    build: function () { var el = h("div", { cls: "view", id: "view-procs" }); this.el = el; return el; },
    show: function () { this.render(); },
    refresh: function () { if (S.procs.mode === "list") this.renderList(true); },
    render: function () { if (S.procs.mode === "detail") return this.renderDetail(); this.render0(); },
    render0: function () {
      var self = this, el = UI.clear(this.el);
      el.appendChild(title("PROCESSOS"));
      this.sumHost = h("div"); el.appendChild(this.sumHost);
      var tb = h("div", { cls: "toolbar" });
      PROC_SORTS.forEach(function (s) { tb.appendChild(h("button", { cls: "chip" + (S.procs.sort === s ? " on" : ""), focus: true, text: "↓" + s, on: { click: function () { S.procs.sort = s; self.renderList(); } } })); });
      el.appendChild(tb);
      var tb2 = h("div", { cls: "toolbar" });
      PROC_FILTERS.forEach(function (f) { tb2.appendChild(h("button", { cls: "chip" + (S.procs.filter === f ? " on" : ""), focus: true, text: f, on: { click: function () { S.procs.filter = f; self.renderList(); } } })); });
      el.appendChild(tb2);
      this.listHost = h("div"); el.appendChild(this.listHost);
      this.renderList();
    },
    renderList: function (silent) {
      var self = this;
      if (!self.listHost) return;
      if (!silent) { UI.clear(self.listHost); self.listHost.appendChild(UI.loading()); }
      api.get("/api/processes").then(function (d) {
        // resumo
        if (self.sumHost) { var s = d.summary || {}; UI.clear(self.sumHost);
          self.sumHost.appendChild(UI.kv("TOTAL", s.total + " · run " + s.running + " · sleep " + s.sleeping + " · zumbi " + s.zombie));
          self.sumHost.appendChild(UI.kv("CPU/MEM", "~" + (s.cpu_total || 0) + "% · " + (s.mem_total_pct || 0) + "%"));
          if (s.top_cpu) self.sumHost.appendChild(UI.kv("TOP CPU", s.top_cpu.comm + " (" + s.top_cpu.cpu + "%)"));
        }
        var f = S.procs.filter, rows = (d.processes || []).filter(function (p) {
          if (f === "node") return /node/i.test(p.comm);
          if (f === "chromium") return /chrom/i.test(p.comm);
          if (f === "cyberdeck") return /cyberdeck/i.test(p.cmd);
          if (f === "running") return p.state === "R";
          if (f === "zombie") return p.state === "Z";
          return true;
        });
        var so = S.procs.sort;
        rows.sort(function (a, b) {
          if (so === "mem") return b.rss_mb - a.rss_mb;
          if (so === "pid") return a.pid - b.pid;
          if (so === "name") return a.comm.localeCompare(b.comm);
          return b.cpu - a.cpu;
        });
        var list = h("div", { cls: "list" });
        list.appendChild(h("div", { cls: "row list-head" }, [
          h("span", { cls: "c", html: "PID" }), h("span", { cls: "grow", text: "CMD" }),
          h("span", { cls: "c r", text: "CPU" }), h("span", { cls: "c r", text: "RSS" }),
        ]));
        rows.slice(0, 200).forEach(function (p) {
          list.appendChild(row([
            { t: p.pid, cls: "" }, { t: p.comm, grow: true },
            { t: p.cpu + "%", cls: "r" }, { t: p.rss_mb + "M", cls: "r" },
          ], function () { S.procs.pid = p.pid; S.procs.mode = "detail"; self.render(); }, true));
        });
        UI.clear(self.listHost); self.listHost.appendChild(list);
        if (!silent) refocus(self.el);
      }).catch(function (e) { UI.clear(self.listHost); self.listHost.appendChild(UI.errBox(e)); });
    },
    renderDetail: function () {
      var self = this, pid = S.procs.pid, el = UI.clear(this.el);
      el.appendChild(title("PID " + pid));
      var host = h("div"); el.appendChild(host);
      asyncRender(host, function () { return api.get("/api/processes/" + pid); }, function (d) {
        host.appendChild(UI.kv("COMM", d.comm));
        host.appendChild(UI.kv("ESTADO", UI.fmt.pstate(d.state)));
        host.appendChild(UI.kv("USER", d.user));
        host.appendChild(UI.kv("PPID", d.ppid));
        host.appendChild(UI.kv("THREADS", d.threads));
        host.appendChild(UI.kv("FD", d.fd_count));
        host.appendChild(UI.kv("RSS", d.vm_rss));
        host.appendChild(UI.kv("EXE", d.exe));
        host.appendChild(UI.kv("CWD", d.cwd));
        host.appendChild(h("div", { cls: "sub", text: "CMDLINE" }));
        host.appendChild(h("pre", { cls: "box", text: d.cmdline }));
        var bar = h("div", { cls: "toolbar" });
        bar.appendChild(h("button", { cls: "chip", focus: true, text: "SIGTERM", on: { click: function () { self.kill(pid, "SIGTERM"); } } }));
        bar.appendChild(h("button", { cls: "chip", focus: true, text: "SIGKILL", on: { click: function () { self.kill(pid, "SIGKILL"); } } }));
        host.appendChild(bar);
        if (d.children && d.children.length) { host.appendChild(h("div", { cls: "sub", text: "FILHOS" }));
          d.children.forEach(function (c) { host.appendChild(UI.kv(c.pid, c.comm)); }); }
        host.appendChild(h("div", { cls: "sub", text: "STATUS" }));
        host.appendChild(h("pre", { cls: "box", text: d.status }));
        refocus(self.el);
      });
    },
    kill: function (pid, sig) {
      var self = this;
      UI.confirm("ENVIAR " + sig + "\nPID " + pid).then(function (ok) {
        if (!ok) return;
        api.post("/api/processes/" + pid + "/signal", { signal: sig }).then(function () {
          UI.toast(sig + " enviado p/ " + pid); S.procs.mode = "list"; self.render();
        }).catch(function (e) { UI.toast(e.message, true); });
      });
    },
    back: function () { if (S.procs.mode === "detail") { S.procs.mode = "list"; this.render(); return true; } return false; },
  });

  /* ============================ NETWORK ============================ */
  reg({
    id: "network", live: false,
    build: function () { var el = h("div", { cls: "view", id: "view-network" }); el.appendChild(title("REDE")); this.body = h("div"); el.appendChild(this.body); this.el = el; return el; },
    show: function () {
      var self = this;
      asyncRender(this.body, function () { return api.get("/api/network/summary"); }, function (d) {
        var b = self.body;
        (d.interfaces || []).forEach(function (i) {
          b.appendChild(h("div", { cls: "sub", text: i.name + (i.wireless ? " (wifi)" : "") }));
          var st = i.operstate === "up" ? "ok" : "off"; var k = UI.kv("ESTADO", ""); k.lastChild.appendChild(UI.badge(i.operstate, st)); b.appendChild(k);
          (i.addrs || []).forEach(function (a) { b.appendChild(UI.kv(a.family, a.address)); });
          b.appendChild(UI.kv("MAC", i.mac));
          b.appendChild(UI.kv("RX/TX", UI.fmt.bytes(i.rx_bytes) + " / " + UI.fmt.bytes(i.tx_bytes)));
          if (i.speed_mbps > 0) b.appendChild(UI.kv("VELOC.", i.speed_mbps + " Mbps"));
        });
        b.appendChild(h("div", { cls: "sub", text: "ROTA / DNS" }));
        b.appendChild(UI.kv("GATEWAY", d.gateway));
        b.appendChild(UI.kv("IFACE PADRÃO", d.default_iface));
        b.appendChild(UI.kv("DNS", (d.dns || []).join(", ")));
        b.appendChild(UI.kv("SSID", d.ssid || "(n/a)"));
        if (d.signal_dbm > -100 && d.signal_dbm !== -1) b.appendChild(UI.kv("SINAL", d.signal_dbm + " dBm"));
        var connBtn = h("button", { cls: "chip", focus: true, text: "VER CONEXÕES (ss)", on: { click: function () { self.conns(); } } });
        b.appendChild(h("div", { cls: "toolbar" }, connBtn));
        self.connHost = h("div"); b.appendChild(self.connHost);
      });
    },
    conns: function () {
      var lh = this.connHost; UI.clear(lh); lh.appendChild(UI.loading());
      api.get("/api/network/connections?limit=80").then(function (d) {
        UI.clear(lh); lh.appendChild(h("pre", { cls: "box", text: (d.rows || []).join("\n") }));
      }).catch(function (e) { UI.clear(lh); lh.appendChild(UI.errBox(e)); });
    },
    back: function () { return false; },
  });

  /* ============================ LOGS ============================ */
  var LOG_SRC = ["dmesg", "journal", "agent", "kiosk", "ui"];
  var LOG_SEV = ["all", "error", "warning", "info"];
  reg({
    id: "logs", live: true,
    build: function () { var el = h("div", { cls: "view", id: "view-logs" }); this.el = el; this.paused = false; return el; },
    show: function () { this.render(); },
    refresh: function () { if (!this.paused) this.load(true); },
    render: function () {
      var self = this, el = UI.clear(this.el);
      el.appendChild(title("LOGS"));
      var tb = h("div", { cls: "toolbar" });
      LOG_SRC.forEach(function (s) { tb.appendChild(h("button", { cls: "chip" + (S.logs.source === s ? " on" : ""), focus: true, text: s, on: { click: function () { S.logs.source = s; self.load(); } } })); });
      el.appendChild(tb);
      var tb2 = h("div", { cls: "toolbar" });
      LOG_SEV.forEach(function (s) { tb2.appendChild(h("button", { cls: "chip" + (S.logs.severity === s ? " on" : ""), focus: true, text: s, on: { click: function () { S.logs.severity = s; self.load(); } } })); });
      tb2.appendChild(h("button", { cls: "chip", focus: true, text: "|| pausar", on: { click: function (ev) { self.paused = !self.paused; ev.target.textContent = self.paused ? "|> retomar" : "|| pausar"; } } }));
      el.appendChild(tb2);
      this.out = h("pre", { cls: "box full", focus: true, text: "(carregando…)" }); el.appendChild(this.out);
      this.load();
    },
    load: function (silent) {
      var self = this; if (!this.out) return;
      var sev = S.logs.severity === "all" ? "" : "&severity=" + S.logs.severity;
      if (!silent) this.out.textContent = "(carregando…)";
      api.get("/api/logs?source=" + S.logs.source + sev + "&lines=300").then(function (d) {
        var atBottom = self.out.scrollTop + self.out.clientHeight >= self.out.scrollHeight - 20;
        self.out.textContent = d.lines || "(sem saída)";
        if (atBottom || !silent) self.out.scrollTop = self.out.scrollHeight;
        CD.setAgent(true);
      }).catch(function (e) { if (!silent) self.out.textContent = e.business ? e.message : "(agente offline)"; });
    },
    back: function () { return false; },
  });

  /* ============================ CMD (allowlist) ============================ */
  reg({
    id: "cmd", live: false,
    build: function () { var el = h("div", { cls: "view", id: "view-cmd" }); this.el = el; return el; },
    show: function () { if (S.cmd.mode === "out") this.renderOut(); else this.renderList(); },
    renderList: function () {
      var self = this, el = UI.clear(this.el);
      el.appendChild(title("COMANDOS (allowlist)"));
      el.appendChild(h("div", { cls: "hint", text: "A executa · saída em tela cheia · B volta" }));
      var host = h("div"); el.appendChild(host);
      asyncRender(host, function () { return api.get("/api/commands"); }, function (d) {
        var cats = {};
        (d.commands || []).forEach(function (c) { (cats[c.cat] = cats[c.cat] || []).push(c); });
        Object.keys(cats).forEach(function (cat) {
          host.appendChild(h("div", { cls: "sub", text: cat.toUpperCase() }));
          var list = h("div", { cls: "list" });
          cats[cat].forEach(function (c) {
            list.appendChild(row([{ t: c.desc, grow: true }, { t: c.cmd, cls: "r" }], function () { self.run(c.key); }, true));
          });
          host.appendChild(list);
        });
        refocus(self.el);
      });
    },
    run: function (key) {
      var self = this; S.cmd.mode = "out"; S.cmd.key = key;
      var el = UI.clear(this.el);
      el.appendChild(title("CMD"));
      this.out = h("pre", { cls: "box full", focus: true, text: "… executando " + key + " …" }); el.appendChild(this.out);
      refocus(this.el);
      api.post("/api/commands/exec", { key: key }).then(function (r) {
        self.out.textContent = "$ " + r.cmd + "\n\n" + r.output + "\n\n[exit " + r.code + (r.timed_out ? " · TIMEOUT" : "") + "]";
        self.out.scrollTop = 0;
      }).catch(function (e) { self.out.textContent = e.business ? e.message : "(agente offline)"; });
    },
    renderOut: function () { this.run(S.cmd.key); },
    back: function () { if (S.cmd.mode === "out") { S.cmd.mode = "list"; this.renderList(); return true; } return false; },
  });

  /* ============================ TOOLS (ações) ============================ */
  reg({
    id: "tools", live: false,
    build: function () { var el = h("div", { cls: "view", id: "view-tools" }); this.el = el; return el; },
    show: function () {
      var self = this, el = UI.clear(this.el);
      el.appendChild(title("FERRAMENTAS / AÇÕES"));

      // ---- DISPLAY / UI (cliente; funciona mesmo offline p/ a fonte) ----
      el.appendChild(h("div", { cls: "sub", text: "DISPLAY / UI" }));
      var ui = h("div", { cls: "list" });
      ui.appendChild(row([{ t: "Fonte −", grow: true }, { t: "menor", cls: "r" }], function () { CD.setFontScale(-0.1); }, true));
      ui.appendChild(row([{ t: "Fonte +", grow: true }, { t: "maior", cls: "r" }], function () { CD.setFontScale(+0.1); }, true));
      ui.appendChild(row([{ t: "Fonte 100%", grow: true }, { t: "reset", cls: "r" }], function () { CD.resetFontScale(); }, true));
      ui.appendChild(row([{ t: "Screenshot", grow: true }, { t: "L1+R1", cls: "r" }], function () { CD.screenshot(); }, true));
      el.appendChild(ui);

      // ---- ações do sistema (do agente) ----
      el.appendChild(h("div", { cls: "sub", text: "SISTEMA" }));
      var host = h("div"); el.appendChild(host);
      asyncRender(host, function () { return api.get("/api/actions"); }, function (d) {
        var list = h("div", { cls: "list" });
        (d.actions || []).forEach(function (a) {
          list.appendChild(row([{ t: (a.dangerous ? "! " : "") + a.label, grow: true }, { t: a.dangerous ? "confirma" : "", cls: "r" }],
            function () { self.run(a); }, true));
        });
        host.appendChild(list);
        self.msg = h("div"); host.appendChild(self.msg);
        refocus(self.el);
      });
    },
    run: function (a) {
      var self = this;
      var doIt = function () {
        api.post("/api/actions", { key: a.key }).then(function (r) { UI.toast(r.msg || "ok"); })
          .catch(function (e) { UI.toast(e.message, true); });
      };
      if (a.dangerous) UI.confirm(a.label).then(function (ok) { if (ok) doIt(); });
      else doIt();
    },
    back: function () { return false; },
  });

  /* ============================ KERNEL & DTB ============================ */
  reg({
    id: "kernel", live: false,
    build: function () { var el = h("div", { cls: "view", id: "view-kernel" }); el.appendChild(title("KERNEL & DEVICE TREE")); this.body = h("div"); el.appendChild(this.body); this.el = el; return el; },
    show: function () {
      var self = this;
      asyncRender(this.body, function () { return api.get("/api/kernel", { timeout: 8000 }); }, function (d) {
        var b = self.body;
        kvGroup(b, "KERNEL", [
          ["RELEASE", d.osrelease], ["TIPO", d.ostype], ["ARCH", d.arch], ["HOST", d.hostname],
          ["TAINTED", d.tainted === 0 ? "0 (limpo)" : d.tainted], ["CONFIG", d.config_source || "—"],
          ["MÓDULOS", d.modules_total],
        ]);
        b.appendChild(h("div", { cls: "sub", text: "VERSION" }));
        b.appendChild(h("pre", { cls: "box", text: d.version || "—" }));
        b.appendChild(h("div", { cls: "sub", text: "CMDLINE / BOOTARGS" }));
        b.appendChild(h("pre", { cls: "box", text: d.cmdline || "—" }));

        var dt = d.dtb || {};
        kvGroup(b, "DEVICE TREE (DTB)", [
          ["PRESENTE", dt.present ? "/proc/device-tree" : "não"],
          ["MODELO", dt.model], ["SERIAL", dt.serial || "—"],
        ]);
        if (dt.compatible && dt.compatible.length) {
          b.appendChild(h("div", { cls: "sub", text: "COMPATIBLE" }));
          b.appendChild(h("pre", { cls: "box", text: dt.compatible.join("\n") }));
        }
        if (dt.bootargs) { b.appendChild(h("div", { cls: "sub", text: "DTB bootargs (chosen)" })); b.appendChild(h("pre", { cls: "box", text: dt.bootargs })); }

        // nós de topo do device-tree
        if (dt.nodes && dt.nodes.length) {
          b.appendChild(h("div", { cls: "sub", text: "NÓS (" + dt.nodes.length + ") — A abre no FS" }));
          var nl = h("div", { cls: "list" });
          dt.nodes.forEach(function (n) {
            nl.appendChild(row([{ t: n.name, grow: true }, { t: n.compatible, cls: "r" }], function () {
              S.fs.path = "/proc/device-tree/" + n.name; S.fs.mode = "list"; CD.go("fs");
            }, true));
          });
          b.appendChild(nl);
        }

        // módulos carregados
        b.appendChild(h("div", { cls: "sub", text: "MÓDULOS (" + (d.modules || []).length + ")" }));
        var ml = h("div", { cls: "list" });
        ml.appendChild(h("div", { cls: "row list-head" }, [h("span", { cls: "grow", text: "módulo" }), h("span", { cls: "c r", text: "KB" }), h("span", { cls: "c r", text: "uso" })]));
        (d.modules || []).forEach(function (m) {
          ml.appendChild(row([{ t: m.name, grow: true }, { t: m.size_kb, cls: "r" }, { t: m.used + (m.by ? " · " + m.by : ""), cls: "r" }], null, false));
        });
        b.appendChild(ml);
      });
    },
    back: function () { return false; },
  });

  /* ============================ KEYS (debug gamepad) ============================ */
  reg({
    id: "keys", live: false,
    build: function () {
      var el = h("div", { cls: "view", id: "view-keys" });
      el.appendChild(title("TESTE DE GAMEPAD / TECLAS"));
      el.appendChild(h("div", { cls: "hint", text: "Aperte botões e mexa nos analógicos." }));
      el.appendChild(h("div", { html: 'ÚLTIMA: <b id="kt-key">—</b> <span class="tb" id="kt-detail">code=—</span>' }));
      var grid = h("div", { cls: "kt-grid" });
      [["ArrowUp", "↑"], ["ArrowDown", "↓"], ["ArrowLeft", "←"], ["ArrowRight", "→"], ["Enter", "A"], ["Escape", "B"]].forEach(function (k) {
        grid.appendChild(h("span", { data: { k: k[0] }, text: k[1] }));
      });
      el.appendChild(grid);
      el.appendChild(h("div", { cls: "kv" }, [h("span", { text: "GAMEPAD" }), h("b", { id: "kt-gp", text: "não detectado" })]));
      el.appendChild(h("div", { cls: "kt-btns", id: "kt-buttons" }));
      el.appendChild(h("div", { cls: "tb", id: "kt-axes", text: "axes —" }));
      el.appendChild(h("pre", { cls: "box", id: "kt-log", text: "(aguardando…)" }));
      this.el = el; return el;
    },
    show: function () { refocus(this.el); },
    back: function () { return false; },
  });

  CD.views = V;
})();
