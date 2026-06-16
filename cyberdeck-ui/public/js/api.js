/* api.js — cliente do cyberdeck-agent. Desempacota {ok,data}, trata erros e
 * marca o agente online/offline. Timeout via AbortController p/ não travar a UI. */
(function () {
  "use strict";

  function req(path, opts) {
    opts = opts || {};
    var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, opts.timeout || 9000) : null;
    var init = { cache: "no-store" };
    if (ctrl) init.signal = ctrl.signal;
    if (opts.method) init.method = opts.method;
    if (opts.body != null) { init.body = JSON.stringify(opts.body); init.headers = { "Content-Type": "application/json" }; }

    return fetch(CD.AGENT + path, init)
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: { code: "BAD_JSON", message: "resposta inválida" } }; }); })
      .then(function (j) {
        CD.setAgent(true);
        if (j && j.ok) return j.data;
        var e = new Error((j && j.error && j.error.message) || "erro do agente");
        e.code = (j && j.error && j.error.code) || "ERR";
        e.business = true; // erro de regra (não é o agente offline)
        throw e;
      })
      .catch(function (e) {
        if (!e.business) CD.setAgent(false); // erro de rede/timeout => agente offline
        throw e;
      })
      .then(function (v) { if (timer) clearTimeout(timer); return v; }, function (e) { if (timer) clearTimeout(timer); throw e; });
  }

  CD.api = {
    get: function (path, opts) { return req(path, opts || {}); },
    post: function (path, body, opts) { opts = opts || {}; opts.method = "POST"; opts.body = body || {}; return req(path, opts); },
  };
})();
