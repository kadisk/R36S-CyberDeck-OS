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
    { id: "tools",   title: "AJUSTES", icon: "+", desc: "Display, áudio, fonte",     group: "AÇÕES",       tab: false },
    { id: "keys",    title: "KEYS",    icon: "@", desc: "Teste de gamepad",         group: "DIAGNÓSTICO", tab: false },
  ];
  CD.META = META;
  var GROUPS = ["MONITOR", "SISTEMA", "AÇÕES", "DIAGNÓSTICO"];

  var V = {};
  function reg(impl) { V[impl.id] = impl; }
  function title(t) { return h("div", { cls: "vtitle", text: t }); }
  function refocus(el) { if (CD.focusFirst) CD.focusFirst(el); }
  function hintB(t) { var d = h("div", { cls: "hint" }); d.innerHTML = UI.btnize(t); return d; }  // hint c/ botões coloridos

  /* ---- subpáginas (L1/R1) — evitam scroll dividindo a tela em seções ---- */
  function subIndex(id) { var v = V[id]; var n = (v && v.subs) ? v.subs.length : 0; var i = CD.state.sub[id] || 0; return n ? ((i % n) + n) % n : 0; }
  function subKey(id) { var v = V[id]; return (v && v.subs) ? v.subs[subIndex(id)] : null; }
  function subbar(id) {
    var v = V[id], idx = subIndex(id), bar = h("div", { cls: "subbar" });
    (v.subs || []).forEach(function (lbl, i) {
      bar.appendChild(h("button", { cls: "subtab" + (i === idx ? " on" : ""), focus: true,
        on: { click: (function (j) { return function () { CD.state.sub[id] = j; v.show(); CD.focusFirst(v.el); }; })(i) } }, lbl));
    });
    return bar;
  }
  // L1/R1 da seção ativa: a view pode definir lr(dir) (paginação/origem); senão cicla subs.
  CD.subCycle = function (dir) {
    var id = CD.state.section, v = V[id];
    if (!v) return false;
    if (typeof v.lr === "function") { v.lr(dir); if (CD.afterNav) CD.afterNav(); return true; }
    if (!v.subs || !v.subs.length) return false;
    CD.state.sub[id] = subIndex(id) + dir;
    v.show(); CD.focusFirst(v.el);
    if (CD.afterNav) CD.afterNav();
    return true;
  };

  /* breadcrumb compacto: "/ a > b > c" (trunca no meio se profundo) */
  function fsCrumb(p) {
    if (!p || p === "/") return "/";
    var parts = p.split("/").filter(Boolean);
    if (parts.length > 4) parts = ["…"].concat(parts.slice(-3));
    return "/ " + parts.join(" > ");
  }
  /* rótulo de tipo p/ a coluna do FS (DIR/LINK/TXT/LOG/BIN/…) */
  function fsTypeLabel(e) {
    if (e.type === "dir") return "DIR";
    if (e.type === "symlink") return "LINK";
    if (e.type === "block") return "BLK";
    if (e.type === "char") return "CHR";
    if (e.type === "fifo") return "PIPE";
    if (e.type === "socket") return "SOCK";
    if (e.type !== "file") return "?";
    var m = (e.name.match(/\.([A-Za-z0-9]+)$/) || [])[1];
    if (!m) return "FILE";
    m = m.toLowerCase();
    if (m === "log") return "LOG";
    if (/^(conf|cfg|ini|txt|sh|json|md|xml|ya?ml|service|rules|list|env|toml|desktop)$/.test(m)) return "TXT";
    if (/^(png|jpg|jpeg|gif|bmp|gz|xz|zip|bin|so|o|img|dtb|ko)$/.test(m)) return "BIN";
    return "FILE";
  }

  /* barra de paginação (focável): ‹ ant · pág X/Y · próx › */
  function pagerBar(page, total, onGo) {
    var bar = h("div", { cls: "toolbar pager" });
    bar.appendChild(h("button", { cls: "chip" + (page <= 0 ? " off" : ""), focus: true, text: "‹ ant", on: { click: function () { if (page > 0) onGo(page - 1); } } }));
    bar.appendChild(h("span", { cls: "chip pageinfo", text: "pág " + (page + 1) + "/" + total }));
    bar.appendChild(h("button", { cls: "chip" + (page >= total - 1 ? " off" : ""), focus: true, text: "próx ›", on: { click: function () { if (page < total - 1) onGo(page + 1); } } }));
    return bar;
  }

  /* row helper: cols = array de {t, cls, grow} */
  function row(cols, onClick, focus) {
    var attrs = { cls: "row" };
    if (focus) { attrs.focus = true; }
    if (onClick) attrs.on = { click: onClick };
    return h("div", attrs, cols.map(function (c) {
      var sp = h("span", { cls: (c.grow ? "grow " : "c ") + (c.cls || "") });
      var t = String(c.t == null ? "" : c.t);
      if (c.btn) sp.innerHTML = UI.btnize(t);   // célula com referência de botão (padrão do rodapé)
      else sp.textContent = t;
      return sp;
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
    id: "welcome", live: true,
    build: function () {
      var el = h("div", { cls: "view", id: "view-welcome" });
      // (sem título-herói: a marca já está no topbar) — cockpit: saúde + métricas + atalhos
      this.health = h("div", { cls: "health" }); el.appendChild(this.health);
      this.tiles = h("div", { cls: "tiles" }); el.appendChild(this.tiles);   // CPU/RAM/TEMP/BAT
      // atalhos CRÍTICOS apenas (o resto está na barra de abas) — HOME cabe em 1 tela
      var crit = ["status", "procs", "logs", "network", "systemd", "tools"];
      var cards = h("div", { cls: "cards" });
      crit.forEach(function (id) {
        var m = META.filter(function (x) { return x.id === id; })[0]; if (!m) return;
        cards.appendChild(h("div", { cls: "card", focus: true, on: { click: function () { CD.go(m.id); } } }, [
          h("span", { cls: "ic", text: m.icon }),
          h("span", { cls: "ti", text: m.title }),
          h("span", { cls: "de", text: m.desc }),
        ]));
      });
      el.appendChild(cards);
      this.el = el; return el;
    },
    show: function () { this.loadHealth(); if (CD.lastStatus) this.onStatus(CD.lastStatus); refocus(this.el); },
    refresh: function () { this.loadHealth(); },
    loadHealth: function () {
      var self = this;
      api.get("/api/health", { timeout: 6000 }).then(function (d) { self.renderHealth(d); })
        .catch(function () { if (self.health) { UI.clear(self.health).appendChild(h("div", { cls: "health-line crit", text: "agente OFF — sem dados de saúde" })); } });
    },
    renderHealth: function (d) {
      var host = UI.clear(this.health); var s = d.summary || {};
      var lvl = d.level || "ok";
      var lvlTxt = { ok: "SYS OK", warn: "SYS WARN", crit: "SYS CRIT" }[lvl] || "SYS ?";
      // linha 1: nível geral + agente + rede + systemd
      var line = h("div", { cls: "health-line " + lvl }, [
        h("b", { text: lvlTxt }),
        document.createTextNode("  agente ON · " + (s.net_ip ? "rede " + s.net_ip : "sem rede") +
          " · systemd " + (s.systemd || "?") + (s.failed > 0 ? " (" + s.failed + " falha)" : "")),
      ]);
      host.appendChild(line);
      // alertas acionáveis (clicáveis -> abrem a aba alvo)
      (d.items || []).forEach(function (it) {
        host.appendChild(h("div", { cls: "alert " + it.level, focus: true, on: { click: function () { CD.go(it.target); } } },
          "! " + it.label));
      });
    },
    onStatus: function (d) {
      if (!this.tiles || !d) return;
      var bt = d.battery || {};
      var batVal = (bt.ac === 1) ? "AC" : (bt.est >= 0 ? bt.est + "%" : (bt.volt > 0 ? bt.volt + "V" : "—"));
      var batSub = bt.volt > 0 ? bt.volt + "V" : "";
      var tiles = [
        { lbl: "CPU", val: (d.cpu >= 0 ? Math.round(d.cpu) + "%" : "—"), bar: d.cpu, lvl: UI.level("ram", d.cpu) },
        { lbl: "RAM", val: (d.mem ? Math.round(d.mem.pct) + "%" : "—"), bar: d.mem ? d.mem.pct : -1, lvl: UI.level("ram", d.mem ? d.mem.pct : 0) },
        { lbl: "TEMP", val: (d.temp >= 0 ? d.temp + "°" : "—"), sub: UI.level("temp", d.temp) === "ok" ? "ok" : "alto", lvl: UI.level("temp", d.temp) },
        { lbl: "BAT", val: batVal, sub: batSub, lvl: "ok" },
      ];
      var host = UI.clear(this.tiles);
      tiles.forEach(function (t) {
        var tile = h("div", { cls: "tile " + (t.lvl || "") }, [
          h("div", { cls: "tile-lbl", text: t.lbl }),
          h("div", { cls: "tile-val", text: t.val }),
        ]);
        if (t.bar >= 0) { var b = h("div", { cls: "tile-bar" }); var i = h("i"); i.style.width = Math.max(0, Math.min(100, t.bar)) + "%"; b.appendChild(i); tile.appendChild(b); }
        else if (t.sub) tile.appendChild(h("div", { cls: "tile-sub", text: t.sub }));
        host.appendChild(tile);
      });
    },
    back: function () { return false; },
  });

  /* ============================ STATUS (LIVE/POWER/TREND) ============================ */
  reg({
    id: "status", live: false, subs: ["AO VIVO", "ENERGIA", "TENDÊNCIA"],
    build: function () { var el = h("div", { cls: "view", id: "view-status" }); this.el = el; return el; },
    show: function () { this.render(); },
    render: function () {
      var el = UI.clear(this.el);
      el.appendChild(title("STATUS · " + subKey("status")));
      el.appendChild(subbar("status"));
      this.body = h("div"); el.appendChild(this.body);
      this.renderBody();
    },
    onStatus: function (d) { this.last = d; if (CD.state.section === "status" && this.body) this.renderBody(); },
    renderBody: function () {
      var d = this.last || CD.lastStatus; var b = UI.clear(this.body);
      if (!d) { b.appendChild(UI.loading()); return; }
      var sub = subKey("status");
      if (sub === "AO VIVO") {
        b.appendChild(UI.gauge("CPU", d.cpu >= 0 ? d.cpu : 0));
        if (d.mem) b.appendChild(UI.gauge("RAM", d.mem.pct));
        b.appendChild(UI.kv("MEM", d.mem ? (d.mem.used + " / " + d.mem.total + " MB") : "—"));
        b.appendChild(UI.kv("LOAD", d.load + "  (" + (d.cores || "?") + " cores)"));
        b.appendChild(UI.kv("TEMP", d.temp >= 0 ? d.temp + " °C" : "—"));
        b.appendChild(UI.kv("UPTIME", UI.fmt.uptime(d.uptime)));
        var n = (d.net && d.net[0]) || {};
        b.appendChild(UI.kv("REDE", n.iface ? (n.iface + " " + n.ip) : "(sem rede)"));
      } else if (sub === "ENERGIA") {
        var bt = d.battery || {}, lowTrust = bt.capacity_trust === "low";
        b.appendChild(UI.kv("BAT ~", (bt.est >= 0 ? bt.est + "%" : "—") + (bt.volt > 0 ? " · " + bt.volt + " V" : "") + (bt.curr !== -1 && bt.curr != null ? " · " + bt.curr + " mA" : "")));
        b.appendChild(UI.kv("ESTADO", (bt.ac === 1 ? "carregando [AC]" : (bt.status || "—")) + (bt.ocv > 0 ? " · OCV " + bt.ocv + " V" : "")));
        b.appendChild(UI.kv("RAW (rk817)", (bt.pct >= 0 ? bt.pct + "% capacity" : "—") + (lowTrust ? " · instável" : "")));
        if (d.brightness && d.brightness.pct >= 0) b.appendChild(UI.gauge("BRILHO", d.brightness.pct));
        b.appendChild(UI.kv("TEMP", d.temp >= 0 ? d.temp + " °C" : "—"));
      } else { // TREND
        if (CD.history && CD.history.get("cpu").length > 1) {
          b.appendChild(UI.kv("CPU", UI.sparkline(CD.history.get("cpu"), { min: 0, max: 100 })));
          b.appendChild(UI.kv("RAM", UI.sparkline(CD.history.get("ram"), { min: 0, max: 100 })));
          b.appendChild(UI.kv("TEMP", UI.sparkline(CD.history.get("temp"))));
          b.appendChild(UI.kv("LOAD", UI.sparkline(CD.history.get("load"))));
          b.appendChild(UI.kv("BAT", UI.sparkline(CD.history.get("bat"))));
          b.appendChild(h("div", { cls: "hint", text: "tendência da sessão (~2 min)" }));
        } else { b.appendChild(UI.empty("coletando histórico…")); }
      }
    },
    back: function () { return false; },
  });

  /* ============================ DEVICE (ID/CPU/DISPLAY/BOOT/INPUT) ============================ */
  function kvGroup(host, name, pairs) {
    if (name) host.appendChild(h("div", { cls: "sub", text: name }));
    pairs.forEach(function (p) { if (p) host.appendChild(UI.kv(p[0], p[1])); });
  }
  reg({
    id: "device", live: false, subs: ["ID", "CPU", "DISPLAY", "BOOT", "INPUT"],
    build: function () { var el = h("div", { cls: "view", id: "view-device" }); this.el = el; return el; },
    show: function () {
      var self = this;
      if (self.data) return self.renderSub();
      var el = UI.clear(this.el); el.appendChild(title("DEVICE")); var host = h("div"); el.appendChild(host); host.appendChild(UI.loading());
      api.get("/api/device", { timeout: 12000 }).then(function (d) { self.data = d; self.renderSub(); })
        .catch(function (e) { var el2 = UI.clear(self.el); el2.appendChild(title("DEVICE")); el2.appendChild(UI.errBox(e)); });
    },
    renderSub: function () {
      var self = this, d = self.data || {}, el = UI.clear(this.el);
      var sub = subKey("device");
      el.appendChild(title("DEVICE · " + sub));
      el.appendChild(subbar("device"));
      var b = h("div"); el.appendChild(b);
      var id = d.identity || {}, hw = d.hardware || {}, k = d.kernel || {}, dp = d.display || {}, ip = d.input || {};
      if (sub === "ID") {
        kvGroup(b, "", [["HOST", id.hostname], ["DISTRO", id.distro], ["KERNEL", id.kernel], ["ARCH", id.arch],
          ["UPTIME", UI.fmt.uptime(id.uptime_s)], ["TZ", id.timezone], ["USER", id.user], ["ROOTFS", id.rootfs]]);
      } else if (sub === "CPU") {
        var soc = (hw.soc || "").replace(/^Rockchip\s+/, "");
        var gpu = (hw.gpu || "").replace(/^ARM\s+/, "").replace(/\s*\(.*\)/, "");
        var gpuArch = (String(hw.gpu || "").match(/\(([^)]+)\)/) || [])[1] || "";
        var mc = h("div", { cls: "minicards" });
        mc.appendChild(UI.mcard("SoC", soc || "—", (hw.cores || "?") + " cores"));
        mc.appendChild(UI.mcard("RAM", hw.mem ? hw.mem.total_mb + " MB" : "—", hw.mem ? "livre " + hw.mem.available_mb : ""));
        mc.appendChild(UI.mcard("GPU", gpu || "—", gpuArch));
        b.appendChild(mc);
        // frequências por núcleo em 2 colunas (compacto)
        var g = h("div", { cls: "kv2" });
        (hw.freq || []).forEach(function (f) { g.appendChild(UI.kv("CPU" + f.cpu, (f.cur_mhz > 0 ? f.cur_mhz : "?") + " MHz")); });
        b.appendChild(g);
        (hw.thermals || []).forEach(function (t) { b.appendChild(UI.kv("TEMP " + t.type, t.temp_c >= 0 ? t.temp_c + " °C" : "—")); });
        b.appendChild(UI.kv("SWAP/ZRAM", hw.mem && hw.mem.swap_total_mb > 0 ? hw.mem.swap_total_mb + " MB" : (hw.zram && hw.zram.length && hw.zram[0].mb > 0 ? hw.zram[0].mb + " MB zram" : "inativo")));
        b.appendChild(UI.kv("GOVERNOR", (hw.freq && hw.freq[0]) ? hw.freq[0].governor : "—"));
      } else if (sub === "DISPLAY") {
        var fb = dp.framebuffer || {}, bl = dp.backlight || {};
        var panelModel = dp.panel ? dp.panel.replace(/^[^,]*,/, "").split(/[\s—]/)[0] : "—";
        var mc2 = h("div", { cls: "minicards" });
        mc2.appendChild(UI.mcard("FB", fb.virtual_size || "—", (fb.bits_per_pixel ? "@" + fb.bits_per_pixel + "bpp" : "")));
        mc2.appendChild(UI.mcard("LUZ", bl.pct >= 0 ? bl.pct + "%" : "—", bl.cur != null ? bl.cur + "/" + bl.max : ""));
        mc2.appendChild(UI.mcard("PAINEL", panelModel, "MIPI-DSI"));
        b.appendChild(mc2);
        kvGroup(b, "ARMAZENAMENTO", (hw.storage || []).map(function (s) { return [s.dev, s.gb + " GB" + (s.ro ? " (ro)" : "") + (s.model ? " · " + s.model : "")]; }));
      } else if (sub === "BOOT") {
        kvGroup(b, "", [["VERSION", k.version], ["MODELO DT", k.dtb_model || hw.model], ["MÓDULOS", k.modules_count]]);
        b.appendChild(h("div", { cls: "hint", text: "cmdline, dmesg e módulos completos na aba KERNEL" }));
      } else { // INPUT
        (ip.devices || []).forEach(function (dv) { b.appendChild(UI.kv((dv.joypad ? "* " : "") + (dv.event || "?"), dv.name)); });
        b.appendChild(h("div", { cls: "sub", text: "USB" }));
        var usb = ip.usb || [];
        if (!usb.length) b.appendChild(h("div", { cls: "hint", text: "(nenhum USB)" }));
        usb.forEach(function (u) { b.appendChild(UI.kv(u.id || "?", u.name || u.raw || "")); });
      }
      refocus(self.el);
    },
    back: function () { return false; },
  });

  /* ============================ FS ============================ */
  reg({
    id: "fs", live: false,
    build: function () { var el = h("div", { cls: "view", id: "view-fs" }); this.el = el; return el; },
    show: function () { this.render(); },
    lr: function (dir) { if (S.fs.mode !== "list") return; S.fs.page += dir; this.render(); },
    render: function () {
      var self = this, el = UI.clear(this.el);
      if (S.fs.mode === "view") return this.renderFile();
      this.titleEl = title("FS"); el.appendChild(this.titleEl);
      el.appendChild(h("div", { cls: "crumb", text: fsCrumb(S.fs.path) }));
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
        var entries = d.entries || [], SIZE = 10;
        var total = UI.pager.count(entries.length, SIZE);
        S.fs.page = UI.pager.clamp(S.fs.page, total);
        if (self.titleEl) self.titleEl.textContent = "FS" + (total > 1 ? "  ·  pág " + (S.fs.page + 1) + "/" + total + " (L1/R1)" : "");
        var list = h("div", { cls: "list" });
        if (d.parent != null) list.appendChild(row([{ t: "UP", cls: "fstype" }, { t: "..", grow: true }], function () { self.nav(d.parent); }, true));
        UI.pager.slice(entries, S.fs.page, SIZE).forEach(function (e) {
          var name = e.name + (e.type === "symlink" ? " → " + (e.target || "") : "");
          list.appendChild(row([
            { t: fsTypeLabel(e), cls: "fstype t-" + e.type },
            { t: name, grow: true },
            { t: e.type === "file" ? UI.fmt.bytes(e.size) : "", cls: "r" },
            { t: e.mode, cls: "r" },
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
    nav: function (p) { S.fs.path = p; S.fs.mode = "list"; S.fs.page = 0; this.render(); },
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
    lr: function (dir) { if (S.systemd.mode !== "list") return; S.systemd.page += dir; this.render(); },
    render: function () {
      if (S.systemd.mode === "detail") return this.renderDetail();
      var self = this, el = UI.clear(this.el);
      this.titleEl = title("SERVIÇOS"); el.appendChild(this.titleEl);
      // resumo COMPACTO: estado + contagem numa linha (libera espaço p/ a lista)
      var sumHost = h("div"); el.appendChild(sumHost);
      api.get("/api/systemd/summary").then(function (s) {
        UI.clear(sumHost);
        var badge = s.state === "running" ? "ok" : s.state === "degraded" ? "warn" : "off";
        var k = UI.kv("ESTADO", ""); k.lastChild.appendChild(UI.badge(s.state, badge));
        UI.append(k.lastChild, "  " + s.units_total + " units · " + s.running + " run · " + s.failed + " falhos");
        sumHost.appendChild(k);
      }).catch(function () {});
      var tb = h("div", { cls: "toolbar" });
      SD_FILTERS.forEach(function (f) {
        tb.appendChild(h("button", { cls: "chip" + (S.systemd.filter === f ? " on" : ""), focus: true, text: f,
          on: { click: function () { S.systemd.filter = f; S.systemd.page = 0; self.render(); } } }));
      });
      el.appendChild(tb);
      var listHost = h("div"); el.appendChild(listHost);
      asyncRender(listHost, function () { return api.get("/api/systemd/services"); }, function (d) {
        var list = h("div", { cls: "list" });
        var f = S.systemd.filter;
        var isFailed = function (s) { return s.active === "failed" || s.sub === "failed"; };
        var items = (d.services || []).filter(function (s) {
          if (f === "running") return s.sub === "running";
          if (f === "failed") return isFailed(s);
          if (f === "cyberdeck") return /cyberdeck/.test(s.unit);
          return true;
        });
        // falhas SEMPRE no topo (depois rodando, depois o resto) — visibilidade do problema
        var rank = function (s) { return isFailed(s) ? 0 : s.sub === "running" ? 1 : 2; };
        items.sort(function (a, b) { var r = rank(a) - rank(b); return r !== 0 ? r : a.unit.localeCompare(b.unit); });
        var SIZE = 11, total = UI.pager.count(items.length, SIZE);
        S.systemd.page = UI.pager.clamp(S.systemd.page, total);
        if (self.titleEl) self.titleEl.textContent = "SERVIÇOS" + (total > 1 ? "  ·  pág " + (S.systemd.page + 1) + "/" + total + " (L1/R1)" : "");
        UI.pager.slice(items, S.systemd.page, SIZE).forEach(function (s) {
          var stcls = s.sub === "running" ? "st-run" : isFailed(s) ? "st-crit" : "st-dim";
          list.appendChild(row([
            { t: s.unit.replace(/\.service$/, ""), grow: true },
            { t: s.sub, cls: "r " + stcls },
          ], function () { S.systemd.unit = s.unit; S.systemd.mode = "detail"; self.render(); }, true));
        });
        if (!items.length) list.appendChild(h("div", { cls: "hint", text: "(nenhum serviço neste filtro)" }));
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
  var PROC_FILTERS = ["ativos", "all", "node", "chromium", "cyberdeck", "running", "zombie"];
  reg({
    id: "procs", live: true,
    build: function () { var el = h("div", { cls: "view", id: "view-procs" }); this.el = el; return el; },
    show: function () { this.render(); },
    refresh: function () { if (S.procs.mode === "list") this.renderList(true); },
    render: function () { if (S.procs.mode === "detail") return this.renderDetail(); this.render0(); },
    lr: function (dir) { if (S.procs.mode !== "list") return; S.procs.page += dir; this.renderList(); },
    render0: function () {
      var self = this, el = UI.clear(this.el);
      this.titleEl = title("PROCESSOS"); el.appendChild(this.titleEl);
      this.sumHost = h("div"); el.appendChild(this.sumHost);
      // UMA linha de controles: sort (chip que cicla) + filtros — sobra espaço p/ a lista
      var tb = h("div", { cls: "toolbar" });
      tb.appendChild(h("button", { cls: "chip on", focus: true, text: "↓" + S.procs.sort, on: { click: function () { var i = PROC_SORTS.indexOf(S.procs.sort); S.procs.sort = PROC_SORTS[(i + 1) % PROC_SORTS.length]; S.procs.page = 0; self.renderList(); } } }));
      PROC_FILTERS.forEach(function (f) { tb.appendChild(h("button", { cls: "chip" + (S.procs.filter === f ? " on" : ""), focus: true, text: f, on: { click: function () { S.procs.filter = f; S.procs.page = 0; self.renderList(); } } })); });
      el.appendChild(tb);
      this.listHost = h("div"); el.appendChild(this.listHost);
      this.renderList();
    },
    renderList: function (silent) {
      var self = this;
      if (!self.listHost) return;
      if (!silent) { UI.clear(self.listHost); self.listHost.appendChild(UI.loading()); }
      api.get("/api/processes").then(function (d) {
        // resumo COMPACTO (1 linha) — sobra espaço p/ a lista
        var cores = (CD.lastStatus && CD.lastStatus.cores) || (d.summary && d.summary.cores) || 1;
        if (self.sumHost) { var s = d.summary || {}; UI.clear(self.sumHost);
          self.sumHost.appendChild(UI.kv("PROC", s.total + " · run " + s.running + " · zumbi " + s.zombie + " · ~" + (s.cpu_total || 0) + "% cpu / " + cores + " cores"));
        }
        var f = S.procs.filter, rows = (d.processes || []).filter(function (p) {
          if (f === "ativos") return p.cpu > 0 || p.state === "R";
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
        var SIZE = 10, total = UI.pager.count(rows.length, SIZE);
        S.procs.page = UI.pager.clamp(S.procs.page, total);
        if (self.titleEl) self.titleEl.textContent = "PROCESSOS" + (total > 1 ? "  ·  pág " + (S.procs.page + 1) + "/" + total + " (L1/R1)" : "");
        UI.clear(self.listHost);
        var list = h("div", { cls: "list" });
        list.appendChild(h("div", { cls: "row list-head" }, [
          h("span", { cls: "c", text: "PID" }), h("span", { cls: "grow", text: "CMD" }),
          h("span", { cls: "pbar-h", text: "CPU" }), h("span", { cls: "c r", text: "%" }), h("span", { cls: "c r", text: "RSS" }),
        ]));
        if (!rows.length) list.appendChild(h("div", { cls: "hint", text: "(nenhum processo neste filtro)" }));
        UI.pager.slice(rows, S.procs.page, SIZE).forEach(function (p) {
          var bar = h("span", { cls: "pbar" }); var bi = h("i", { cls: p.cpu >= 90 ? "crit" : p.cpu >= 50 ? "warn" : "" });
          bi.style.width = Math.max(0, Math.min(100, p.cpu)) + "%"; bar.appendChild(bi);
          list.appendChild(h("div", { cls: "row", focus: true, on: { click: (function (pp) { return function () { S.procs.pid = pp.pid; S.procs.mode = "detail"; self.render(); }; })(p) } }, [
            h("span", { cls: "c", text: p.pid }),
            h("span", { cls: "grow", text: p.comm }),
            bar,
            h("span", { cls: "c r", text: p.cpu + "%" }),
            h("span", { cls: "c r", text: p.rss_mb + "M" }),
          ]));
        });
        self.listHost.appendChild(list);
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
        // interface externa "real" (ignora lo)
        var ext = (d.interfaces || []).filter(function (i) { return i.name !== "lo"; });
        var up = ext.filter(function (i) { return i.operstate === "up" || i.carrier; });
        var ipIf = ext.filter(function (i) { return (i.addrs || []).some(function (a) { return a.family === "v4" && !/^127\./.test(a.address); }); });
        var ip = ipIf.length ? (ipIf[0].addrs.filter(function (a) { return a.family === "v4"; })[0] || {}).address : null;
        var dns = (d.dns || []).filter(function (x) { return x && !/^127\./.test(x); });
        var online = !!(d.gateway && ip);

        // cabeçalho de estado
        var hk = UI.kv("REDE", ""); hk.lastChild.appendChild(UI.badge(online ? "ONLINE" : "OFF", online ? "ok" : "warn")); b.appendChild(hk);
        b.appendChild(UI.kv("INTERFACE", ext.length ? ext.map(function (i) { return i.name; }).join(", ") : "—"));
        b.appendChild(UI.kv("IP", ip || "—"));
        b.appendChild(UI.kv("GATEWAY", d.gateway || "—"));
        b.appendChild(UI.kv("DNS", dns.join(", ") || "—"));
        b.appendChild(UI.kv("SSID", d.ssid || "(n/a)" + (d.signal_dbm > -100 && d.signal_dbm !== -1 ? " · " + d.signal_dbm + " dBm" : "")));

        // checklist de diagnóstico
        b.appendChild(h("div", { cls: "sub", text: "DIAGNÓSTICO" }));
        var check = function (ok, label, warnIfNo) {
          var mark = ok ? "✓" : (warnIfNo ? "×" : "?");
          b.appendChild(h("div", { cls: "chkline " + (ok ? "ok" : warnIfNo ? "warn" : "off"), text: mark + " " + label }));
        };
        check(ext.length > 0, "interface externa detectada (dongle USB)", true);
        check(up.length > 0, "link ativo", true);
        check(!!ip, "IP recebido", true);
        check(!!d.gateway, "gateway configurado", true);
        check(dns.length > 0, "DNS configurado", false);

        // ações
        var bar = h("div", { cls: "toolbar" });
        bar.appendChild(h("button", { cls: "chip", focus: true, text: "conexões (ss)", on: { click: function () { self.conns(); } } }));
        b.appendChild(bar);
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
    subs: LOG_SRC,
    build: function () { var el = h("div", { cls: "view", id: "view-logs" }); this.el = el; this.paused = false; return el; },
    show: function () { if (S.logs.mode === "detail") this.renderDetail(); else this.render(); },
    refresh: function () { if (S.logs.mode === "list" && !this.paused) this.load(true); },
    // L1/R1 troca a ORIGEM do log (só na lista); no detalhe, ignora
    lr: function (dir) { if (S.logs.mode !== "list") return; CD.state.sub.logs = subIndex("logs") + dir; this.render(); CD.focusFirst(this.el); },
    render: function () {
      var self = this, el = UI.clear(this.el);
      S.logs.source = LOG_SRC[subIndex("logs")];   // origem = subpágina (L1/R1 ou subtab)
      el.appendChild(title("LOGS · " + S.logs.source));
      el.appendChild(subbar("logs"));               // origem como abas (dmesg/journal/agent/kiosk/ui)
      // severidade + pausa numa linha compacta
      var tb2 = h("div", { cls: "toolbar" });
      LOG_SEV.forEach(function (s) { tb2.appendChild(h("button", { cls: "chip" + (S.logs.severity === s ? " on" : ""), focus: true, text: s, on: { click: function () { S.logs.severity = s; self.load(); } } })); });
      tb2.appendChild(h("button", { cls: "chip", focus: true, text: "|| pausar", on: { click: function (ev) { self.paused = !self.paused; ev.target.textContent = self.paused ? "|> retomar" : "|| pausar"; } } }));
      el.appendChild(tb2);
      this.out = h("div", { cls: "box full", id: "logs-out" }); this.out.textContent = "(carregando…)"; el.appendChild(this.out);
      this.load();
    },
    load: function (silent) {
      var self = this; if (!this.out) return;
      var sev = S.logs.severity === "all" ? "" : "&severity=" + S.logs.severity;
      if (!silent) this.out.textContent = "(carregando…)";
      api.get("/api/logs?source=" + S.logs.source + sev + "&lines=150").then(function (d) {
        var atBottom = self.out.scrollTop + self.out.clientHeight >= self.out.scrollHeight - 20;
        self.renderLines(d.lines || "(sem saída)");
        if (atBottom || !silent) self.out.scrollTop = self.out.scrollHeight;
        CD.setAgent(true);
      }).catch(function (e) { if (!silent) self.out.textContent = e.business ? e.message : "(agente offline)"; });
    },
    sevOf: function (l) {
      return /\b(fail|failed|failure|error|err|exit-code|cannot|denied|panic|oops|segfault)\b/i.test(l) ? "err"
        : /\b(warn|warning)\b/i.test(l) ? "warn" : "info";
    },
    // cada linha é colorida por severidade e FOCÁVEL — A abre o detalhe.
    renderLines: function (text) {
      var self = this, out = UI.clear(this.out);
      var lines = String(text).split("\n");
      if (lines.length > 160) lines = lines.slice(lines.length - 150);
      lines.forEach(function (l) {
        var sev = self.sevOf(l);
        out.appendChild(h("div", { cls: "logline " + sev, focus: true, on: { click: (function (line, s) { return function () { S.logs.mode = "detail"; S.logs.line = line; S.logs.lineSev = s; self.renderDetail(); }; })(l, sev) } }, l || " "));
      });
    },
    renderDetail: function () {
      var self = this, el = UI.clear(this.el), line = S.logs.line || "", sev = S.logs.lineSev || "info";
      el.appendChild(title("LOG · detalhe"));
      var head = h("div", { cls: "out-head" });
      head.appendChild(h("span", { cls: "badge " + (sev === "err" ? "crit" : sev === "warn" ? "warn" : "off"), text: sev.toUpperCase() }));
      UI.append(head, "  " + S.logs.source);
      el.appendChild(head);
      // tenta separar timestamp do resto p/ leitura
      var m = line.match(/^(\[[^\]]+\]|\S+T\S+)\s+([\s\S]*)$/);
      if (m) { el.appendChild(UI.kv("QUANDO", m[1].replace(/^\[|\]$/g, ""))); }
      el.appendChild(h("div", { cls: "sub", text: "MENSAGEM" }));
      el.appendChild(h("pre", { cls: "box full", focus: true, text: m ? m[2] : line }));
    },
    back: function () { if (S.logs.mode === "detail") { S.logs.mode = "list"; this.render(); return true; } return false; },
  });

  /* ============================ CMD (allowlist) ============================ */
  reg({
    id: "cmd", live: false,
    build: function () { var el = h("div", { cls: "view", id: "view-cmd" }); this.el = el; return el; },
    show: function () { if (S.cmd.mode === "out") this.renderOut(); else this.renderList(); },
    renderList: function () {
      var self = this, el = UI.clear(this.el);
      var host = h("div");
      var build = function (d) {
        self.cmds = d.commands || [];
        var cats = {};
        self.cmds.forEach(function (c) { (cats[c.cat] = cats[c.cat] || []).push(c); });
        UI.clear(el);
        if (!S.cmd.cat) {
          // nível 1: CATEGORIAS (cabe em uma tela)
          el.appendChild(title("COMANDOS"));
          el.appendChild(hintB("A abrir · B voltar"));
          var grid = h("div", { cls: "cards" });
          Object.keys(cats).forEach(function (cat) {
            grid.appendChild(h("div", { cls: "card", focus: true, on: { click: (function (c) { return function () { S.cmd.cat = c; self.renderList(); }; })(cat) } }, [
              h("span", { cls: "ti", text: cat.toUpperCase() }),
              h("span", { cls: "de", text: cats[cat].length + " comandos" }),
            ]));
          });
          el.appendChild(grid);
        } else {
          // nível 2: comandos da categoria
          el.appendChild(title("CMD · " + S.cmd.cat.toUpperCase()));
          el.appendChild(hintB("A executar · B voltar"));
          var list = h("div", { cls: "list" });
          (cats[S.cmd.cat] || []).forEach(function (c) {
            list.appendChild(row([
              { t: "[" + (c.risk === "diag" ? "DIAG" : "SAFE") + "]", cls: "tag-" + (c.risk || "safe") },
              { t: c.desc, grow: true }, { t: c.cmd, cls: "r" },
            ], (function (cc) { return function () { self.run(cc.key); }; })(c), true));
          });
          el.appendChild(list);
        }
        refocus(self.el);
      };
      if (self.cmds) { build({ commands: self.cmds }); }
      else { el.appendChild(title("COMANDOS")); el.appendChild(host); host.appendChild(UI.loading());
        api.get("/api/commands").then(build).catch(function (e) { UI.clear(el); el.appendChild(title("COMANDOS")); el.appendChild(UI.errBox(e)); }); }
    },
    run: function (key) {
      var self = this; S.cmd.mode = "out"; S.cmd.key = key;
      var el = UI.clear(this.el);
      el.appendChild(title("CMD  " + key));
      this.head = h("div", { cls: "out-head", text: "… executando …" }); el.appendChild(this.head);
      this.out = h("pre", { cls: "box full", focus: true, text: "" }); el.appendChild(this.out);
      refocus(this.el);
      api.post("/api/commands/exec", { key: key }).then(function (r) {
        var st = r.timed_out ? "TIMEOUT" : (r.ok ? "OK" : "ERRO");
        var stcls = r.timed_out ? "crit" : (r.ok ? "ok" : "crit");
        UI.clear(self.head).appendChild(h("span", { cls: "badge " + stcls, text: st }));
        UI.append(self.head, "  $ " + r.cmd + "   ·   exit " + r.code + " · " + (r.ms != null ? r.ms + "ms" : ""));
        self.out.textContent = r.output; self.out.scrollTop = 0;
      }).catch(function (e) { UI.clear(self.head); self.out.textContent = e.business ? e.message : "(agente offline)"; });
    },
    renderOut: function () { this.run(S.cmd.key); },
    back: function () {
      if (S.cmd.mode === "out") { S.cmd.mode = "list"; this.renderList(); return true; }   // saída -> comandos
      if (S.cmd.cat) { S.cmd.cat = null; this.renderList(); return true; }                  // comandos -> categorias
      return false;
    },
  });

  /* ============================ TOOLS (DISPLAY/AUDIO/SYSTEM/DANGER) ============================ */
  function toolBucket(key) {
    if (/^bright-/.test(key)) return "DISPLAY";
    if (/^volume-/.test(key)) return "AUDIO";
    if (key === "reload-ui" || key === "restart-agent") return "SYSTEM";
    return "DANGER"; // restart-kiosk, reboot, poweroff
  }
  // executa uma ação do agente; perigosas pedem confirmação
  function runAction(a) {
    var doIt = function () {
      api.post("/api/actions", { key: a.key }).then(function (r) { UI.toast(r.msg || "ok"); })
        .catch(function (e) { UI.toast(e.message, true); });
    };
    if (a.dangerous) UI.confirm(a.label).then(function (ok) { if (ok) doIt(); });
    else doIt();
  }

  reg({
    id: "tools", live: false, subs: ["DISPLAY", "AUDIO"],
    build: function () { var el = h("div", { cls: "view", id: "view-tools" }); this.el = el; return el; },
    show: function () {
      var self = this;
      if (self.data) return self.renderSub();
      var el = UI.clear(this.el); el.appendChild(title("AJUSTES")); var host = h("div"); el.appendChild(host); host.appendChild(UI.loading());
      api.get("/api/actions").then(function (d) { self.data = d.actions || []; self.renderSub(); })
        .catch(function () { self.data = []; self.renderSub(); });
    },
    renderSub: function () {
      var self = this, el = UI.clear(this.el), sub = subKey("tools");
      el.appendChild(title("AJUSTES · " + sub));
      el.appendChild(subbar("tools"));
      var b = h("div"); el.appendChild(b);
      var acts = self.data || [];
      var inBucket = function (name) { return acts.filter(function (a) { return toolBucket(a.key) === name; }); };
      if (sub === "DISPLAY") {
        var fs = Math.round((CD.state.fontScale || 1) * 100);
        var ui = h("div", { cls: "list" });
        ui.appendChild(row([{ t: "Fonte +", grow: true }, { t: fs + "%", cls: "r" }], function () { CD.setFontScale(+0.1); }, true));
        ui.appendChild(row([{ t: "Fonte −", grow: true }], function () { CD.setFontScale(-0.1); }, true));
        ui.appendChild(row([{ t: "Fonte reset", grow: true }], function () { CD.resetFontScale(); }, true));
        ui.appendChild(row([{ t: "Screenshot", grow: true }, { t: "L2+R2", cls: "r", btn: true }], function () { CD.screenshot(); }, true));
        inBucket("DISPLAY").forEach(function (a) { ui.appendChild(row([{ t: a.label, grow: true }], function () { runAction(a); }, true)); });
        b.appendChild(ui);
        var bri = (CD.lastStatus && CD.lastStatus.brightness && CD.lastStatus.brightness.pct >= 0) ? CD.lastStatus.brightness.pct : -1;
        if (bri >= 0) b.appendChild(UI.gauge("BRILHO", bri));
      } else { // AUDIO
        var la = h("div", { cls: "list" });
        var au = inBucket("AUDIO");
        if (!au.length) la.appendChild(h("div", { cls: "hint", text: "(sem controles de áudio)" }));
        au.forEach(function (a) { la.appendChild(row([{ t: a.label, grow: true }], function () { runAction(a); }, true)); });
        b.appendChild(la);
      }
      refocus(self.el);
    },
    back: function () { return false; },
  });

  /* POWER virou inline no menu FUNCTION (FN) — sem view dedicada. */

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
