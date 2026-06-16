/* gamepad.js — camada de input: teclado (dev), Gamepad API (R36S),
 * cursor virtual (analógico esq.) e scroll (analógico dir.).
 * Foco: elementos [data-focus] visíveis da view ativa. */
(function () {
  "use strict";

  function activeEl() { var v = CD.views[CD.state.section]; return v && v.el; }
  function focusables() {
    var root = activeEl(); if (!root) return [];
    return Array.prototype.slice.call(root.querySelectorAll("[data-focus]")).filter(function (e) {
      return e.offsetParent !== null || e.getClientRects().length; // visível
    });
  }
  function moveFocus(dir) {
    var items = focusables(); if (!items.length) return;
    var i = items.indexOf(document.activeElement);
    i = (i < 0 ? (dir > 0 ? 0 : items.length - 1) : i + dir + items.length) % items.length;
    items[i].focus();
    try { items[i].scrollIntoView({ block: "nearest" }); } catch (e) {}
  }
  function activate() {
    var el = document.activeElement;
    if (el && el !== document.body && el.click) el.click();
  }

  /* ---- confirm interception ---- */
  function confirmOpen() { return !!CD.pendingConfirm; }

  /* ---- teclado (USB / desenvolvimento no PC) ---- */
  var ktLog = [];
  document.addEventListener("keydown", function (e) {
    // diagnóstico (rodapé + view KEYS, se presente)
    var lk = document.getElementById("lastkey");
    if (lk) { lk.textContent = "tecla: " + e.key; lk.classList.add("hit"); setTimeout(function () { lk.classList.remove("hit"); }, 300); }
    var kk = document.getElementById("kt-key"); if (kk) kk.textContent = e.key;
    var kd = document.getElementById("kt-detail"); if (kd) kd.textContent = "code=" + e.code + " keyCode=" + e.keyCode;
    var cell = document.querySelector('#view-keys [data-k="' + e.key + '"]');
    if (cell) { cell.classList.add("hit"); setTimeout(function () { cell.classList.remove("hit"); }, 300); }
    var klog = document.getElementById("kt-log");
    if (klog) { ktLog.unshift(new Date().toLocaleTimeString() + "  " + e.key + " (" + e.code + ")"); ktLog = ktLog.slice(0, 12); klog.textContent = ktLog.join("\n"); }

    if (confirmOpen()) {
      if (e.key === "Enter" || e.key === " ") { CD.ui.resolveConfirm(true); e.preventDefault(); }
      else if (e.key === "Escape" || e.key === "Backspace") { CD.ui.resolveConfirm(false); e.preventDefault(); }
      return;
    }
    switch (e.key) {
      case "ArrowRight": CD.nextTab(1); break;
      case "ArrowLeft": CD.nextTab(-1); break;
      case "ArrowDown": case "Tab": moveFocus(1); break;
      case "ArrowUp": moveFocus(-1); break;
      case "Enter": activate(); break;
      case "Escape": case "Backspace": CD.back(); break;
      case "PageDown": scrollContent(120); break;
      case "PageUp": scrollContent(-120); break;
      default: return;
    }
    e.preventDefault();
  });

  function scrollContent(dy) { var c = document.getElementById("content"); if (c) c.scrollTop += dy; }

  /* ---- ponteiro REAL do X + scroll ----
   * O analógico ESQUERDO move o ponteiro real do X (driver joystick do Xorg, fora do
   * browser). A UI só RASTREIA esse ponteiro via mousemove p/ o A clicar onde ele está. */
  var px = window.innerWidth / 2, py = window.innerHeight / 2, lastMove = 0;
  document.addEventListener("mousemove", function (e) { px = e.clientX; py = e.clientY; lastMove = Date.now(); });
  function pointerActive() { return Date.now() - lastMove < 2500; }
  function clickAtPointer() {
    var el = document.elementFromPoint(px, py); if (!el) return false;
    try { if (el.focus) el.focus(); } catch (e) {}
    el.click(); return true;
  }
  function scrollTarget() {
    var el = document.elementFromPoint(px, py) || activeEl();
    while (el && el !== document.body) {
      var cs; try { cs = getComputedStyle(el); } catch (e) { cs = {}; }
      if (el.scrollHeight > el.clientHeight && /(auto|scroll)/.test(cs.overflowY || "")) return el;
      el = el.parentElement;
    }
    return document.getElementById("content");
  }
  function doScroll(dy) { var el = scrollTarget(); if (el) el.scrollTop += dy; }

  /* ---- Gamepad API (R36S: odroidgo3-joypad) ---- */
  // RAW (confirmado no R36S): B=0,A=1,X=2,Y=3,L1=4,R1=5,↑=8,↓=9,←=10,→=11,Select=12,Start=13,Fn=16
  var GP_RAW = { B: 0, A: 1, X: 2, Y: 3, L1: 4, R1: 5, UP: 8, DOWN: 9, LEFT: 10, RIGHT: 11, SELECT: 12, START: 13 };
  var GP_STD = { A: 0, B: 1, X: 2, Y: 3, L1: 4, R1: 5, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
  function mapFor(gp) { return gp.mapping === "standard" ? GP_STD : GP_RAW; }
  var prev = [];
  function edge(gp, idx, fn) {
    if (idx == null) return;
    var p = gp.buttons[idx] && gp.buttons[idx].pressed;
    if (p && !prev[idx]) fn();
    prev[idx] = p;
  }
  function dump(gp) {
    var g = document.getElementById("kt-gp"); if (g) g.textContent = '"' + gp.id + '" map=' + (gp.mapping || "raw");
    var bc = document.getElementById("kt-buttons");
    if (bc) { var s = ""; for (var b = 0; b < gp.buttons.length; b++) s += '<span class="' + (gp.buttons[b].pressed ? "hit" : "") + '">' + b + "</span>"; bc.innerHTML = s; }
    var ax = document.getElementById("kt-axes");
    if (ax) { var a = []; for (var j = 0; j < gp.axes.length; j++) a.push(j + ":" + gp.axes[j].toFixed(2)); ax.textContent = "axes " + a.join(" "); }
  }
  function poll() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var gp = pads && pads[0];
    if (gp) {
      if (document.getElementById("view-keys")) dump(gp);
      var M = mapFor(gp);
      // A: se o ponteiro real foi movido há pouco, clica nele (como um mouse);
      // senão, ativa o item focado (navegação por D-pad).
      edge(gp, M.A, function () { if (confirmOpen()) CD.ui.resolveConfirm(true); else if (pointerActive()) clickAtPointer(); else activate(); });
      edge(gp, M.B, function () { if (confirmOpen()) CD.ui.resolveConfirm(false); else CD.back(); });
      edge(gp, M.START, function () { if (!confirmOpen()) activate(); });
      edge(gp, M.SELECT, function () { if (confirmOpen()) CD.ui.resolveConfirm(false); else CD.back(); });
      edge(gp, M.RIGHT, function () { if (!confirmOpen()) CD.nextTab(1); });
      edge(gp, M.LEFT, function () { if (!confirmOpen()) CD.nextTab(-1); });
      edge(gp, M.DOWN, function () { if (!confirmOpen()) moveFocus(1); });
      edge(gp, M.UP, function () { if (!confirmOpen()) moveFocus(-1); });

      // O analógico ESQUERDO NÃO é lido aqui — quem move o ponteiro é o driver do X.
      // Só o analógico direito faz scroll na UI.
      var ax = gp.axes || [], DZ = 0.20, SS = 18;
      var ry = ax[3] || 0;
      if (Math.abs(ry) > DZ) doScroll(ry * SS);
    }
    requestAnimationFrame(poll);
  }
  if (navigator.getGamepads) requestAnimationFrame(poll);

  CD.input = { moveFocus: moveFocus, activate: activate };
})();
