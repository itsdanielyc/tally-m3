import type { CsvMapping, ImportPreview, Ledger, LedgerCommand, LedgerSnapshot, LedgerStore } from "../contracts/ledger";
import { prepareImport } from "./csv";
import { applyPayeeRules, saveCategory, deleteCategory, mergeCategory, saveRule, deleteRule } from "./categories";
import { setMonthlyBudget, validateMonth } from "./summary";
import { assertCurrency, assertRecord, requiredText, validateLedger, validateTransaction } from "./validation";

interface MutationResult { notice: string; changed: boolean }
const UNDO_LABELS: Partial<Record<LedgerCommand["type"], string>> = { deleteTransaction: "transaction delete", deleteCategory: "category delete", deleteRule: "rule delete", mergeCategory: "category merge", commitImport: "import" };

/** Serial command boundary shared by native disk persistence and the browser memory mock. */
export class LedgerService {
  private queue: Promise<unknown> = Promise.resolve();
  private revision = 0;
  private notice = "";
  private pendingImport: { preview: ImportPreview; revision: number } | null = null;
  private undoState: { ledger: Ledger; label: string } | null = null;

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
    const preview = { ...prepareImport(source, mapping, this.ledger, this.createId), token: this.createId() };
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

  /** Clone before mutation; publish after atomic commit. O(ledger size) candidate space. */
  private async commit(command: LedgerCommand): Promise<LedgerSnapshot> {
    assertRecord(command, "Command");
    if (command.type === "undo") return this.commitUndo();
    const previous = this.ledger;
    const candidate = structuredClone(this.ledger);
    const result = this.mutate(candidate, command);
    const notice = typeof result === "string" ? result : result.notice;
    if (typeof result !== "string" && !result.changed) { this.notice = notice; return this.snapshot(); }
    validateLedger(candidate);
    await this.store.save(candidate);
    this.ledger = candidate;
    this.notice = notice;
    this.revision += 1;
    this.pendingImport = null;
    const label = UNDO_LABELS[command.type];
    // The old ledger is privately owned and all later writes clone it, so one retained
    // reference supplies undo without another full copy or a growing history stack.
    this.undoState = label ? { ledger: previous, label } : null;
    return this.snapshot();
  }

  /** Publish an undo only after its replacement file is durable; a failed undo keeps the slot. */
  private async commitUndo(): Promise<LedgerSnapshot> {
    if (!this.undoState) throw new Error("Nothing to undo.");
    const candidate = structuredClone(this.undoState.ledger);
    validateLedger(candidate);
    await this.store.save(candidate);
    const label = this.undoState.label;
    this.ledger = candidate; this.undoState = null; this.pendingImport = null;
    this.revision += 1; this.notice = `Undid ${label}.`;
    return this.snapshot();
  }

  /** Apply one validated command privately; helpers document their specific traversal costs. */
  private mutate(candidate: Ledger, command: LedgerCommand): string | MutationResult {
    switch (command.type) {
      case "saveTransaction": {
        const categoryIds = new Set(candidate.categories.map((category) => category.id));
        const transaction = validateTransaction(command.transaction, categoryIds);
        if (command.id !== undefined) {
          const index = candidate.transactions.findIndex((row) => row.id === command.id);
          if (index < 0) throw new Error("Transaction not found.");
          const existing = candidate.transactions[index]!;
          if (existing.date === transaction.date && existing.payee === transaction.payee && existing.amount === transaction.amount && existing.categoryId === transaction.categoryId && existing.note === transaction.note) return { notice: "Transaction unchanged.", changed: false };
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
        if (candidate.currency === command.currency) return { notice: "Currency unchanged.", changed: false };
        candidate.currency = command.currency;
        return "Currency saved. Existing amounts keep their minor-unit values.";
      case "commitImport": {
        const pending = this.pendingImport;
        if (!pending || command.token !== pending.preview.token || pending.revision !== this.revision) throw new Error("Import preview is stale or its token is invalid. Preview the file again.");
        if (pending.preview.accepted.length === 0) throw new Error("No accepted rows to import.");
        candidate.categories = candidate.categories.concat(pending.preview.newCategories);
        const imported = pending.preview.accepted.map((row) => ({ ...row, id: this.createId() }));
        candidate.transactions = imported.concat(candidate.transactions);
        return `Imported ${imported.length} transactions. Skipped ${pending.preview.duplicates} duplicates.`;
      }
      case "saveCategory": {
        const previousName = candidate.categories.find((category) => category.id === command.id)?.name;
        const notice = saveCategory(candidate, command.name, command.id, this.createId);
        const currentName = candidate.categories.find((category) => category.id === command.id)?.name;
        return { notice, changed: command.id === undefined || previousName !== currentName };
      }
      case "deleteCategory": return deleteCategory(candidate, command.id);
      case "mergeCategory": return mergeCategory(candidate, command.sourceId, command.targetId);
      case "saveRule": {
        const previousRule = candidate.rules.find((rule) => rule.id === command.id);
        const notice = saveRule(candidate, command.contains, command.categoryId, command.id, this.createId);
        const currentRule = candidate.rules.find((rule) => rule.id === command.id);
        return { notice, changed: command.id === undefined || previousRule?.contains !== currentRule?.contains || previousRule?.categoryId !== currentRule?.categoryId };
      }
      case "deleteRule": return deleteRule(candidate, command.id);
      case "applyRules": {
        const count = applyPayeeRules(candidate.transactions, candidate.rules);
        return { notice: `Applied rules to ${count} transaction${count === 1 ? "" : "s"}.`, changed: count > 0 };
      }
      case "setBudget": {
        const month = validateMonth(command.month);
        const budgets = candidate.budgets[month];
        const previousAmount = budgets && Object.hasOwn(budgets, command.categoryId) ? budgets[command.categoryId] : undefined;
        const notice = setMonthlyBudget(candidate, month, command.categoryId, command.amount);
        return { notice, changed: previousAmount !== command.amount };
      }
      default:
        throw new Error("Unknown or unavailable command.");
    }
  }

  /** Sorting a detached copy protects persistence order. O(t log t) time, O(t+c+r+b) space. */
  private snapshot(): LedgerSnapshot {
    const ledger = structuredClone(this.ledger);
    ledger.transactions.sort((left, right) => right.date.localeCompare(left.date));
    return { ledger, revision: this.revision, undoLabel: this.undoState?.label ?? null, notice: this.notice };
  }
}
