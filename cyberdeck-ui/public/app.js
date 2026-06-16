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

  /* ---- monta as views (uma vez) ---- */
  META.forEach(function (m) {
    var v = views[m.id]; if (!v) return;
    var el = v.build(); content.appendChild(el);
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
    S.section = id;
    META.forEach(function (m) {
      var v = views[m.id]; if (v && v.el) v.el.classList.toggle("active", m.id === id);
      if (tabButtons[m.id]) tabButtons[m.id].classList.toggle("active", m.id === id);
    });
    content.scrollTop = 0;
    try { views[id].show(); } catch (e) { /* não derruba a UI */ }
    CD.focusFirst(views[id].el);
    updateHints(id);
  };

  CD.back = function () {
    var v = views[S.section];
    if (v && v.back && v.back()) { CD.focusFirst(v.el); return; }
    if (S.section !== "welcome") CD.go("welcome");
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
      procs: "A: detalhe · B: voltar · ↓ ordena/filtra",
      cmd: "A: executar · B: voltar à lista",
      tools: "A: executar (⚠ pede confirmação) · B: voltar",
    };
    h.textContent = map[id] || "A: ok · B: voltar · ←→: abas · ↑↓: foco";
  }

  /* ---- topbar + status polling ---- */
  function updateTopbar(d) {
    var set = function (id, t) { var e = document.getElementById(id); if (e) e.textContent = t; };
    set("tb-host", d.host || "host —");
    var n = (d.net && d.net[0]) || {};
    set("tb-ip", n.ip || "sem ip");
    set("tb-load", "load " + (d.load_arr ? d.load_arr[0] : (d.load || "—")));
    var temp = document.getElementById("tb-temp");
    if (temp) { temp.textContent = d.temp >= 0 ? d.temp + "°C" : "—°C"; temp.className = "tb" + (d.temp >= 75 ? " crit" : d.temp >= 65 ? " warn" : ""); }
    var bat = document.getElementById("tb-bat"), b = d.battery || {};
    if (bat) {
      var pct = b.pct >= 0 ? b.pct : b.est;
      bat.textContent = "BAT " + (pct >= 0 ? pct + "%" : "—") + (b.ac === 1 ? "⚡" : "");
      bat.className = "tb" + (b.ac !== 1 && pct >= 0 && pct < 10 ? " crit" : b.ac !== 1 && pct >= 0 && pct < 25 ? " warn" : "");
    }
  }
  function pollStatus() {
    CD.api.get("/api/status", { timeout: 4000 }).then(function (d) {
      CD.lastStatus = d; updateTopbar(d);
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

  /* ---- start ---- */
  // permite abrir direto numa seção (ex.: index.html#procs) — útil p/ teste
  var initial = (location.hash || "").replace("#", "");
  CD.go(views[initial] ? initial : "welcome");
  console.log("[cyberdeck-ui] pronto — welcome+cards, gamepad, agente Node");
})();
