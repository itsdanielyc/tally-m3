import type { Ledger, PayeeRule, TransactionDraft } from "../contracts/ledger";
import { addMinorUnits } from "./money";
import { requiredText } from "./validation";

const RESERVED_CATEGORY_NAME = "uncategorised";
const MAX_RULE_LENGTH = 200;
const fold = (text: string): string => text.normalize("NFC").toLowerCase();

/** Create or rename without changing the category identity used by transactions and budgets. */
export function saveCategory(ledger: Ledger, nameValue: unknown, id: string | undefined, createId: () => string): string {
  const name = requiredText(nameValue, "Category name");
  if (fold(name) === RESERVED_CATEGORY_NAME) throw new Error("Uncategorised is a reserved category name.");
  if (ledger.categories.some((category) => category.id !== id && fold(category.name) === fold(name))) throw new Error("A category with that name already exists.");
  if (id === undefined) ledger.categories.push({ id: createId(), name });
  else {
    const category = ledger.categories.find((candidate) => candidate.id === id);
    if (!category) throw new Error("Category not found.");
    category.name = name;
  }
  return id === undefined ? "Category created." : "Category renamed.";
}

/** Validate an existing category reference shared by category and budget commands. */
export function requireCategory(ledger: Ledger, id: unknown): string {
  const categoryId = requiredText(id, "Category ID");
  if (!ledger.categories.some((category) => category.id === categoryId)) throw new Error("Category not found.");
  return categoryId;
}

/** Remove references together inside the private command candidate. O(t+c+r+b) time, O(c+r) space. */
export function deleteCategory(ledger: Ledger, value: unknown): string {
  const id = requireCategory(ledger, value);
  for (const transaction of ledger.transactions) if (transaction.categoryId === id) transaction.categoryId = null;
  ledger.rules = ledger.rules.filter((rule) => rule.categoryId !== id);
  for (const budgets of Object.values(ledger.budgets)) delete budgets[id];
  ledger.categories = ledger.categories.filter((category) => category.id !== id);
  return "Category deleted. Its transactions are uncategorised; linked rules and budgets were removed.";
}

/** Merge identities and exact budgets atomically. O(t+c+r+b) time, O(c) auxiliary space. */
export function mergeCategory(ledger: Ledger, sourceValue: unknown, targetValue: unknown): string {
  const source = requireCategory(ledger, sourceValue);
  const target = requireCategory(ledger, targetValue);
  if (source === target) throw new Error("Choose two different categories to merge.");
  for (const transaction of ledger.transactions) if (transaction.categoryId === source) transaction.categoryId = target;
  for (const rule of ledger.rules) if (rule.categoryId === source) rule.categoryId = target;
  for (const budgets of Object.values(ledger.budgets)) {
    if (!Object.hasOwn(budgets, source)) continue;
    const amount = addMinorUnits(budgets[source]!, Object.hasOwn(budgets, target) ? budgets[target]! : 0);
    // Legacy IDs are strings, so define an own property rather than touching a prototype setter.
    Object.defineProperty(budgets, target, { value: amount, enumerable: true, writable: true, configurable: true });
    delete budgets[source];
  }
  ledger.categories = ledger.categories.filter((category) => category.id !== source);
  return "Categories merged. Transactions, rules and budgets now use the target category.";
}

/** Rule order is creation order; edits retain that position. */
export function saveRule(ledger: Ledger, textValue: unknown, categoryValue: unknown, id: string | undefined, createId: () => string): string {
  const contains = requiredText(textValue, "Rule text", MAX_RULE_LENGTH);
  const categoryId = requireCategory(ledger, categoryValue);
  if (ledger.rules.some((rule) => rule.id !== id && fold(rule.contains) === fold(contains))) throw new Error("A rule with that text already exists.");
  if (id === undefined) ledger.rules.push({ id: createId(), contains, categoryId });
  else {
    const index = ledger.rules.findIndex((rule) => rule.id === id);
    if (index < 0) throw new Error("Rule not found.");
    ledger.rules[index] = { id, contains, categoryId };
  }
  return "Rule saved.";
}

/** Removing a rule leaves already assigned transactions unchanged. */
export function deleteRule(ledger: Ledger, value: unknown): string {
  const id = requiredText(value, "Rule ID");
  const index = ledger.rules.findIndex((rule) => rule.id === id);
  if (index < 0) throw new Error("Rule not found.");
  ledger.rules.splice(index, 1);
  return "Rule deleted.";
}

/** Compile needles once, then use literal case-insensitive contains. O(t*r*l) time, O(r) space. */
export function applyPayeeRules(transactions: TransactionDraft[], rules: readonly PayeeRule[]): number {
  const prepared = rules.map((rule) => ({ categoryId: rule.categoryId, needle: fold(rule.contains) }));
  let changed = 0;
  for (const transaction of transactions) {
    if (transaction.categoryId !== null) continue;
    const payee = fold(transaction.payee);
    const match = prepared.find((rule) => payee.includes(rule.needle));
    if (!match) continue;
    transaction.categoryId = match.categoryId;
    changed += 1;
  }
  return changed;
}
