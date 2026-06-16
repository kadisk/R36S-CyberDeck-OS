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

  /* Navegação ESPACIAL (2D) por geometria: move o foco p/ o vizinho mais próximo
   * na direção dada (up/down/left/right). Funciona em grids (HOME), toolbars e listas.
   * Sem vizinho horizontal -> troca de aba (borda). Sem vizinho vertical -> fica. */
  function focusInto(el) { if (!el) return; try { el.focus(); el.scrollIntoView({ block: "nearest" }); } catch (e) {} }
  function move(dir) {
    if (confirmOpen()) return;
    hidePointer();                       // usar D-pad/setas -> modo FOCO (ponteiro some)
    var items = focusables();
    if (!items.length) { if (dir === "left") CD.nextTab(-1); else if (dir === "right") CD.nextTab(1); return; }
    var cur = document.activeElement;
    if (items.indexOf(cur) < 0) { focusInto(items[0]); return; }
    var cr = cur.getBoundingClientRect();
    var ccx = cr.left + cr.width / 2, ccy = cr.top + cr.height / 2;
    var best = null, bestScore = Infinity;
    for (var k = 0; k < items.length; k++) {
      var el = items[k]; if (el === cur) continue;
      var r = el.getBoundingClientRect();
      var dx = (r.left + r.width / 2) - ccx, dy = (r.top + r.height / 2) - ccy;
      var ok, primary, cross;
      if (dir === "left")  { ok = dx < -1; primary = -dx; cross = Math.abs(dy); }
      else if (dir === "right") { ok = dx > 1; primary = dx; cross = Math.abs(dy); }
      else if (dir === "up")    { ok = dy < -1; primary = -dy; cross = Math.abs(dx); }
      else  /* down */          { ok = dy > 1; primary = dy; cross = Math.abs(dx); }
      if (!ok) continue;
      var score = cross * 3 + primary;   // prioriza alinhamento no eixo cruzado
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) focusInto(best);
    else if (dir === "left") CD.nextTab(-1);
    else if (dir === "right") CD.nextTab(1);
    // up/down na borda: não faz nada
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

    // teclas globais (mídia/atalhos) — valem em qualquer estado
    switch (e.key) {
      case "AudioVolumeUp": CD.volume("volume-up"); e.preventDefault(); return;
      case "AudioVolumeDown": CD.volume("volume-down"); e.preventDefault(); return;
      case "AudioVolumeMute": CD.volume("volume-mute"); e.preventDefault(); return;
      case "F12": case "PrintScreen": CD.screenshot(); e.preventDefault(); return;
      case "+": case "=": CD.setFontScale(+0.1); e.preventDefault(); return;
      case "-": case "_": CD.setFontScale(-0.1); e.preventDefault(); return;
      default: break;
    }

    if (confirmOpen()) {
      if (e.key === "Enter" || e.key === " ") { CD.ui.resolveConfirm(true); e.preventDefault(); }
      else if (e.key === "Escape" || e.key === "Backspace") { CD.ui.resolveConfirm(false); e.preventDefault(); }
      return;
    }
    switch (e.key) {
      case "ArrowRight": move("right"); break;
      case "ArrowLeft": move("left"); break;
      case "ArrowDown": move("down"); break;
      case "ArrowUp": move("up"); break;
      case "Tab": moveFocus(e.shiftKey ? -1 : 1); break;
      case "Enter": activate(); break;
      case "Escape": case "Backspace": CD.back(); break;
      case "PageDown": scrollContent(120); break;
      case "PageUp": scrollContent(-120); break;
      default: return;
    }
    e.preventDefault();
  });

  function scrollContent(dy) { var c = document.getElementById("content"); if (c) c.scrollTop += dy; }

  /* ---- DOIS modos de input: FOCO (D-pad) e PONTEIRO (analógico) ----
   * - D-pad/setas  -> modo FOCO: ponteiro some; A ativa o item SELECIONADO.
   * - analógico esq -> modo PONTEIRO: ponteiro reaparece, faz hover-select; A clica nele.
   * - sem mexer no analógico por um tempo -> ponteiro some (volta ao modo foco).
   * O ponteiro é o REAL do X (driver joystick); aqui só o mostramos/escondemos (CSS)
   * e rastreamos via mousemove. */
  var px = window.innerWidth / 2, py = window.innerHeight / 2;
  var pointerVisible = false, hideTimer = null;
  var HIDE_MS = 2800;
  var startT = Date.now(), lpx = NaN, lpy = NaN;   // p/ ignorar mousemove sintético do boot
  // ponteiro começa ESCONDIDO (CSS default: cursor:none); só aparece com .pointer-on
  function setPointer(on) {
    if (pointerVisible === on) return;
    pointerVisible = on;
    document.body.classList.toggle("pointer-on", on);
  }
  function showPointer() {
    setPointer(true);
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { setPointer(false); }, HIDE_MS);
  }
  function hidePointer() { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } setPointer(false); }
  function focusableUnder(x, y) {
    var el = document.elementFromPoint(x, y);
    while (el && el !== document.body) { if (el.getAttribute && el.getAttribute("data-focus")) return el; el = el.parentElement; }
    return null;
  }
  document.addEventListener("mousemove", function (e) {
    var nx = e.clientX, ny = e.clientY;
    // 1º evento, ou nos primeiros ~1s (mousemove sintético do boot): só registra, não mostra
    if (isNaN(lpx) || Date.now() - startT < 1000) { lpx = nx; lpy = ny; px = nx; py = ny; return; }
    var moved = Math.abs(nx - lpx) + Math.abs(ny - lpy);
    lpx = nx; lpy = ny; px = nx; py = ny;
    if (moved < 2) return;                           // micro-jitter: ignora (não mostra o ponteiro)
    showPointer();                                   // movimento REAL do analógico -> modo ponteiro
    var f = focusableUnder(px, py);                  // hover-select: foca o que está sob o ponteiro
    if (f && f !== document.activeElement) { try { f.focus(); } catch (e2) {} }
  });
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
  var comboShot = false;
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

      // combo L1+R1 = screenshot (dispara uma vez por aperto, sem conflito com botões soltos)
      var l1 = gp.buttons[M.L1] && gp.buttons[M.L1].pressed;
      var r1 = gp.buttons[M.R1] && gp.buttons[M.R1].pressed;
      if (l1 && r1) { if (!comboShot) { comboShot = true; CD.screenshot(); } } else { comboShot = false; }

      // A: se o ponteiro real foi movido há pouco, clica nele (como um mouse);
      // senão, ativa o item focado (navegação por D-pad).
      edge(gp, M.A, function () { if (confirmOpen()) CD.ui.resolveConfirm(true); else if (pointerVisible) { if (!clickAtPointer()) activate(); } else activate(); });
      edge(gp, M.B, function () { if (confirmOpen()) CD.ui.resolveConfirm(false); else CD.back(); });
      edge(gp, M.START, function () { if (!confirmOpen()) activate(); });
      edge(gp, M.SELECT, function () { if (confirmOpen()) CD.ui.resolveConfirm(false); else CD.back(); });
      edge(gp, M.RIGHT, function () { move("right"); });
      edge(gp, M.LEFT, function () { move("left"); });
      edge(gp, M.DOWN, function () { move("down"); });
      edge(gp, M.UP, function () { move("up"); });

      // O analógico ESQUERDO NÃO é lido aqui — quem move o ponteiro é o driver do X.
      // Só o analógico direito faz scroll na UI.
      var ax = gp.axes || [], DZ = 0.20, SS = 18;
      var ry = ax[3] || 0;
      if (Math.abs(ry) > DZ) doScroll(ry * SS);
    }
    requestAnimationFrame(poll);
  }
  if (navigator.getGamepads) requestAnimationFrame(poll);

  CD.input = { moveFocus: moveFocus, move: move, activate: activate };
})();
