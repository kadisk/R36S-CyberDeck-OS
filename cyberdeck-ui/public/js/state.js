/* state.js — namespace global + estado central simples da aplicação.
 * Sem framework: estado é um objeto plano; as views leem/escrevem nele. */
(function () {
  "use strict";
  window.CD = window.CD || {};

  CD.AGENT = "http://127.0.0.1:8080";

  CD.state = {
    section: "welcome",     // aba ativa
    agent: "unknown",       // "on" | "off" | "unknown"
    fontScale: 1,           // escala de fonte do conteúdo (0.7–1.8), persistida no agente
    fullscreen: false,
    sub: {},                // índice da subpágina por seção (L1/R1) — ex.: { device: 0 }
    // por-view:
    fs: { path: "/", mode: "list" },          // list | view
    systemd: { mode: "list", unit: null, filter: "all" },
    procs: { mode: "list", pid: null, filter: "ativos", sort: "cpu" },
    logs: { source: "dmesg", severity: "all" },
    cmd: { mode: "list" },
  };

  // confirmação pendente (resolvida pela camada de input — A/B)
  CD.pendingConfirm = null;

  // atalho p/ marcar estado do agente (atualiza rodapé)
  CD.setAgent = function (online) {
    var s = online ? "on" : "off";
    if (CD.state.agent === s) return;
    CD.state.agent = s;
    var el = document.getElementById("agent-state");
    if (el) { el.textContent = "agente: " + (online ? "ON" : "OFF"); el.className = "tb " + s; }
  };
})();
