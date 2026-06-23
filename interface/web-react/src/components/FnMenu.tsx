// FnMenu.tsx — menu FUNCTION (botão FN): utilitários + energia + trocar de interface.
// Telas AJUSTES/MEDIA/STORAGE/KEYS entram na 2ª leva; aqui ficam as ações de utilidade.
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { useStore, actions } from "../store";

function Row({ icon, label, sub, onClick, danger }: { icon: string; label: string; sub: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <div className={"row" + (danger ? " fn-danger" : "")} tabIndex={0} data-focus="1" onClick={onClick}>
      <span className="fn-ic">{icon}</span>
      <span className="grow">{label}</span>
      <span className="r">{sub}</span>
    </div>
  );
}

export default function FnMenu() {
  const s = useStore();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!s.fnOpen) return;
    const f = ref.current && ref.current.querySelector("[data-focus]");
    if (f) try { (f as HTMLElement).focus(); } catch (e) {}
  }, [s.fnOpen]);
  if (!s.fnOpen) return null;

  const close = actions.closeFn;
  return (
    <div className="overlay" id="fnmenu">
      <div className="fn-box">
        <h3>FUNCTION</h3>
        <div id="fn-list" ref={ref}>
          <Row icon="=" label="Ajustes" sub="display/áudio" onClick={() => { close(); actions.go("tools"); }} />
          <Row icon="*" label="Testar botões" sub="gamepad" onClick={() => { close(); actions.go("keys"); }} />
          <Row icon=">" label="Teste A/V" sub="áudio/vídeo" onClick={() => { close(); actions.go("media"); }} />
          <Row icon="=" label="Armazenamento" sub="disco/cartão" onClick={() => { close(); actions.go("storage"); }} />
          <Row icon="K" label="Kernel & DTB" sub="diag" onClick={() => { close(); actions.go("kernel"); }} />
          <div className="fn-sec">UTILITÁRIOS</div>
          <Row icon="#" label="Screenshot agora" sub="L2+R2" onClick={() => { close(); actions.screenshot(); }} />
          <Row icon="@" label="Trocar p/ Web" sub="reinicia" onClick={() => { close(); actions.action("interface-web", "Trocar p/ interface Web (reinicia a sessão)", true); }} />
          <Row icon="@" label="Trocar p/ Nativa" sub="reinicia" onClick={() => { close(); actions.action("interface-fb", "Trocar p/ interface Nativa (reinicia a sessão)", true); }} />
          <div className="fn-sec">ENERGIA</div>
          <Row icon=">" label="Recarregar UI" sub="confirma" onClick={() => { close(); actions.action("reload-ui", "Recarregar UI", true); }} />
          <Row icon=">" label="Reiniciar agente" sub="confirma" onClick={() => { close(); actions.action("restart-agent", "Reiniciar cyberdeck-agent", true); }} />
          <Row icon="!" label="Reiniciar sistema" sub="confirma" danger onClick={() => { close(); actions.action("reboot", "Reiniciar sistema", true); }} />
          <Row icon="!" label="Desligar" sub="confirma" danger onClick={() => { close(); actions.action("poweroff", "Desligar sistema", true); }} />
        </div>
        <div className="fn-foot"><b>B</b>/FN fecha</div>
      </div>
    </div>
  );
}
