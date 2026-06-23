// Confirm.tsx — overlay de confirmação (A confirma / B cancela, resolvidos pela camada de input).
import { useStore } from "../store";

export default function Confirm() {
  const s = useStore();
  if (!s.confirm) return null;
  return (
    <div className="overlay" id="confirm">
      <div className="confirm-box">
        <h3>CONFIRMAR</h3>
        <p id="confirm-msg">{s.confirm.label}</p>
        <div className="confirm-keys"><b>A</b>/Start = sim · <b>B</b>/Select = não</div>
      </div>
    </div>
  );
}
