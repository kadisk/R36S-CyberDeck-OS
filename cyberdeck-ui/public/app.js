/* CyberDeck UI — vanilla JS, sem deps.
 * Navegação: D-pad (abas ←→ / foco ↑↓), A = ok/clique, B = voltar.
 * Analógico ESQ = cursor virtual (A clica onde aponta); analógico DIR = scroll.
 * Dados ao vivo do cyberdeck-agent (Node, 127.0.0.1:8080). L1/R1 NÃO navegam.
 */
(function () {
  "use strict";

  var AGENT = "http://127.0.0.1:8080";
  var SECTIONS = ["status", "device", "network", "logs", "terminal", "tools", "systemd", "keys"];
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
    onShow(id);
    var first = panels[id].querySelector("[tabindex]");
    if (first) first.focus(); else tabs[current].focus();
  }
  function onShow(id) {
    if (id === "device") loadDevice();
    else if (id === "network") loadNetwork();
    else if (id === "logs") loadLogs();
    else if (id === "systemd") loadSystemd();
    else if (id === "terminal") termShowList();
  }
  function back() {
    if (SECTIONS[current] === "terminal" && termMode()) { termShowList(); return; }
    show(0);
  }

  tabs.forEach(function (t, i) { t.addEventListener("click", function () { show(i); }); });

  // ---- Diagnóstico de teclas (captura) ------------------------------------
  var ktLog = [];
  document.addEventListener("keydown", function (e) {
    var lk = document.getElementById("lastkey");
    if (lk) { lk.textContent = "tecla: " + e.key; lk.classList.add("hit");
      setTimeout(function () { lk.classList.remove("hit"); }, 350); }
    set("kt-key", e.key);
    set("kt-detail", "code=" + e.code + "  keyCode=" + e.keyCode);
    var cell = document.querySelector('#kt-grid [data-k="' + e.key + '"]');
    if (cell) { cell.classList.add("hit"); setTimeout(function () { cell.classList.remove("hit"); }, 350); }
    ktLog.unshift(new Date().toLocaleTimeString() + "  key=" + e.key + "  code=" + e.code);
    ktLog = ktLog.slice(0, 12); set("kt-log", ktLog.join("\n"));
  }, true);

  // ---- Navegação por teclado (USB) — setas só (sem PageUp/Down) ------------
  document.addEventListener("keydown", function (e) {
    switch (e.key) {
      case "ArrowRight": show(current + 1); break;
      case "ArrowLeft":  show(current - 1); break;
      case "ArrowDown":  moveFocus(1); break;
      case "ArrowUp":    moveFocus(-1); break;
      case "Enter":      activate(); break;
      case "Escape":     back(); break;
      default: return;
    }
    e.preventDefault();
  });

  // ---- Cursor virtual + scroll (analógicos) -------------------------------
  var vc = document.getElementById("vcursor");
  var cx = 320, cy = 240, lastMove = 0;
  function placeCursor() { if (vc) vc.style.transform = "translate(" + cx + "px," + cy + "px)"; }
  function moveCursor(dx, dy) {
    cx = Math.max(0, Math.min(window.innerWidth - 2, cx + dx));
    cy = Math.max(0, Math.min(window.innerHeight - 2, cy + dy));
    if (vc) vc.classList.add("on"); lastMove = Date.now(); placeCursor();
  }
  function cursorActive() { return Date.now() - lastMove < 1500; }
  function cursorClick() {
    var el = document.elementFromPoint(cx, cy); if (!el) return;
    try { if (el.focus) el.focus(); } catch (e) {}
    el.click();
    if (vc) { vc.classList.add("click"); setTimeout(function () { vc.classList.remove("click"); }, 150); }
  }
  function scrollTarget() {
    var el = document.elementFromPoint(cx, cy) || panels[SECTIONS[current]];
    while (el && el !== document.body) {
      var cs;
      try { cs = getComputedStyle(el); } catch (e) { cs = {}; }
      if ((el.scrollHeight > el.clientHeight && /(auto|scroll)/.test(cs.overflowY || "")) ||
          (el.scrollWidth > el.clientWidth && /(auto|scroll)/.test(cs.overflowX || ""))) return el;
      el = el.parentElement;
    }
    return document.getElementById("content");
  }
  function doScroll(dx, dy) { var el = scrollTarget(); if (!el) return; el.scrollTop += dy; el.scrollLeft += dx; }
  placeCursor();

  // ---- Gamepad API: navegação principal (L1/R1 NÃO navegam) ---------------
  // Índices confirmados: A=1,X=2,Y=3,L1=4,R1=5,R2=6,↑=8,↓=9,←=10,→=11,Select=12,
  // Start=13,Fn=16,B=0. Eixos: 0=esqX,1=esqY,2=dirX,3=dirY.
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
      gedge(gp, M.RIGHT, function () { show(current + 1); });   // só D-pad ←→ troca aba
      gedge(gp, M.LEFT,  function () { show(current - 1); });
      gedge(gp, M.DOWN,  function () { moveFocus(1); });
      gedge(gp, M.UP,    function () { moveFocus(-1); });
      gedge(gp, M.A,     function () { if (cursorActive()) cursorClick(); else activate(); });
      gedge(gp, M.START, activate);
      gedge(gp, M.B,      back);
      gedge(gp, M.SELECT, back);

      // analógicos: esq = cursor, dir = scroll
      var ax = gp.axes || [], DZ = 0.20, CS = 9, SS = 16;
      var lx = ax[0] || 0, ly = ax[1] || 0, rx = ax[2] || 0, ry = ax[3] || 0;
      if (Math.abs(lx) > DZ || Math.abs(ly) > DZ)
        moveCursor((Math.abs(lx) > DZ ? lx : 0) * CS, (Math.abs(ly) > DZ ? ly : 0) * CS);
      if (Math.abs(rx) > DZ || Math.abs(ry) > DZ)
        doScroll((Math.abs(rx) > DZ ? rx : 0) * SS, (Math.abs(ry) > DZ ? ry : 0) * SS);
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

  // ---- fetch helpers -------------------------------------------------------
  function getJSON(p) { return fetch(AGENT + p, { cache: "no-store" }).then(function (r) { return r.json(); }); }
  function postJSON(p, body) {
    return fetch(AGENT + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
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
      var b = j.battery;
      set("bat-val", (b.pct >= 0 ? b.pct + "%" : "--") + (b.status ? " " + b.status : "") + (b.ac === 1 ? " ⚡" : ""));
      set("bat-volt", (b.volt > 0 ? b.volt + " V" : "--") + (b.curr !== -1 ? " · " + b.curr + " mA" : "") + (b.est >= 0 ? " · ~" + b.est + "% (tensão)" : ""));
      set("battery", "BAT " + (b.pct >= 0 ? b.pct + "%" : "--") + (b.ac === 1 ? "⚡" : ""));
    }
    if (j.net && j.net.length) { set("net-iface", j.net[0].iface); set("net-ip", j.net[0].ip); }
  }
  function refresh() { getJSON("/api/status").then(applyStatus).catch(function () { set("agent-state", "agente: OFF"); }); }
  setInterval(refresh, 2000); refresh();

  // ---- atualização automática das abas "vivas" ----------------------------
  setInterval(function () {
    var id = SECTIONS[current];
    if (id === "logs") loadLogs();
    else if (id === "systemd") loadSystemd();
  }, 4000);

  // ---- DEVICE --------------------------------------------------------------
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

  // ---- REDE ----------------------------------------------------------------
  function loadNetwork() {
    getJSON("/api/network").then(function (j) {
      var i = (j.interfaces && j.interfaces[0]) || {};
      set("net-iface", i.iface || "(sem rede)"); set("net-ip", i.ip || "--"); set("net-mac", i.mac || "--");
      set("net-gw", j.gateway || "--"); set("net-ssid", j.ssid || "(n/a)");
      set("net-dns", (j.dns || []).join(", ") || "--");
      set("net-routes", (j.routes || []).join("\n") || "(sem rotas)");
    }).catch(function () { set("net-routes", "(agente offline)"); });
  }

  // ---- LOGS (últimos, rola p/ o fim, atualiza sozinho) --------------------
  function loadLogs() {
    getJSON("/api/logs").then(function (j) {
      var el = document.getElementById("logs-output");
      el.textContent = j.dmesg || j.journal || "(sem saída)";
      el.scrollTop = el.scrollHeight; // mostra os ÚLTIMOS
    }).catch(function () { set("logs-output", "(agente offline)"); });
  }

  // ---- SERVIÇOS (systemd) --------------------------------------------------
  function loadSystemd() {
    getJSON("/api/systemd").then(function (j) {
      set("sd-state", j.state);
      set("sd-count", j.total + " serviços · " + ((j.running || []).length) + " rodando · " + ((j.failed || []).length) + " falhos");
      set("sd-boot", j.boot || "--");
      set("sd-failed", (j.failed && j.failed.length) ? j.failed.join("\n") : "(nenhum)");
      set("sd-running", (j.running || []).join("\n") || "--");
    }).catch(function () { set("sd-state", "(agente offline)"); });
  }

  // ---- TERMINAL (saída em tela cheia; B volta à lista) --------------------
  function termMode() { return !document.getElementById("term-out-wrap").hidden; }
  function termShowList() {
    document.getElementById("term-list-wrap").hidden = false;
    document.getElementById("term-out-wrap").hidden = true;
    var f = document.querySelector("#term-list [tabindex]"); if (f) f.focus();
  }
  function termShowOut(cmd) {
    document.getElementById("term-list-wrap").hidden = true;
    document.getElementById("term-out-wrap").hidden = false;
    set("term-cmd", "$ " + cmd);
  }
  function runCmd(cmd) {
    termShowOut(cmd); set("term-output", "… executando …");
    postJSON("/api/exec", { cmd: cmd }).then(function (j) {
      var o = document.getElementById("term-output"); o.textContent = j.out || "(sem saída)"; o.scrollTop = 0;
    }).catch(function () { set("term-output", "(agente offline)"); });
  }

  // ---- FERRAMENTAS ---------------------------------------------------------
  function runAction(action) {
    set("tools-msg", "executando " + action + "…");
    postJSON("/api/action", { action: action }).then(function (j) { set("tools-msg", j.msg || (j.ok ? "ok" : "falhou")); })
      .catch(function () { set("tools-msg", "(agente offline)"); });
  }

  // cliques (cursor virtual / mouse / toque) nos itens de menu
  Array.prototype.forEach.call(document.querySelectorAll("[data-cmd]"), function (li) {
    li.addEventListener("click", function () { runCmd(li.dataset.cmd); });
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-action]"), function (li) {
    li.addEventListener("click", function () { runAction(li.dataset.action); });
  });

  // Início
  show(0);
  console.log("[cyberdeck-ui] pronto — gamepad + cursor analógico + agente Node");
})();
