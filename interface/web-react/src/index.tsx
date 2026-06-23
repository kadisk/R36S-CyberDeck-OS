// index.tsx — ponto de entrada. Monta o App no #root.
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
