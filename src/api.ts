import type { LedgerBackend, LedgerStore } from "../contracts/ledger";
import { MemoryLedgerStore } from "../domain/memory-store";
import { LedgerService } from "../domain/service";
import type { ElectronBridge } from "../electron/bridge";

/** The memory mock uses the real command service; only persistence and OS dialogs differ. */
export function createLedgerMock(store: LedgerStore = new MemoryLedgerStore(), createId?: () => string): LedgerBackend {
  const service = LedgerService.open(store, createId);
  return {
    kind: "mock",
    read: async () => (await service).read(),
    execute: async (command) => (await service).execute(command),
    previewCsv: async () => { throw new Error("CSV import is not available yet."); },
    openCsv: async () => null,
    exportCsv: async () => false,
  };
}

const nativeLedger: ElectronBridge["ledger"] | undefined = typeof window === "undefined" ? undefined : window.electronBridge?.ledger;
/** Only this adapter selects native IPC or the visibly labelled memory backend. */
export const ledgerBackend: LedgerBackend = nativeLedger ? { kind: "native", ...nativeLedger } : createLedgerMock();
