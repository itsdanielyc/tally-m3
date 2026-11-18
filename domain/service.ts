import type { Ledger, LedgerCommand, LedgerSnapshot, LedgerStore } from "../contracts/ledger";
import { assertCurrency, assertRecord, requiredText, validateLedger, validateTransaction } from "./validation";

/** Serial command boundary shared by native disk persistence and the browser memory mock. */
export class LedgerService {
  private queue: Promise<unknown> = Promise.resolve();
  private revision = 0;
  private notice = "";

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
