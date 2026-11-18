import { LEDGER_VERSION, SUPPORTED_CURRENCIES, type Ledger, type TransactionDraft } from "../contracts/ledger";
import { assertMinorUnits, isISODate } from "./money";

const MAX_PAYEE_LENGTH = 200;
const MAX_NOTE_LENGTH = 10_000;
const MAX_CATEGORY_LENGTH = 100;

/** Narrow untrusted IPC or JSON input before touching its fields. */
export function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
}

/** Require bounded, non-empty human text; notes are handled separately because empty is valid. */
export function requiredText(value: unknown, label: string, maximumLength = MAX_CATEGORY_LENGTH): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximumLength) throw new Error(`${label} is required (maximum ${maximumLength} characters).`);
  return value.trim();
}

/** Validate a supported currency whose minor units have two decimal digits. */
export function assertCurrency(value: unknown): asserts value is string {
  if (!(SUPPORTED_CURRENCIES as readonly unknown[]).includes(value)) throw new Error("Currency must be one of the supported two-decimal currencies.");
}

/** Normalize a transaction while retaining note text exactly. O(c) time/space for category lookup. */
export function validateTransaction(value: unknown, categoryIds: ReadonlySet<string>): TransactionDraft {
  assertRecord(value, "Transaction");
  if (typeof value.date !== "string" || !isISODate(value.date)) throw new Error("Date must be a real calendar date in YYYY-MM-DD order.");
  const payee = requiredText(value.payee, "Payee", MAX_PAYEE_LENGTH);
  assertMinorUnits(value.amount);
  if (value.categoryId !== null && (typeof value.categoryId !== "string" || !categoryIds.has(value.categoryId))) throw new Error("Category not found.");
  if (typeof value.note !== "string" || value.note.length > MAX_NOTE_LENGTH) throw new Error(`Note must be text (maximum ${MAX_NOTE_LENGTH} characters).`);
  return { date: value.date, payee, amount: value.amount, categoryId: value.categoryId as string | null, note: value.note };
}

/** Validate every stored reference before opening a ledger. O(t+c+r+b) time, O(t+c+r) space. */
export function validateLedger(value: unknown): Ledger {
  assertRecord(value, "Ledger schema");
  if (value.version !== LEDGER_VERSION) throw new Error(`Unsupported ledger version: ${String(value.version)}.`);
  assertCurrency(value.currency);
  if (!Array.isArray(value.categories) || !Array.isArray(value.transactions) || !Array.isArray(value.rules)) throw new Error("Ledger schema has missing collections.");
  assertRecord(value.budgets, "Ledger budgets");
  const categoryIds = new Set<string>();
  const categoryNames = new Set<string>();
  for (const category of value.categories) {
    assertRecord(category, "Category");
    const id = requiredText(category.id, "Category ID");
    const name = requiredText(category.name, "Category name");
    if (categoryIds.has(id) || categoryNames.has(name.toLocaleLowerCase("en"))) throw new Error("Ledger has duplicate categories.");
    categoryIds.add(id); categoryNames.add(name.toLocaleLowerCase("en"));
  }
  const transactionIds = new Set<string>();
  for (const transaction of value.transactions) {
    assertRecord(transaction, "Transaction");
    const id = requiredText(transaction.id, "Transaction ID");
    if (transactionIds.has(id)) throw new Error("Ledger has duplicate transaction IDs.");
    transactionIds.add(id);
    validateTransaction(transaction, categoryIds);
  }
  const ruleIds = new Set<string>();
  for (const rule of value.rules) {
    assertRecord(rule, "Rule");
    const id = requiredText(rule.id, "Rule ID");
    if (ruleIds.has(id)) throw new Error("Ledger has duplicate rule IDs.");
    ruleIds.add(id); requiredText(rule.contains, "Rule text", MAX_PAYEE_LENGTH);
    if (typeof rule.categoryId !== "string" || !categoryIds.has(rule.categoryId)) throw new Error("Ledger rule category not found.");
  }
  for (const [month, budgets] of Object.entries(value.budgets)) {
    if (!isISODate(`${month}-01`)) throw new Error("Ledger budget month is invalid.");
    assertRecord(budgets, "Category budgets");
    for (const [categoryId, amount] of Object.entries(budgets)) {
      assertMinorUnits(amount);
      if (!categoryIds.has(categoryId) || amount < 0) throw new Error("Ledger budget category or amount is invalid.");
    }
  }
  return value as unknown as Ledger;
}
