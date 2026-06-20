/* gamepad.js — camada de input: teclado (dev), Gamepad API (R36S),
 * cursor virtual (analógico esq.) e scroll (analógico dir.).
 * Foco: elementos [data-focus] visíveis da view ativa. */
(function () {
  "use strict";

  function fnOpen() { return CD.fn && CD.fn.isOpen(); }
  function activeEl() {
    if (fnOpen()) return document.getElementById("fnmenu");   // menu FN é o escopo de foco quando aberto
    var v = CD.views[CD.state.section]; return v && v.el;
  }
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
  function activeTabEl() { return document.querySelector("#tabs .tab.active"); }
  function isTab(el) { return el && el.classList && el.classList.contains("tab"); }
  function move(dir) {
    if (confirmOpen()) return;
    hidePointer();                       // usar D-pad/setas -> modo FOCO (ponteiro some)
    if (fnOpen()) { if (dir === "up" || dir === "down") moveFocus(dir === "down" ? 1 : -1); return; }  // navega só no menu FN
    var cur = document.activeElement;
    // ---- foco NA BARRA DE ABAS (menu superior) ----
    if (isTab(cur)) {
      if (dir === "left" || dir === "right") { CD.nextTab(dir === "right" ? 1 : -1); var nt = activeTabEl(); if (nt) nt.focus(); }
      else if (dir === "down") { var f0 = focusables()[0]; if (f0) focusInto(f0); }
      // up: já está no topo, não faz nada
      return;
    }
    var items = focusables();
    if (!items.length) { if (dir === "left") CD.nextTab(-1); else if (dir === "right") CD.nextTab(1); else if (dir === "up") { var t0 = activeTabEl(); if (t0) t0.focus(); } return; }
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
    else if (dir === "up") { var t = activeTabEl(); if (t) t.focus(); }   // topo do conteúdo -> menu superior
    // down na borda: não faz nada
  }
  function activate() {
    var el = document.activeElement;
    if (el && el !== document.body && el.click) el.click();
  }

  /* ---- confirm interception ---- */
  function confirmOpen() { return !!CD.pendingConfirm; }

  /* ---- teclado (USB / desenvolvimento no PC) ---- */
  // mapa tecla -> botão exibido na view KEYS (para acender a célula no teste pelo teclado)
  var KB2BTN = { ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Enter: "A", Escape: "B" };
  document.addEventListener("keydown", function (e) {
    // diagnóstico (rodapé + view KEYS, se presente)
    var lk = document.getElementById("lastkey");
    if (lk) { lk.textContent = "tecla: " + e.key; lk.classList.add("hit"); setTimeout(function () { lk.classList.remove("hit"); }, 300); }
    var kk = document.getElementById("kt-key"); if (kk) kk.textContent = e.key;
    var kd = document.getElementById("kt-detail"); if (kd) kd.textContent = "code=" + e.code + " keyCode=" + e.keyCode;
    var nm = KB2BTN[e.key];
    var cell = nm && document.querySelector('#view-keys [data-btn="' + nm + '"]');
    if (cell) { cell.classList.add("hit"); setTimeout(function () { cell.classList.remove("hit"); }, 300); }

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
    // menu FUNCTION aberto: navega só nele
    if (fnOpen()) {
      if (e.key === "Escape" || e.key === "Backspace" || e.key === "f" || e.key === "F") CD.fn.close();
      else if (e.key === "Enter" || e.key === " ") activate();
      else if (e.key === "ArrowDown") move("down");
      else if (e.key === "ArrowUp") move("up");
      e.preventDefault(); return;
    }
    switch (e.key) {
      case "ArrowRight": move("right"); break;
      case "ArrowLeft": move("left"); break;
      case "ArrowDown": move("down"); break;
      case "ArrowUp": move("up"); break;
      case "Tab": moveFocus(e.shiftKey ? -1 : 1); break;
      case "Enter": activate(); break;
      case "f": case "F": if (CD.fn) CD.fn.toggle(); break;   // FN (dev)
      case "Escape": case "Backspace": CD.back(); break;
      case "[": CD.subCycle(-1); break;     // subpágina anterior (dev)
      case "]": CD.subCycle(1); break;      // próxima subpágina (dev)
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
  // só clica se houver um FOCÁVEL sob o ponteiro; senão devolve false p/ ativar o foco atual
  function clickAtPointer() {
    var el = focusableUnder(px, py); if (!el) return false;
    try { el.focus(); } catch (e) {}
    el.click(); return true;
  }
  CD.hidePointer = function () { hidePointer(); };   // usado pelo router ao trocar de seção
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
  var GP_RAW = { B: 0, A: 1, X: 2, Y: 3, L1: 4, R1: 5, R2: 6, L2: 7, UP: 8, DOWN: 9, LEFT: 10, RIGHT: 11, SELECT: 12, START: 13, FN: 16 };
  var GP_STD = { A: 0, B: 1, X: 2, Y: 3, L1: 4, R1: 5, L2: 6, R2: 7, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
  function mapFor(gp) { return gp.mapping === "standard" ? GP_STD : GP_RAW; }
  var prev = [];
  var comboShot = false;
  var ktExit = false;   // debounce do combo Start+Select p/ sair do teste de botões
  function edge(gp, idx, fn) {
    if (idx == null) return;
    var p = gp.buttons[idx] && gp.buttons[idx].pressed;
    if (p && !prev[idx]) fn();
    prev[idx] = p;
  }
  // nome exibido na tela KEYS -> chave do mapa de índices (GP_RAW/GP_STD)
  var KT_NAME2KEY = { "A": "A", "B": "B", "X": "X", "Y": "Y", "L1": "L1", "R1": "R1", "L2": "L2", "R2": "R2",
    "Select": "SELECT", "Start": "START", "FN": "FN", "↑": "UP", "↓": "DOWN", "←": "LEFT", "→": "RIGHT" };
  function dump(gp) {
    var g = document.getElementById("kt-gp"); if (g) g.textContent = '"' + gp.id + '" · map=' + (gp.mapping || "raw") + " · " + gp.buttons.length + " botões";
    var M = mapFor(gp);
    for (var name in KT_NAME2KEY) {
      var cell = document.querySelector('#view-keys [data-btn="' + name + '"]');
      if (!cell) continue;
      var idx = M[KT_NAME2KEY[name]];
      cell.classList.toggle("hit", idx != null && !!(gp.buttons[idx] && gp.buttons[idx].pressed));
    }
    var f = function (v) { return (v >= 0 ? "+" : "") + v.toFixed(2); };
    var ls = document.getElementById("kt-lstick"); if (ls && gp.axes.length >= 2) ls.textContent = "x " + f(gp.axes[0]) + " · y " + f(gp.axes[1]);
    var rs = document.getElementById("kt-rstick"); if (rs && gp.axes.length >= 4) rs.textContent = "x " + f(gp.axes[2]) + " · y " + f(gp.axes[3]);
    var ax = document.getElementById("kt-axes");
    if (ax) {
      var a = []; for (var j = 0; j < gp.axes.length; j++) a.push(j + ":" + gp.axes[j].toFixed(2));
      var pressed = []; for (var b = 0; b < gp.buttons.length; b++) if (gp.buttons[b].pressed) pressed.push(b);
      ax.textContent = "axes " + a.join("  ") + "\nbotões idx: " + (pressed.join(", ") || "—");
    }
  }
  function poll() {
    var pads = navigator.getGamepads ? navigator.getGamepads() : [];
    var gp = pads && pads[0];
    if (gp) {
      var M = mapFor(gp);
      // tela de teste de botões: captura TODOS os botões (só acende as células).
      // Nenhuma ação de navegação dispara; sai com Start+Select juntos.
      // ATENÇÃO: todas as views ficam SEMPRE no DOM (troca = classe .active),
      // então é obrigatório testar .active — testar só a existência do elemento
      // mataria a navegação em TODAS as telas (bug v0.8.0).
      var kv = document.getElementById("view-keys");
      if (kv && kv.classList.contains("active")) {
        dump(gp);
        var st = gp.buttons[M.START] && gp.buttons[M.START].pressed;
        var se = gp.buttons[M.SELECT] && gp.buttons[M.SELECT].pressed;
        if (st && se) { if (!ktExit) { ktExit = true; CD.back(); } } else { ktExit = false; }
        prev = []; // evita que soltar os botões dispare edges ao sair
        return;
      }

      // combo L2+R2 = screenshot (L1/R1 ficam livres p/ trocar subpágina, sem conflito)
      var l2 = gp.buttons[M.L2] && gp.buttons[M.L2].pressed;
      var r2 = gp.buttons[M.R2] && gp.buttons[M.R2].pressed;
      if (l2 && r2) { if (!comboShot) { comboShot = true; CD.screenshot(); } } else { comboShot = false; }
      // L1/R1 = trocar subpágina da seção ativa
      edge(gp, M.L1, function () { if (!confirmOpen()) CD.subCycle(-1); });
      edge(gp, M.R1, function () { if (!confirmOpen()) CD.subCycle(1); });

      // A: se o ponteiro real foi movido há pouco, clica nele (como um mouse);
      // senão, ativa o item focado (navegação por D-pad).
      edge(gp, M.A, function () { if (confirmOpen()) CD.ui.resolveConfirm(true); else if (pointerVisible) { if (!clickAtPointer()) activate(); } else activate(); });
      edge(gp, M.B, function () { if (confirmOpen()) CD.ui.resolveConfirm(false); else if (fnOpen()) CD.fn.close(); else CD.back(); });
      edge(gp, M.START, function () { if (!confirmOpen()) activate(); });
      edge(gp, M.SELECT, function () { if (confirmOpen()) CD.ui.resolveConfirm(false); else if (fnOpen()) CD.fn.close(); else CD.back(); });
      edge(gp, M.FN, function () { if (!confirmOpen() && CD.fn) CD.fn.toggle(); });   // FN abre/fecha o menu FUNCTION
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
