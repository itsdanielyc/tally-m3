import type { Ledger } from "../contracts/ledger";
import { assertMinorUnits, isISODate } from "./money";
import { requireCategory } from "./categories";
import { requiredText } from "./validation";

export interface CategorySummary {
  categoryId: string | null;
  name: string;
  income: bigint;
  spending: bigint;
  net: bigint;
  budget: number | undefined;
  remaining: bigint | null;
}
export interface MonthlySummary {
  month: string;
  income: bigint;
  spending: bigint;
  balance: bigint;
  transactionCount: number;
  categories: CategorySummary[];
}

/** Calendar-only months never pass through timezone conversion. */
export function validateMonth(value: unknown): string {
  const month = requiredText(value, "Month", 7);
  if (!isISODate(`${month}-01`)) throw new Error("Month must be a real YYYY-MM calendar month.");
  return month;
}

/** Move one calendar month, including year boundaries. O(1) time and space. */
export function shiftMonth(value: string, offset: -1 | 1): string {
  const month = validateMonth(value);
  if (offset !== -1 && offset !== 1) throw new Error("Month offset must be previous or next.");
  const [year, ordinal] = month.split("-").map(Number);
  const index = year! * 12 + ordinal! - 1 + offset;
  const nextYear = Math.floor(index / 12);
  if (nextYear < 1 || nextYear > 9999) throw new Error("Month is outside the supported calendar years.");
  return `${String(nextYear).padStart(4, "0")}-${String(index % 12 + 1).padStart(2, "0")}`;
}

/** Exact aggregates may exceed transaction bounds. O(t+c log c) time, O(c) auxiliary space. */
export function monthlySummary(ledger: Ledger, value: string): MonthlySummary {
  const month = validateMonth(value);
  const budgets = ledger.budgets[month] ?? {};
  const buckets = new Map<string | null, CategorySummary>();
  for (const category of ledger.categories) buckets.set(category.id, { categoryId: category.id, name: category.name, income: 0n, spending: 0n, net: 0n, budget: Object.hasOwn(budgets, category.id) ? budgets[category.id] : undefined, remaining: null });
  let income = 0n;
  let spending = 0n;
  let transactionCount = 0;
  for (const transaction of ledger.transactions) {
    if (transaction.date.slice(0, 7) !== month) continue;
    assertMinorUnits(transaction.amount);
    if (transaction.categoryId === null && !buckets.has(null)) buckets.set(null, { categoryId: null, name: "Uncategorised", income: 0n, spending: 0n, net: 0n, budget: undefined, remaining: null });
    const category = buckets.get(transaction.categoryId);
    if (!category) throw new Error("Ledger category not found while calculating a month.");
    const amount = BigInt(transaction.amount);
    if (amount >= 0n) { category.income += amount; income += amount; }
    else { category.spending -= amount; spending -= amount; }
    category.net += amount;
    transactionCount += 1;
  }
  for (const category of buckets.values()) if (category.budget !== undefined) category.remaining = BigInt(category.budget) + category.net;
  return { month, income, spending, balance: income - spending, transactionCount, categories: [...buckets.values()].sort((left, right) => left.name.localeCompare(right.name)) };
}

/** Set one month/category entry, preserving explicit zero and every other month. */
export function setMonthlyBudget(ledger: Ledger, monthValue: unknown, categoryValue: unknown, amountValue: unknown): string {
  const month = validateMonth(monthValue);
  const categoryId = requireCategory(ledger, categoryValue);
  assertMinorUnits(amountValue);
  if (amountValue < 0) throw new Error("Budget amount cannot be negative.");
  const budgets = ledger.budgets[month] ?? {};
  Object.defineProperty(budgets, categoryId, { value: amountValue, enumerable: true, writable: true, configurable: true });
  ledger.budgets[month] = budgets;
  return "Monthly budget saved.";
}
