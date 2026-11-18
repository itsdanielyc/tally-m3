// The typed surface the preload exposes to the renderer as window.electronBridge.
// The renderer imports only these types; the preload and main implement them.
import type { LedgerBackend } from "../contracts/ledger";

export interface ElectronBridge {
  readonly ledger: Omit<LedgerBackend, "kind">;
}

/** IPC channel names, shared by main and preload. */
export const channels = {
  ledgerRead: "ledger:read",
  ledgerExecute: "ledger:execute",
  ledgerPreview: "ledger:preview-csv",
  ledgerOpenCsv: "ledger:open-csv",
  ledgerExportCsv: "ledger:export-csv",
} as const;
