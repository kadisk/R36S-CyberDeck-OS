/* CyberDeck UI — lógica v1 (vanilla JS).
 * - troca de seções por abas (L1/R1 ou teclado)
 * - navegação por D-pad/A/B mapeados de teclado/Gamepad API
 * - dados do sistema: placeholder agora; agente local na Fase 5.
 * Sem dependências externas (cabe em WPE WebKit no R36S).
 */
(function () {
  "use strict";

  var SECTIONS = ["status", "network", "terminal", "logs", "tools", "device", "keys"];
  var current = 0;

  var tabs = Array.prototype.slice.call(document.querySelectorAll(".tab"));
  var panels = {};
  SECTIONS.forEach(function (id) { panels[id] = document.getElementById(id); });

  function show(index) {
    current = (index + SECTIONS.length) % SECTIONS.length;
    SECTIONS.forEach(function (id, i) {
      panels[id].hidden = i !== current;
      tabs[i].classList.toggle("active", i === current);
    });
    tabs[current].focus();
  }

  // ---- Diagnóstico de teclas (fase de captura: pega TUDO, antes da navegação) ----
  var ktLog = [];
  function ktFlash(sel, txt) {
    var el = document.getElementById(sel);
    if (!el) return;
    el.classList.add("hit");
    setTimeout(function () { el.classList.remove("hit"); }, 350);
  }
  document.addEventListener("keydown", function (e) {
    // rodapé global (visível em qualquer aba, mesmo sem navegar até TECLAS)
    var lk = document.getElementById("lastkey");
    if (lk) { lk.textContent = "tecla: " + e.key; lk.classList.add("hit");
      setTimeout(function () { lk.classList.remove("hit"); }, 350); }
    // painel TECLAS
    var k = document.getElementById("kt-key"); if (k) k.textContent = e.key;
    var d = document.getElementById("kt-detail");
    if (d) d.textContent = "code=" + e.code + "  keyCode=" + e.keyCode;
    var cell = document.querySelector('#kt-grid [data-k="' + e.key + '"]');
    if (cell) { cell.classList.add("hit"); setTimeout(function () { cell.classList.remove("hit"); }, 350); }
    var ts = new Date().toLocaleTimeString();
    ktLog.unshift(ts + "  key=" + e.key + "  code=" + e.code + "  keyCode=" + e.keyCode);
    ktLog = ktLog.slice(0, 12);
    var lg = document.getElementById("kt-log");
    if (lg) lg.textContent = ktLog.join("\n");
  }, true);

  // ---- Navegação por teclado (D-pad/gamepad mapeados p/ teclado) ----------
  document.addEventListener("keydown", function (e) {
    switch (e.key) {
      case "ArrowRight": case "PageDown": show(current + 1); break; // R1
      case "ArrowLeft":  case "PageUp":   show(current - 1); break; // L1
      case "Enter":                                                  // A
        var el = document.activeElement;
        if (el && el.tagName === "LI") el.classList.toggle("selected");
        break;
      case "Escape": show(0); break;                                 // B -> volta p/ status
      default: return;
    }
    e.preventDefault();
  });

  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { show(i); });
  });

  // ---- Gamepad API: NAVEGAÇÃO PRINCIPAL (Chromium expõe o joypad direto) ----
  // Mapeamento non-standard deste joypad = índices na ordem crescente do código
  // evdev (Fase 3). Confirmado: L1=4, R1=5. Verifique os índices na aba TECLAS.
  var GP_RAW = { B:0, A:1, X:2, Y:3, L1:4, R1:5, L2:6, R2:7, UP:8, DOWN:9, LEFT:10, RIGHT:11 };
  // Se o Chromium reportar mapping="standard", os índices mudam:
  var GP_STD = { A:0, B:1, X:2, Y:3, L1:4, R1:5, L2:6, R2:7, UP:12, DOWN:13, LEFT:14, RIGHT:15 };
  function mapFor(gp) { return gp.mapping === "standard" ? GP_STD : GP_RAW; }

  var prevButtons = [];
  function edge(gp, idx, fn) {
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
    var el = document.activeElement;
    if (el && el.tagName === "LI") el.classList.toggle("selected");
  }
  // diagnóstico: dump de todos os botões/eixos na aba TECLAS
  function dumpGamepad(gp) {
    var gpEl = document.getElementById("kt-gp");
    if (gpEl) gpEl.textContent = '"' + gp.id + '"  map=' + (gp.mapping || "raw");
    var bc = document.getElementById("kt-buttons");
    if (bc) {
      var h = "";
      for (var b = 0; b < gp.buttons.length; b++)
        h += '<span class="' + (gp.buttons[b] && gp.buttons[b].pressed ? "hit" : "") + '">' + b + "</span>";
      bc.innerHTML = h;
    }
    var ax = document.getElementById("kt-axes");
    if (ax) {
      var a = [];
      for (var j = 0; j < gp.axes.length; j++) a.push(j + ":" + gp.axes[j].toFixed(2));
      ax.textContent = "axes  " + a.join("  ");
    }
  }
  function pollGamepad() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var gp = pads && pads[0];
    if (gp) {
      dumpGamepad(gp);
      var M = mapFor(gp);
      edge(gp, M.R1,    function () { show(current + 1); });   // R1 -> próxima aba
      edge(gp, M.L1,    function () { show(current - 1); });   // L1 -> aba anterior
      edge(gp, M.RIGHT, function () { show(current + 1); });   // D-pad ← → também trocam aba
      edge(gp, M.LEFT,  function () { show(current - 1); });
      edge(gp, M.DOWN,  function () { moveFocus(1); });        // D-pad ↑↓ move foco no menu
      edge(gp, M.UP,    function () { moveFocus(-1); });
      edge(gp, M.A,     activate);                             // A -> confirmar
      edge(gp, M.B,     function () { show(0); });             // B -> volta p/ STATUS
    }
    requestAnimationFrame(pollGamepad);
  }
  if (navigator.getGamepads) requestAnimationFrame(pollGamepad);

  // ---- Relógio ------------------------------------------------------------
  function tickClock() {
    var d = new Date();
    var p = function (n) { return String(n).padStart(2, "0"); };
    var el = document.getElementById("clock");
    if (el) el.textContent = p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }
  setInterval(tickClock, 1000); tickClock();

  // ---- Dados do sistema (placeholder até o agente local existir) ----------
  // Na Fase 5: fetch("/api/status") ou WebSocket -> /proc, /sys, rk817.
  function setBar(barId, valId, pct) {
    var bar = document.getElementById(barId), val = document.getElementById(valId);
    if (bar) bar.style.width = Math.max(0, Math.min(100, pct)) + "%";
    if (val) val.textContent = Math.round(pct) + "%";
  }
  function refreshStub() {
    // Valores demonstrativos; substituir por dados reais.
    setBar("cpu-bar", "cpu-val", 8 + Math.random() * 6);
    setBar("ram-bar", "ram-val", 34 + Math.random() * 4);
    set("load-val", "0.12 0.08 0.05");
    set("temp-val", "42 °C");
    set("battery", "BAT 87%");
  }
  function set(id, txt) { var el = document.getElementById(id); if (el) el.textContent = txt; }
  setInterval(refreshStub, 2000); refreshStub();

  // Início
  show(0);
  console.log("[cyberdeck-ui] pronto — 640x480, navegação por botões");
})();
