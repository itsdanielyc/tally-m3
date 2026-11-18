import { expect, it } from "vitest";
import { createEmptyLedger, type Ledger } from "../../contracts/ledger";
import { monthlySummary, shiftMonth } from "../../domain/summary";
import { formatMinorUnits } from "../../domain/money";

function ledger(): Ledger {
  return { ...createEmptyLedger(), categories: [{ id: "food", name: "Food" }, { id: "home", name: "Home" }], transactions: [
    { id: "expense", date: "2026-11-01", payee: "Shop", amount: -1234, categoryId: "food", note: "" },
    { id: "refund", date: "2026-11-30", payee: "Refund", amount: 234, categoryId: "food", note: "" },
    { id: "income", date: "2026-11-15", payee: "Salary", amount: 200000, categoryId: null, note: "" },
    { id: "before", date: "2026-10-31", payee: "Before", amount: -500, categoryId: "home", note: "" },
    { id: "after", date: "2026-12-01", payee: "After", amount: -500, categoryId: "home", note: "" },
  ], budgets: { "2026-11": { food: 1000 } } };
}
it("sums exact income, spending and signed category totals on inclusive month boundaries", () => {
  const input = ledger(); const before = structuredClone(input);
  const summary = monthlySummary(input, "2026-11");
  expect(summary).toMatchObject({ income: 200234n, spending: 1234n, balance: 199000n, transactionCount: 3 });
  expect(summary.categories.find((category) => category.categoryId === "food")).toMatchObject({ income: 234n, spending: 1234n, net: -1000n, budget: 1000, remaining: 0n });
  expect(summary.categories.reduce((total, category) => total + category.net, 0n)).toBe(summary.balance);
  expect(summary.categories.find((category) => category.categoryId === "home")?.net).toBe(0n);
  expect(input).toEqual(before);
});
it("keeps empty months and unset budgets distinct from a zero budget", () => {
  const empty = monthlySummary(ledger(), "2027-01");
  expect(empty).toMatchObject({ income: 0n, spending: 0n, balance: 0n, transactionCount: 0 });
  expect(empty.categories.every((category) => category.remaining === null)).toBe(true);
  const input = ledger(); input.budgets["2026-11"]!.food = 0;
  expect(monthlySummary(input, "2026-11").categories.find((category) => category.categoryId === "food")?.remaining).toBe(-1000n);
});
it("aggregates beyond safe-number totals without losing a cent", () => {
  const input = createEmptyLedger();
  input.transactions = [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 1, -Number.MAX_SAFE_INTEGER, -1].map((amount, index) => ({ id: String(index), date: "2026-11-18", payee: "Large", amount, categoryId: null, note: "" }));
  const summary = monthlySummary(input, "2026-11");
  expect(summary.income).toBe(BigInt(Number.MAX_SAFE_INTEGER) * 2n + 1n);
  expect(summary.spending).toBe(BigInt(Number.MAX_SAFE_INTEGER) + 1n);
  expect(summary.balance).toBe(BigInt(Number.MAX_SAFE_INTEGER));
  expect(formatMinorUnits(summary.income)).toBe("180143985094819.83");
});
it("navigates year boundaries without a timezone or daylight-saving conversion", () => {
  expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  expect(shiftMonth("2024-02", 1)).toBe("2024-03");
  expect(() => shiftMonth("0001-01", -1)).toThrow(/month|year/i);
  expect(() => shiftMonth("9999-12", 1)).toThrow(/month|year/i);
});
it.each(["", "2026-00", "2026-13", "26-11", "2026-2"])("rejects invalid month %s", (month) => expect(() => monthlySummary(ledger(), month)).toThrow(/month/i));
