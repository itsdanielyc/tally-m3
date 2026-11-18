import type { CsvMapping, ImportPreview, Ledger, LedgerCommand, LedgerSnapshot, LedgerStore } from "../contracts/ledger";
import { prepareImport } from "./csv";
import { applyPayeeRules, saveCategory, deleteCategory, mergeCategory, saveRule, deleteRule } from "./categories";
import { setMonthlyBudget } from "./summary";
import { assertCurrency, assertRecord, requiredText, validateLedger, validateTransaction } from "./validation";

/** Serial command boundary shared by native disk persistence and the browser memory mock. */
export class LedgerService {
  private queue: Promise<unknown> = Promise.resolve();
  private revision = 0;
  private notice = "";
  private pendingImport: { preview: ImportPreview; revision: number } | null = null;

  private constructor(private ledger: Ledger, private readonly store: LedgerStore, private readonly createId: () => string) {}

  /** Open without changing the underlying file, including when a migration is needed. */
  static async open(store: LedgerStore, createId: () => string = () => crypto.randomUUID()): Promise<LedgerService> {
    return new LedgerService(validateLedger(await store.load()), store, createId);
  }

  /** Wait for preceding writes and return a detached view ordered newest first. */
  async read(): Promise<LedgerSnapshot> {
    await this.queue;
    return this.snapshot();
  }

  /** Build an immutable receipt against the current revision; preview never writes. */
  async previewCsv(source: string, mapping: CsvMapping): Promise<ImportPreview> {
    await this.queue;
    const preview = { ...prepareImport(source, mapping, this.ledger), token: this.createId() };
    applyPayeeRules(preview.accepted, this.ledger.rules);
    this.pendingImport = { preview, revision: this.revision };
    return structuredClone(preview);
  }

  /** Enqueue mutations so simultaneous IPC callers cannot overwrite one another. */
  execute(command: LedgerCommand): Promise<LedgerSnapshot> {
    const operation = this.queue.then(() => this.commit(command));
    // A rejected write must not poison the queue for the next valid operation.
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  /** Clone before mutation; publish only after the atomic store commit succeeds. O(t+c) space. */
  private async commit(command: LedgerCommand): Promise<LedgerSnapshot> {
    assertRecord(command, "Command");
    const candidate = structuredClone(this.ledger);
    const notice = this.mutate(candidate, command);
    validateLedger(candidate);
    await this.store.save(candidate);
    this.ledger = candidate;
    this.notice = notice;
    this.revision += 1;
    this.pendingImport = null;
    return this.snapshot();
  }

  /** Apply one validated command to a private candidate. O(t+c) time and space. */
  private mutate(candidate: Ledger, command: LedgerCommand): string {
    switch (command.type) {
      case "saveTransaction": {
        const categoryIds = new Set(candidate.categories.map((category) => category.id));
        const transaction = validateTransaction(command.transaction, categoryIds);
        if (command.id !== undefined) {
          const index = candidate.transactions.findIndex((row) => row.id === command.id);
          if (index < 0) throw new Error("Transaction not found.");
          candidate.transactions[index] = { ...transaction, id: command.id };
        } else candidate.transactions.unshift({ ...transaction, id: this.createId() });
        return "Transaction saved.";
      }
      case "deleteTransaction": {
        const id = requiredText(command.id, "Transaction ID");
        const index = candidate.transactions.findIndex((row) => row.id === id);
        if (index < 0) throw new Error("Transaction not found.");
        candidate.transactions.splice(index, 1);
        return "Transaction deleted.";
      }
      case "setCurrency":
        assertCurrency(command.currency);
        candidate.currency = command.currency;
        return "Currency saved. Existing amounts keep their minor-unit values.";
      case "commitImport": {
        const pending = this.pendingImport;
        if (!pending || command.token !== pending.preview.token || pending.revision !== this.revision) throw new Error("Import preview is stale or its token is invalid. Preview the file again.");
        if (pending.preview.accepted.length === 0) throw new Error("No accepted rows to import.");
        const imported = pending.preview.accepted.map((row) => ({ ...row, id: this.createId() }));
        candidate.transactions = imported.concat(candidate.transactions);
        return `Imported ${imported.length} transactions. Skipped ${pending.preview.duplicates} duplicates.`;
      }
      case "saveCategory": return saveCategory(candidate, command.name, command.id, this.createId);
      case "deleteCategory": return deleteCategory(candidate, command.id);
      case "mergeCategory": return mergeCategory(candidate, command.sourceId, command.targetId);
      case "saveRule": return saveRule(candidate, command.contains, command.categoryId, command.id, this.createId);
      case "deleteRule": return deleteRule(candidate, command.id);
      case "applyRules": {
        const count = applyPayeeRules(candidate.transactions, candidate.rules);
        return `Applied rules to ${count} transaction${count === 1 ? "" : "s"}.`;
      }
      case "setBudget": return setMonthlyBudget(candidate, command.month, command.categoryId, command.amount);
      default:
        throw new Error("Unknown or unavailable command.");
    }
  }

  /** Sorting a detached copy protects persistence order. O(t log t) time, O(t+c+r+b) space. */
  private snapshot(): LedgerSnapshot {
    const ledger = structuredClone(this.ledger);
    ledger.transactions.sort((left, right) => right.date.localeCompare(left.date));
    return { ledger, revision: this.revision, undoLabel: null, notice: this.notice };
  }
}
