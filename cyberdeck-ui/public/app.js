/* CyberDeck UI — lógica (vanilla JS, sem deps).
 * Navegação pelo gamepad (Gamepad API do Chromium) + dados ao vivo do cyberdeck-agent
 * (Node, 127.0.0.1:8080): STATUS/DEVICE/REDE/LOGS/TERMINAL/FERRAMENTAS + diagnóstico TECLAS.
 */
(function () {
  "use strict";

  var AGENT = "http://127.0.0.1:8080";
  var SECTIONS = ["status", "device", "network", "logs", "terminal", "tools", "keys"];
  var current = 0;

  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  var panels = {};
  SECTIONS.forEach(function (id) { panels[id] = document.getElementById(id); });

  function set(id, txt) { var el = document.getElementById(id); if (el) el.textContent = txt; }
  function setBar(barId, valId, pct) {
    var bar = document.getElementById(barId), val = document.getElementById(valId);
    if (bar) bar.style.width = Math.max(0, Math.min(100, pct)) + "%";
    if (val) val.textContent = Math.round(pct) + "%";
  }

  function show(index) {
    current = (index + SECTIONS.length) % SECTIONS.length;
    SECTIONS.forEach(function (id, i) {
      panels[id].hidden = i !== current;
      tabs[i].classList.toggle("active", i === current);
    });
    var id = SECTIONS[current];
    var first = panels[id].querySelector("[tabindex]");
    if (first) first.focus(); else tabs[current].focus();
    onShow(id);
  }
  function onShow(id) {
    if (id === "device") loadDevice();
    else if (id === "network") loadNetwork();
    else if (id === "logs") loadLogs();
  }

  tabs.forEach(function (t, i) { t.addEventListener("click", function () { show(i); }); });

  // ---- Diagnóstico de teclas (captura: pega tudo, antes da navegação) ------
  var ktLog = [];
  document.addEventListener("keydown", function (e) {
    var lk = document.getElementById("lastkey");
    if (lk) { lk.textContent = "tecla: " + e.key; lk.classList.add("hit");
      setTimeout(function () { lk.classList.remove("hit"); }, 350); }
    set("kt-key", e.key);
    set("kt-detail", "code=" + e.code + "  keyCode=" + e.keyCode);
    var cell = document.querySelector('#kt-grid [data-k="' + e.key + '"]');
    if (cell) { cell.classList.add("hit"); setTimeout(function () { cell.classList.remove("hit"); }, 350); }
    ktLog.unshift(new Date().toLocaleTimeString() + "  key=" + e.key + "  code=" + e.code + "  keyCode=" + e.keyCode);
    ktLog = ktLog.slice(0, 12);
    set("kt-log", ktLog.join("\n"));
  }, true);

  // ---- Navegação por teclado (USB) ----------------------------------------
  document.addEventListener("keydown", function (e) {
    switch (e.key) {
      case "ArrowRight": case "PageDown": show(current + 1); break;
      case "ArrowLeft":  case "PageUp":   show(current - 1); break;
      case "ArrowDown":  moveFocus(1); break;
      case "ArrowUp":    moveFocus(-1); break;
      case "Enter":      activate(); break;
      case "Escape":     show(0); break;
      default: return;
    }
    e.preventDefault();
  });

  // ---- Gamepad API: navegação principal (joypad direto no Chromium) --------
  // Índices CONFIRMADOS no aparelho (aba TECLAS): A=1,X=2,Y=3,L1=4,R1=5,R2=6,
  // ↑=8,↓=9,←=10,→=11,Select=12,Start=13,Fn=16. (B=0 inferido da ordem evdev.)
  var GP_RAW = { B:0, A:1, X:2, Y:3, L1:4, R1:5, R2:6, L2:7,
                 UP:8, DOWN:9, LEFT:10, RIGHT:11, SELECT:12, START:13, FN:16 };
  var GP_STD = { A:0, B:1, X:2, Y:3, L1:4, R1:5, L2:6, R2:7, UP:12, DOWN:13, LEFT:14, RIGHT:15 };
  function mapFor(gp) { return gp.mapping === "standard" ? GP_STD : GP_RAW; }

  var prevButtons = [];
  function gedge(gp, idx, fn) {
    if (idx == null) return;
    var pressed = gp.buttons[idx] && gp.buttons[idx].pressed;
    if (pressed && !prevButtons[idx]) fn();
    prevButtons[idx] = pressed;
  }
  function moveFocus(dir) {
    var items = panels[SECTIONS[current]].querySelectorAll("[tabindex]");
    if (!items.length) return;
    var arr = Array.prototype.slice.call(items);
    var i = arr.indexOf(document.activeElement);
    i = (i < 0 ? 0 : i + dir + arr.length) % arr.length;
    arr[i].focus();
  }
  function activate() {
    var el = document.activeElement; if (!el) return;
    if (el.dataset && el.dataset.cmd) return runCmd(el.dataset.cmd);
    if (el.dataset && el.dataset.action) return runAction(el.dataset.action);
    if (el.tagName === "LI") el.classList.toggle("selected");
  }
  function dumpGamepad(gp) {
    set("kt-gp", '"' + gp.id + '"  map=' + (gp.mapping || "raw"));
    var bc = document.getElementById("kt-buttons");
    if (bc) { var h = ""; for (var b = 0; b < gp.buttons.length; b++)
      h += '<span class="' + (gp.buttons[b] && gp.buttons[b].pressed ? "hit" : "") + '">' + b + "</span>"; bc.innerHTML = h; }
    var ax = document.getElementById("kt-axes");
    if (ax) { var a = []; for (var j = 0; j < gp.axes.length; j++) a.push(j + ":" + gp.axes[j].toFixed(2)); ax.textContent = "axes  " + a.join("  "); }
  }
  function pollGamepad() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var gp = pads && pads[0];
    if (gp) {
      dumpGamepad(gp);
      var M = mapFor(gp);
      gedge(gp, M.R1,    function () { show(current + 1); });
      gedge(gp, M.L1,    function () { show(current - 1); });
      gedge(gp, M.RIGHT, function () { show(current + 1); });
      gedge(gp, M.LEFT,  function () { show(current - 1); });
      gedge(gp, M.DOWN,  function () { moveFocus(1); });
      gedge(gp, M.UP,    function () { moveFocus(-1); });
      gedge(gp, M.A,     activate);
      gedge(gp, M.START, activate);
      gedge(gp, M.B,     function () { show(0); });
      gedge(gp, M.SELECT, function () { show(0); });
    }
    requestAnimationFrame(pollGamepad);
  }
  if (navigator.getGamepads) requestAnimationFrame(pollGamepad);

  // ---- Relógio -------------------------------------------------------------
  function tickClock() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, "0"); };
    set("clock", p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()));
  }
  setInterval(tickClock, 1000); tickClock();

  // ---- Helpers de fetch ----------------------------------------------------
  function getJSON(path) { return fetch(AGENT + path, { cache: "no-store" }).then(function (r) { return r.json(); }); }
  function postJSON(path, body) {
    return fetch(AGENT + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); });
  }
  function fmtUptime(s) {
    s = Math.floor(s); var d = Math.floor(s / 86400); s %= 86400;
    var h = Math.floor(s / 3600); s %= 3600; var m = Math.floor(s / 60);
    return (d ? d + "d " : "") + h + "h " + m + "m";
  }

  // ---- STATUS (polling) ----------------------------------------------------
  function applyStatus(j) {
    set("agent-state", "agente: ON");
    if (typeof j.cpu === "number" && j.cpu >= 0) { setBar("cpu-bar", "cpu-val", j.cpu); set("cpu-top", "CPU " + Math.round(j.cpu) + "%"); }
    if (j.mem) { setBar("ram-bar", "ram-val", j.mem.pct); set("mem-val", j.mem.used + " / " + j.mem.total + " MB"); }
    if (j.brightness && j.brightness.pct >= 0) setBar("bright-bar", "bright-val", j.brightness.pct);
    set("load-val", j.load || "--");
    if (typeof j.uptime === "number") set("uptime-val", fmtUptime(j.uptime));
    if (typeof j.temp === "number" && j.temp >= 0) { set("temp-val", Math.round(j.temp) + " °C"); set("temp-top", Math.round(j.temp) + " °C"); }
    if (j.battery) {
      var b = j.battery, tag = (b.pct >= 0 ? b.pct + "%" : "--") + (b.status ? " " + b.status : "") + (b.ac === 1 ? " ⚡" : "");
      set("bat-val", tag); set("battery", "BAT " + (b.pct >= 0 ? b.pct + "%" : "--") + (b.ac === 1 ? "⚡" : ""));
    }
    if (j.net && j.net.length) { set("net-iface", j.net[0].iface); set("net-ip", j.net[0].ip); }
    else { set("net-iface", "(sem rede)"); set("net-ip", "--"); }
  }
  function refresh() { getJSON("/api/status").then(applyStatus).catch(function () { set("agent-state", "agente: OFF"); }); }
  setInterval(refresh, 2000); refresh();

  // ---- DEVICE (lazy) -------------------------------------------------------
  function loadDevice() {
    getJSON("/api/device").then(function (j) {
      set("d-model", j.model); set("d-soc", j.soc);
      set("d-cpu", j.cpu.model + " · " + j.cpu.cores + " núcleos · " + j.cpu.arch);
      set("d-clock", (j.cpu.mhz_cur > 0 ? j.cpu.mhz_cur + " MHz" : "--") + (j.cpu.mhz_max > 0 ? " (máx " + j.cpu.mhz_max + ")" : ""));
      set("d-gpu", j.gpu); set("d-ram", j.ram_mb + " MB"); set("d-panel", j.panel); set("d-pmic", j.pmic);
      set("d-storage", (j.storage || []).map(function (s) { return s.dev + " " + s.gb + "GB"; }).join(" · ") || "--");
      set("d-kernel", j.kernel); set("d-os", j.os); set("d-host", j.host);
    }).catch(function () { set("d-model", "(agente offline)"); });
  }

  // ---- REDE (lazy) ---------------------------------------------------------
  function loadNetwork() {
    getJSON("/api/network").then(function (j) {
      var i = (j.interfaces && j.interfaces[0]) || {};
      set("net-iface", i.iface || "(sem rede)"); set("net-ip", i.ip || "--"); set("net-mac", i.mac || "--");
      set("net-gw", j.gateway || "--"); set("net-ssid", j.ssid || "(n/a)");
      set("net-dns", (j.dns || []).join(", ") || "--");
      set("net-routes", (j.routes || []).join("\n") || "(sem rotas)");
    }).catch(function () { set("net-routes", "(agente offline)"); });
  }

  // ---- LOGS (lazy) ---------------------------------------------------------
  function loadLogs() {
    set("logs-output", "(carregando…)");
    getJSON("/api/logs").then(function (j) { set("logs-output", j.dmesg || "(sem saída — dmesg vazio?)"); })
      .catch(function () { set("logs-output", "(agente offline)"); });
  }

  // ---- TERMINAL ------------------------------------------------------------
  function runCmd(cmd) {
    set("term-output", "$ " + cmd + "\n… executando …");
    postJSON("/api/exec", { cmd: cmd }).then(function (j) { set("term-output", "$ " + cmd + "\n" + (j.out || "(sem saída)")); })
      .catch(function () { set("term-output", "$ " + cmd + "\n(agente offline)"); });
  }

  // ---- FERRAMENTAS ---------------------------------------------------------
  function runAction(action) {
    set("tools-msg", "executando " + action + "…");
    postJSON("/api/action", { action: action }).then(function (j) { set("tools-msg", j.msg || (j.ok ? "ok" : "falhou")); })
      .catch(function () { set("tools-msg", "(agente offline)"); });
  }

  // Início
  show(0);
  console.log("[cyberdeck-ui] pronto — 640x480, gamepad + agente Node");
})();
