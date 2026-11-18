import type { LedgerBackend, LedgerStore } from "../contracts/ledger";
import { MemoryLedgerStore } from "../domain/memory-store";
import { LedgerService } from "../domain/service";
import type { ElectronBridge } from "../electron/bridge";
import { DEFAULT_CSV_FILENAME } from "../domain/export";
const OBJECT_URL_LIFETIME_MS = 1000;

/** The memory mock uses the real command service; only persistence and OS dialogs differ. */
export function createLedgerMock(store: LedgerStore = new MemoryLedgerStore(), createId?: () => string): LedgerBackend {
  const service = LedgerService.open(store, createId);
  return {
    kind: "mock",
    read: async () => (await service).read(),
    execute: async (command) => (await service).execute(command),
    previewCsv: async (source, mapping) => (await service).previewCsv(source, mapping),
    openCsv: async () => null,
    exportCsv: async (source) => {
      if (typeof document === "undefined") return false;
      const url = URL.createObjectURL(new Blob([source], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = DEFAULT_CSV_FILENAME;
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_LIFETIME_MS);
      return true;
    },
  };
}

const nativeLedger: ElectronBridge["ledger"] | undefined = typeof window === "undefined" ? undefined : window.electronBridge?.ledger;
/** Only this adapter selects native IPC or the visibly labelled memory backend. */
export const ledgerBackend: LedgerBackend = nativeLedger ? { kind: "native", ...nativeLedger } : createLedgerMock();
