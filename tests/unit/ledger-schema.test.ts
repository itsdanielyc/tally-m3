import { describe, expect, it } from "vitest";
import { createEmptyLedger, LEDGER_VERSION } from "../../contracts/ledger";

describe("versioned ledger contract", () => {
  it("starts in GBP with a current version and every collection empty", () => {
    expect(createEmptyLedger()).toEqual({ version: 1, currency: "GBP", transactions: [], categories: [], rules: [], budgets: {} });
    expect(LEDGER_VERSION).toBe(1);
  });
  it("does not share mutable collections across ledgers", () => {
    const first = createEmptyLedger();
    first.categories.push({ id: "food", name: "Food" });
    first.budgets["2026-11"] = { food: 1000 };
    expect(createEmptyLedger().categories).toEqual([]);
    expect(createEmptyLedger().budgets).toEqual({});
  });
});
