/* app.js — bootstrap, router e loops de atualização. Carregado por último. */
(function () {
  "use strict";
  var META = CD.META, views = CD.views, S = CD.state, UI = CD.ui;
  var content = document.getElementById("content");
  var tabsEl = document.getElementById("tabs");

  /* ---- monta abas (só as tab=true) ---- */
  var tabButtons = {};
  META.filter(function (m) { return m.tab; }).forEach(function (m) {
    var b = UI.h("button", { cls: "tab", text: m.title, on: { click: function () { CD.go(m.id); } } });
    tabButtons[m.id] = b; tabsEl.appendChild(b);
  });

  /* ---- wrapper interno que recebe o ZOOM da fonte (mantém #content fixo + scroll,
         senão o zoom no #content empurra o rodapé p/ fora da tela) ---- */
  var screen = UI.h("div", { id: "screen" });
  content.appendChild(screen);

  /* ---- monta as views (uma vez) ---- */
  META.forEach(function (m) {
    var v = views[m.id]; if (!v) return;
    var el = v.build(); screen.appendChild(el);
  });

  /* ---- foco no primeiro focável ---- */
  CD.focusFirst = function (el) {
    if (!el) return;
    var f = el.querySelector("[data-focus]");
    if (f) { try { f.focus(); } catch (e) {} }
  };

  /* ---- router ---- */
  CD.go = function (id) {
    if (!views[id]) return;
    if (CD.hidePointer) CD.hidePointer();   // ao trocar de seção, esconde o ponteiro -> A ativa o FOCO
    S.section = id;
    META.forEach(function (m) {
      var v = views[m.id]; if (v && v.el) v.el.classList.toggle("active", m.id === id);
      if (tabButtons[m.id]) tabButtons[m.id].classList.toggle("active", m.id === id);
    });
    content.scrollTop = 0;
    try { views[id].show(); } catch (e) { /* não derruba a UI */ }
    CD.focusFirst(views[id].el);
    updateHints(id);
    CD.afterNav();
  };

  CD.back = function () {
    var v = views[S.section];
    if (v && v.back && v.back()) { CD.focusFirst(v.el); CD.afterNav(); return; }
    if (S.section !== "welcome") CD.go("welcome");
  };

  /* ---- auto screenshot: captura a cada MUDANÇA DE TELA (debounce) ---- */
  var navTimer = null;
  CD.afterNav = function () {
    if (!S.autoShot) return;
    if (navTimer) clearTimeout(navTimer);
    navTimer = setTimeout(function () { CD.screenshot(true); }, 500);  // silencioso
  };
  CD.toggleAutoShot = function () {
    S.autoShot = !S.autoShot;
    UI.toast("auto screenshot " + (S.autoShot ? "ON — captura a cada tela" : "OFF"));
  };

  /* ---- menu FUNCTION (botão FN): AJUSTES, POWER, auto screenshot ---- */
  var fnEl = document.getElementById("fnmenu"), fnList = document.getElementById("fn-list");
  var fnVer = document.getElementById("fn-ver"); if (fnVer) fnVer.textContent = "CyberDeck v" + CD.VERSION;
  CD.fn = {
    isOpen: function () { return fnEl && !fnEl.hidden; },
    open: function () { this.render(); fnEl.hidden = false; var f = fnList.querySelector("[data-focus]"); if (f) f.focus(); },
    close: function () { if (fnEl) fnEl.hidden = true; },
    toggle: function () { this.isOpen() ? this.close() : this.open(); },
    render: function () {
      UI.clear(fnList);
      var item = function (icon, label, sub, fn, danger) {
        var subEl = UI.h("span", { cls: "r" }); subEl.innerHTML = UI.btnize(sub || "");   // L2+R2 etc. em negrito branco
        fnList.appendChild(UI.h("div", { cls: "row" + (danger ? " fn-danger" : ""), focus: true, on: { click: fn } },
          [UI.h("span", { cls: "fn-ic", text: icon }), UI.h("span", { cls: "grow", text: label }), subEl]));
      };
      // dispara uma ação do agente (allowlist); perigosas pedem confirmação
      var act = function (key, label, danger) {
        return function () {
          CD.fn.close();
          var doIt = function () { CD.api.post("/api/actions", { key: key }).then(function (r) { UI.toast(r.msg || "ok"); }).catch(function (e) { UI.toast(e.message, true); }); };
          if (danger) UI.confirm(label).then(function (ok) { if (ok) doIt(); }); else doIt();
        };
      };
      var sec = function (t) { fnList.appendChild(UI.h("div", { cls: "fn-sec", text: t })); };

      item("=", "Ajustes", "display/áudio", function () { CD.fn.close(); CD.go("tools"); });
      item("@", "Auto screenshot", S.autoShot ? "ON" : "OFF", function () { CD.toggleAutoShot(); CD.fn.render(); var f = fnList.querySelector("[data-focus]"); if (f) f.focus(); });
      item("#", "Screenshot agora", "L2+R2", function () { CD.fn.close(); CD.screenshot(); });

      // ENERGIA — opções inline (pedem confirmação); não navegam p/ outra tela
      sec("ENERGIA");
      item(">", "Recarregar UI", "confirma", act("reload-ui", "Recarregar UI", true));
      item(">", "Reiniciar agente", "confirma", act("restart-agent", "Reiniciar cyberdeck-agent", true));
      item("!", "Reiniciar kiosk", "confirma", act("restart-kiosk", "Reiniciar kiosk", true), true);
      item("!", "Reiniciar sistema", "confirma", act("reboot", "Reiniciar sistema", true), true);
      item("!", "Desligar", "confirma", act("poweroff", "Desligar sistema", true), true);
    },
  };

  CD.nextTab = function (dir) {
    var tabIds = META.filter(function (m) { return m.tab; }).map(function (m) { return m.id; });
    var i = tabIds.indexOf(S.section);
    if (i < 0) i = 0; // se estiver numa view sem aba (KEYS), volta p/ início
    i = (i + dir + tabIds.length) % tabIds.length;
    CD.go(tabIds[i]);
  };

  function updateHints(id) {
    var h = document.getElementById("hint-keys");
    if (!h) return;
    var map = {
      fs: "A: abrir · B: voltar dir · ←→ abas · analóg: cursor/scroll",
      systemd: "A: detalhe/ação · B: voltar · ←→ abas",
      procs: "A: detalhe · B: voltar · L1/R1: página",
      cmd: "A: executar · B: voltar",
      tools: "A: executar · L1/R1: página · B: voltar",
      device: "L1/R1: página · ←→: abas · B: voltar",
      logs: "A: detalhe · L1/R1: origem · B: voltar",
      fs: "A: abrir · B: voltar dir · L1/R1: página",
      systemd: "A: detalhe/ação · L1/R1: página · B: voltar",
    };
    var txt = map[id] || "A: ok · B: voltar · ←→: abas · ↑↓: foco";
    // sufixo L1/R1 quando a view tiver subpáginas/paginação e o hint não mencionar
    var v = views[id];
    if (v && (v.lr || (v.subs && v.subs.length)) && txt.indexOf("L1/R1") < 0) txt += " · L1/R1: página";
    h.innerHTML = UI.btnize(txt);   // A/B/X/Y coloridos; L1/R1/FN… negrito branco
  }

  /* ---- topbar + status polling ---- */
  function updateTopbar(d) {
    var set = function (id, t) { var e = document.getElementById(id); if (e) e.textContent = t; };
    set("tb-host", d.host || "host —");
    var n = (d.net && d.net[0]) || {};
    var ipEl = document.getElementById("tb-ip");
    if (ipEl) { var hasIp = !!n.ip; ipEl.textContent = hasIp ? n.ip : "NET OFF"; ipEl.className = "tb" + (hasIp ? "" : " warn"); }
    var load1 = d.load_arr ? d.load_arr[0] : null;
    var loadEl = document.getElementById("tb-load");
    if (loadEl) { loadEl.textContent = "load " + (load1 != null ? load1 : (d.load || "—")); loadEl.className = "tb " + UI.level("loadPerCore", load1, d.cores); }
    var temp = document.getElementById("tb-temp");
    if (temp) { temp.textContent = d.temp >= 0 ? d.temp + "°C" : "—°C"; temp.className = "tb " + UI.level("temp", d.temp); }
    var bat = document.getElementById("tb-bat"), b = d.battery || {};
    if (bat) {
      // quando o capacity do rk817 é duvidoso, usa a estimativa OCV (prefixo ~)
      var useEst = (b.capacity_trust === "low" && b.est >= 0);
      var pct = useEst ? b.est : (b.pct >= 0 ? b.pct : b.est);
      bat.textContent = "BAT " + (pct >= 0 ? (useEst ? "~" : "") + pct + "%" : "—") + (b.ac === 1 ? " AC" : "");
      bat.className = "tb" + (b.ac !== 1 && pct >= 0 && pct < 10 ? " crit" : b.ac !== 1 && pct >= 0 && pct < 25 ? " warn" : "");
    }
  }
  function feedHistory(d) {
    if (!CD.history) return;
    if (d.cpu >= 0) CD.history.push("cpu", d.cpu);
    if (d.mem) CD.history.push("ram", d.mem.pct);
    if (d.temp >= 0) CD.history.push("temp", d.temp);
    if (d.load_arr) CD.history.push("load", d.load_arr[0]);
    var b = d.battery || {};
    if (b.est >= 0) CD.history.push("bat", b.est); else if (b.volt > 0) CD.history.push("bat", b.volt);
  }
  function pollStatus() {
    CD.api.get("/api/status", { timeout: 4000 }).then(function (d) {
      CD.lastStatus = d; feedHistory(d); updateTopbar(d);
      var v = views[S.section]; if (v && v.onStatus) try { v.onStatus(d); } catch (e) {}
    }).catch(function () {});
  }
  setInterval(pollStatus, 2000); pollStatus();

  /* ---- relógio (local, suave) ---- */
  function tickClock() { var c = document.getElementById("tb-clock"); if (c) c.textContent = UI.fmt.clock(); }
  setInterval(tickClock, 1000); tickClock();

  /* ---- refresh de views "vivas" ---- */
  setInterval(function () {
    var v = views[S.section];
    if (v && v.live && v.refresh) try { v.refresh(); } catch (e) {}
  }, 4000);

  /* ---- escala de fonte (mantém a proporção: zoom só do #content) ---- */
  CD.applyFontScale = function (scale) {
    scale = Math.max(0.7, Math.min(1.8, Number(scale) || 1));
    CD.state.fontScale = scale;
    screen.style.zoom = scale;             // zoom no wrapper interno (rodapé não some)
    content.scrollTop = 0;
    return scale;
  };
  CD.setFontScale = function (delta) {
    var s = CD.applyFontScale(Math.round((CD.state.fontScale + delta) * 100) / 100);
    UI.toast("fonte " + Math.round(s * 100) + "%");
    CD.api.post("/api/settings", { fontScale: s }).catch(function () {}); // persiste (best-effort)
  };
  CD.resetFontScale = function () { CD.applyFontScale(1); UI.toast("fonte 100%"); CD.api.post("/api/settings", { fontScale: 1 }).catch(function () {}); };

  /* ---- screenshot (salvo pelo agente em /root/screenshots). silent: sem toast (auto) ---- */
  var shotBusy = false;
  CD.screenshot = function (silent) {
    if (shotBusy) return; shotBusy = true;
    var reset = function () { shotBusy = false; };
    // esconde QUALQUER toast antes de capturar — senão ele sai na própria foto.
    var t = document.getElementById("toast"); if (t) t.hidden = true;
    // espera o framebuffer repintar (RK3326 = render por software) antes do agente capturar.
    setTimeout(function () {
      CD.api.post("/api/screenshot", { version: CD.VERSION }, { timeout: 12000 }).then(function (d) {
        if (!silent) UI.toast("salvo: " + (d.file ? d.file.replace(/^.*\//, "") : "ok"));
      }).catch(function (e) {
        if (!silent) UI.toast(e.business ? e.message : "falha no screenshot (agente offline)", true);
      }).then(reset, reset);
    }, silent ? 120 : 250);
  };

  /* ---- volume (teclas de volume -> amixer no agente) ---- */
  CD.volume = function (key) {
    CD.api.post("/api/actions", { key: key }).then(function (d) { UI.toast(d.msg || "volume"); })
      .catch(function (e) { UI.toast(e.business ? e.message : "agente offline", true); });
  };

  /* ---- start ---- */
  // carrega preferências (escala de fonte) antes de exibir
  CD.api.get("/api/settings", { timeout: 4000 }).then(function (s) { CD.applyFontScale(s.fontScale); }).catch(function () {});

  // permite abrir direto numa seção (ex.: index.html#procs) — útil p/ teste
  var initial = (location.hash || "").replace("#", "");
  CD.go(views[initial] ? initial : "welcome");
  console.log("[cyberdeck-ui] pronto — welcome+cards, gamepad, agente Node");
})();
