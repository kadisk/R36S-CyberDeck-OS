// Toast.tsx — mensagem efêmera (store.toast).
import { useStore } from "../store";

export default function Toast() {
  const s = useStore();
  if (!s.toast) return null;
  return <div className={"toast" + (s.toast.err ? " err" : "")}>{s.toast.msg}</div>;
}
