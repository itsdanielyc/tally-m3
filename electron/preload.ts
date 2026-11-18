// Runs sandboxed with contextIsolation on. It exposes exactly the typed bridge
// and nothing else: no ipcRenderer, no Node.
import { contextBridge, ipcRenderer } from "electron";
import { channels, type ElectronBridge } from "./bridge";

const bridge: ElectronBridge = {
  ledger: {
    read: () => ipcRenderer.invoke(channels.ledgerRead),
    execute: (command) => ipcRenderer.invoke(channels.ledgerExecute, command),
    previewCsv: (source, mapping) => ipcRenderer.invoke(channels.ledgerPreview, source, mapping),
    openCsv: () => ipcRenderer.invoke(channels.ledgerOpenCsv),
    exportCsv: (source) => ipcRenderer.invoke(channels.ledgerExportCsv, source),
  },
};

contextBridge.exposeInMainWorld("electronBridge", bridge);
