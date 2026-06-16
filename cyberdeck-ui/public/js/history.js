/* history.js — ring buffers em memória p/ métricas (sessão). Alimentado pelo
 * polling de /api/status (app.js). Usado para sparklines de tendência (sem libs). */
(function () {
  "use strict";
  var MAX = 60;            // ~2 min a 2s de polling
  var buf = {};
  CD.history = {
    push: function (key, v) {
      v = Number(v);
      if (!isFinite(v)) return;
      var a = buf[key] || (buf[key] = []);
      a.push(v);
      if (a.length > MAX) a.shift();
    },
    get: function (key) { return buf[key] || []; },
    clear: function (key) { if (key) delete buf[key]; else buf = {}; },
  };
})();
