// registry.ts — mapa seção -> componente de tela.
import type { ComponentType } from "react";
import Home from "./Home";
import Status from "./Status";
import Net from "./Net";
import Logs from "./Logs";
import Device from "./Device";

export const SCREENS: Record<string, ComponentType> = { home: Home, status: Status, net: Net, logs: Logs, device: Device };
