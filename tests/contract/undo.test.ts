import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { createEmptyLedger, type LedgerBackend, type LedgerCommand, type LedgerStore } from "../../contracts/ledger";
import { MemoryLedgerStore } from "../../domain/memory-store";
import { LedgerService } from "../../domain/service";
import { FileLedgerStore } from "../../electron/ledger-store";
import { createLedgerMock } from "../../src/api";
import { createTestDirectory, removeTestDirectory } from "../support/directories";

describe.each(["mock", "file"])("one-step undo contract: %s", (kind) => {
  let directory: string;
  let backend: Pick<LedgerBackend, "read" | "execute" | "previewCsv">;
  let store: LedgerStore;
  beforeEach(async () => {
    directory = await createTestDirectory("undo-contract-");
    const initial = createEmptyLedger(); initial.categories = [{ id: "food", name: "Food" }, { id: "home", name: "Home" }];
    initial.transactions = [{ id: "one", date: "2026-11-18", payee: "Shop", amount: -1000, categoryId: "food", note: "" }, { id: "two", date: "2026-11-19", payee: "Rent", amount: -2000, categoryId: null, note: "" }];
    initial.rules = [{ id: "rule", contains: "shop", categoryId: "food" }]; initial.budgets = { "2026-11": { food: 1000, home: 2000 } };
    store = kind === "mock" ? new MemoryLedgerStore(initial) : new FileLedgerStore(join(directory, "ledger.json")); if (kind === "file") await store.save(initial);
    backend = kind === "mock" ? createLedgerMock(store) : await LedgerService.open(store);
  });
  afterEach(async () => { await removeTestDirectory(directory); });
  it.each<LedgerCommand>([{ type: "deleteTransaction", id: "one" }, { type: "deleteCategory", id: "food" }, { type: "deleteRule", id: "rule" }, { type: "mergeCategory", sourceId: "food", targetId: "home" }])("restores the exact ledger once after %j", async (command) => {
    const before = (await backend.read()).ledger;
    expect((await backend.execute(command)).undoLabel).not.toBeNull();
    const undone = await backend.execute({ type: "undo" });
    expect(undone.ledger).toEqual(before); expect(undone.undoLabel).toBeNull();
    expect((await (await LedgerService.open(store)).read()).ledger).toEqual(before);
    await expect(backend.execute({ type: "undo" })).rejects.toThrow(/nothing|undo/i);
  });
  it("undoes imported rows and newly created categories together without trusting the renderer receipt", async () => {
    const before = (await backend.read()).ledger;
    const preview = await backend.previewCsv('Date,Payee,Amount,Category,Note\n2026-11-20,Train,-12.34,Travel,new', { date: 0, payee: 1, amount: 2, debit: null, credit: null, category: 3, note: 4, dateOrder: "YMD", decimalSeparator: "." });
    expect(preview.newCategories).toHaveLength(1); preview.newCategories[0]!.name = "Forged";
    const imported = await backend.execute({ type: "commitImport", token: preview.token });
    expect(imported.ledger.categories.some((category) => category.name === "Travel")).toBe(true);
    expect((await backend.execute({ type: "undo" })).ledger).toEqual(before);
  });
  it("keeps undo across reads, previews, failed commands and no-op writes", async () => {
    const before = (await backend.read()).ledger;
    await backend.execute({ type: "deleteTransaction", id: "one" });
    await backend.read();
    await backend.previewCsv('Date,Payee,Amount\n2026-11-20,New,-1.00', { date: 0, payee: 1, amount: 2, debit: null, credit: null, dateOrder: "YMD", decimalSeparator: "." });
    await expect(backend.execute({ type: "setCurrency", currency: "JPY" })).rejects.toThrow();
    await backend.execute({ type: "setCurrency", currency: "GBP" });
    await backend.execute({ type: "applyRules" });
    await backend.execute({ type: "setBudget", month: "2026-11", categoryId: "food", amount: 1000 });
    expect((await backend.execute({ type: "undo" })).ledger).toEqual(before);
  });
  it("an intervening mutation clears the earlier undo instead of reverting unrelated work", async () => {
    await backend.execute({ type: "deleteTransaction", id: "one" });
    expect((await backend.execute({ type: "setCurrency", currency: "USD" })).undoLabel).toBeNull();
    await expect(backend.execute({ type: "undo" })).rejects.toThrow(/nothing|undo/i);
    expect((await backend.read()).ledger.currency).toBe("USD");
  });
  it("retains only the most recent eligible operation", async () => {
    await backend.execute({ type: "deleteTransaction", id: "one" });
    await backend.execute({ type: "deleteTransaction", id: "two" });
    expect((await backend.execute({ type: "undo" })).ledger.transactions.map((row) => row.id)).toEqual(["two"]);
    await expect(backend.execute({ type: "undo" })).rejects.toThrow(/nothing|undo/i);
  });
});
