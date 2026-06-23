// registry.ts — mapa seção -> componente de tela.
import type { ComponentType } from "react";
import Home from "./Home";
import Status from "./Status";
import Procs from "./Procs";
import Net from "./Net";
import Logs from "./Logs";
import Device from "./Device";
import Fs from "./Fs";
import Svc from "./Svc";
import Cmd from "./Cmd";
import Kernel from "./Kernel";
import Tools from "./Tools";
import Storage from "./Storage";
import Media from "./Media";
import Keys from "./Keys";

export const SCREENS: Record<string, ComponentType> = {
  home: Home, status: Status, procs: Procs, net: Net, logs: Logs, device: Device,
  fs: Fs, systemd: Svc, cmd: Cmd, kernel: Kernel, tools: Tools, storage: Storage, media: Media, keys: Keys,
};
