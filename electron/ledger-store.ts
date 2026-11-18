import { open, readFile, mkdir, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { createEmptyLedger, LEDGER_VERSION, type Ledger, type LedgerStore } from "../contracts/ledger";
import { assertRecord, validateLedger } from "../domain/validation";

interface AtomicWriteOptions {
  /** Injection seam for real-I/O fault tests, after writing and flushing the candidate. */
  replaceFile?: (source: string, destination: string) => Promise<void>;
}

/** Own the one versioned local file. A partial .pending file is never opened as a ledger. */
export class FileLedgerStore implements LedgerStore {
  private readonly replaceFile: (source: string, destination: string) => Promise<void>;
  constructor(private readonly filePath: string, options: AtomicWriteOptions = {}) { this.replaceFile = options.replaceFile ?? rename; }

  /** Missing means a new ledger; malformed or unsupported existing data fails loudly. */
  async load(): Promise<Ledger> {
    let source: string;
    try { source = await readFile(this.filePath, "utf8"); }
    catch (error) {
      if (hasErrorCode(error, "ENOENT")) return createEmptyLedger();
      throw error;
    }
    let data: unknown;
    try { data = JSON.parse(source); }
    catch { throw new Error("Ledger JSON is unreadable. The existing file has been preserved."); }
    assertRecord(data, "Ledger schema");
    if (data.version === 0) data = { ...createEmptyLedger(), ...data, version: LEDGER_VERSION };
    try { return validateLedger(data); }
    catch (error) { throw new Error(`Ledger schema cannot be opened: ${error instanceof Error ? error.message : String(error)}`); }
  }

  /** O(n) time/space. Flush complete bytes, then atomically replace on the same filesystem. */
  async save(ledger: Ledger): Promise<void> {
    validateLedger(ledger);
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.pending`;
    try {
      const file = await open(temporaryPath, "w", 0o600);
      try { await file.writeFile(JSON.stringify(ledger), "utf8"); await file.sync(); }
      finally { await file.close(); }
      await this.replaceFile(temporaryPath, this.filePath);
      // Directory fsync is unavailable on Windows. Atomic replacement still leaves an
      // old or new complete file after recovery; it never publishes partial JSON.
      await syncDirectoryWhenSupported(dirname(this.filePath));
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }
}

/** Recognise filesystem errors without assuming a particular OS error class. */
function hasErrorCode(error: unknown, code: string): boolean {
  return !!error && typeof error === "object" && "code" in error && error.code === code;
}

/** Best-effort metadata durability after the atomic commit; unsupported filesystems stay usable. */
async function syncDirectoryWhenSupported(directory: string): Promise<void> {
  if (process.platform === "win32") return;
  try {
    const handle = await open(directory, "r");
    try { await handle.sync(); } finally { await handle.close(); }
  } catch {
    // The rename has committed. Reporting failure here would falsely promise rollback.
  }
}
