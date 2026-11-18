/// <reference types="vite/client" />
import type { ElectronBridge } from "../electron/bridge";
declare global { interface Window { electronBridge?: ElectronBridge } }
