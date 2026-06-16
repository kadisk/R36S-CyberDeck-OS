/* ui.js — helpers de DOM, formatação e componentes reutilizáveis. */
(function () {
  "use strict";
  var UI = {};

  /* h(tag, attrs, children) — cria elemento. attrs.focus=true => focável (tabindex). */
  UI.h = function (tag, attrs, children) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      if (k === "focus" && attrs[k]) { el.setAttribute("tabindex", "0"); el.setAttribute("data-focus", "1"); }
      else if (k === "cls") el.className = attrs[k];
      else if (k === "html") el.innerHTML = attrs[k];
      else if (k === "text") el.textContent = attrs[k];
      else if (k === "on") { for (var ev in attrs.on) el.addEventListener(ev, attrs.on[ev]); }
      else if (k === "data") { for (var d in attrs.data) el.setAttribute("data-" + d, attrs.data[d]); }
      else if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    }
    if (children != null) UI.append(el, children);
    return el;
  };
  UI.append = function (el, children) {
    if (children == null) return el;
    if (!Array.isArray(children)) children = [children];
    children.forEach(function (c) {
      if (c == null) return;
      el.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
    });
    return el;
  };
  UI.clear = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };

  /* key/value row */
  UI.kv = function (label, value) {
    return UI.h("div", { cls: "kv" }, [UI.h("span", { text: label }), UI.h("b", { text: value == null || value === "" ? "—" : String(value) })]);
  };

  /* badge de estado a partir de um "kind": ok|warn|crit|off|run */
  UI.badge = function (text, kind) { return UI.h("span", { cls: "badge " + (kind || "off"), text: text }); };

  /* severidade centralizada (mesma régua do backend lib/health.js) -> ok|warn|crit */
  UI.level = function (kind, v, cores) {
    if (v == null || v < 0) return "ok";
    switch (kind) {
      case "temp": return v >= 80 ? "crit" : v >= 65 ? "warn" : "ok";
      case "ram": return v > 90 ? "crit" : v >= 75 ? "warn" : "ok";
      case "storage": return v > 90 ? "crit" : v >= 80 ? "warn" : "ok";
      case "battVolt": return v < 3.55 ? "crit" : v <= 3.75 ? "warn" : "ok";
      case "loadPerCore": { var n = cores ? v / cores : v; return n > 1.25 ? "crit" : n >= 0.75 ? "warn" : "ok"; }
      default: return "ok";
    }
  };

  /* gauge com barra colorida por nível */
  UI.gauge = function (label, pct) {
    pct = Math.max(0, Math.min(100, pct || 0));
    var cls = pct >= 90 ? "crit" : pct >= 70 ? "warn" : "";
    var i = UI.h("i", { cls: cls }); i.style.width = pct + "%";
    return UI.h("div", { cls: "gauge" }, [
      UI.h("label", { text: label }),
      UI.h("div", { cls: "bar" }, i),
      UI.h("span", { cls: "val", text: Math.round(pct) + "%" }),
    ]);
  };

  /* mensagens de estado (loading / vazio / erro) */
  // Ícones em ASCII: a fonte do fbdev (DejaVu Mono) não tem emoji/símbolos raros.
  UI.loading = function (txt) { return UI.h("div", { cls: "state-msg loading" }, [UI.h("span", { cls: "icon", text: "..." }), txt || "carregando…"]); };
  UI.empty = function (txt) { return UI.h("div", { cls: "state-msg" }, [UI.h("span", { cls: "icon", text: "[ ]" }), txt || "sem dados"]); };
  UI.errBox = function (e) {
    var msg = e && e.business ? (e.message + " [" + (e.code || "ERR") + "]") : "agente offline — verifique o cyberdeck-agent";
    return UI.h("div", { cls: "state-msg err" }, [UI.h("span", { cls: "icon", text: "/!\\" }), msg]);
  };

  /* formatação */
  UI.fmt = {
    bytes: function (n) {
      n = Number(n); if (!isFinite(n) || n < 0) return "—";
      var u = ["B", "K", "M", "G", "T"], i = 0;
      while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
      return (i === 0 ? n : n.toFixed(1)) + u[i];
    },
    uptime: function (s) {
      s = Math.floor(s || 0); var d = Math.floor(s / 86400); s %= 86400;
      var h = Math.floor(s / 3600); s %= 3600; var m = Math.floor(s / 60);
      return (d ? d + "d " : "") + h + "h " + m + "m";
    },
    clock: function (dt) { dt = dt || new Date(); var p = function (n) { return String(n).padStart(2, "0"); };
      return p(dt.getHours()) + ":" + p(dt.getMinutes()) + ":" + p(dt.getSeconds()); },
    pstate: function (s) {
      return { R: "run", S: "sleep", D: "io", T: "stop", t: "trace", Z: "zombie", X: "dead", I: "idle" }[s] || s;
    },
  };

  /* toast efêmero */
  var toastTimer = null;
  UI.toast = function (msg, isErr) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg; t.className = "toast" + (isErr ? " err" : ""); t.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  };

  /* confirm em tela cheia -> Promise<bool>. A/B resolvidos pela camada de input. */
  UI.confirm = function (message) {
    var box = document.getElementById("confirm");
    var msg = document.getElementById("confirm-msg");
    if (msg) msg.textContent = message;
    if (box) box.hidden = false;
    return new Promise(function (resolve) { CD.pendingConfirm = { resolve: resolve }; });
  };
  UI.resolveConfirm = function (val) {
    var box = document.getElementById("confirm");
    if (box) box.hidden = true;
    var p = CD.pendingConfirm; CD.pendingConfirm = null;
    if (p) p.resolve(val);
  };

  CD.ui = UI;
})();
