/* CyberDeck UI — lógica v1 (vanilla JS).
 * - troca de seções por abas (L1/R1 ou teclado)
 * - navegação por D-pad/A/B mapeados de teclado/Gamepad API
 * - dados do sistema: placeholder agora; agente local na Fase 5.
 * Sem dependências externas (cabe em WPE WebKit no R36S).
 */
(function () {
  "use strict";

  var SECTIONS = ["status", "network", "terminal", "logs", "tools", "device"];
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

  // ---- Gamepad API (quando o runtime expõe o joypad) ----------------------
  var prevButtons = [];
  function pollGamepad() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var gp = pads && pads[0];
    if (gp) {
      // Mapeamento provisório; ajustar com evtest no aparelho (Fase 3).
      // Botões shoulder (4=L1, 5=R1) trocam de aba.
      edge(gp, 5, function () { show(current + 1); });
      edge(gp, 4, function () { show(current - 1); });
    }
    requestAnimationFrame(pollGamepad);
  }
  function edge(gp, idx, fn) {
    var pressed = gp.buttons[idx] && gp.buttons[idx].pressed;
    if (pressed && !prevButtons[idx]) fn();
    prevButtons[idx] = pressed;
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
