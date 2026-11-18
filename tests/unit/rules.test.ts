import { expect, it } from "vitest";
import { applyPayeeRules } from "../../domain/categories";
import type { TransactionDraft } from "../../contracts/ledger";

const row = (payee: string, categoryId: string | null = null): TransactionDraft => ({ date: "2026-11-18", payee, categoryId, amount: -100, note: "" });
it("matches Unicode-normalised, case-insensitive literal text", () => {
  const rows = [row("CAFÉ [STORE]")];
  expect(applyPayeeRules(rows, [{ id: "rule", contains: "cafe\u0301 [store]", categoryId: "food" }])).toBe(1);
  expect(rows[0]?.categoryId).toBe("food");
  expect(rows[0]?.payee).toBe("CAFÉ [STORE]");
});
it("preserves manual categorisation", () => {
  const rows = [row("Coffee shop", "manual")];
  expect(applyPayeeRules(rows, [{ id: "rule", contains: "coffee", categoryId: "food" }])).toBe(0);
  expect(rows[0]?.categoryId).toBe("manual");
});
it("keeps the first matching rule", () => {
  const rows = [row("Coffee shop")];
  applyPayeeRules(rows, [{ id: "one", contains: "shop", categoryId: "home" }, { id: "two", contains: "coffee", categoryId: "food" }]);
  expect(rows[0]?.categoryId).toBe("home");
});
it("leaves an unmatched transaction uncategorised", () => {
  const rows = [row("Rent")];
  expect(applyPayeeRules(rows, [{ id: "rule", contains: "coffee", categoryId: "food" }])).toBe(0);
  expect(rows[0]?.categoryId).toBeNull();
});
