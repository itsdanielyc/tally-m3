import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { createEmptyLedger, type Ledger, type LedgerBackend } from "../../contracts/ledger";
import { MemoryLedgerStore } from "../../domain/memory-store";
import { LedgerService } from "../../domain/service";
import { FileLedgerStore } from "../../electron/ledger-store";
import { createLedgerMock } from "../../src/api";
import { createTestDirectory, removeTestDirectory } from "../support/directories";

function seed(): Ledger {
  return { ...createEmptyLedger(), categories: [{ id: "food", name: "Food" }, { id: "home", name: "Home" }], rules: [{ id: "corner-rule", contains: "corner", categoryId: "food" }], transactions: [
    { id: "one", date: "2026-11-18", payee: "Corner store", amount: -1000, categoryId: "food", note: "" },
    { id: "two", date: "2026-11-19", payee: "COFFEE shop", amount: -250, categoryId: null, note: "" },
    { id: "three", date: "2026-11-20", payee: "Coffee club", amount: -500, categoryId: "home", note: "manual" },
  ], budgets: { "2026-11": { food: 1000, home: 2000 } } };
}

describe.each(["mock", "file"])("category and rule contract: %s", (kind) => {
  let directory: string;
  let backend: Pick<LedgerBackend, "read" | "execute" | "previewCsv">;
  async function open(initial: Ledger): Promise<typeof backend> {
    if (kind === "mock") return createLedgerMock(new MemoryLedgerStore(initial));
    const store = new FileLedgerStore(join(directory, "ledger.json"));
    await store.save(initial);
    return LedgerService.open(store);
  }
  beforeEach(async () => { directory = await createTestDirectory("category-contract-"); backend = await open(seed()); });
  afterEach(async () => { await removeTestDirectory(directory); });

  it("creates and renames a category without changing references", async () => {
    const created = await backend.execute({ type: "saveCategory", name: " Pantry " });
    const id = created.ledger.categories.find((category) => category.name === "Pantry")!.id;
    const renamed = await backend.execute({ type: "saveCategory", id, name: "Groceries" });
    expect(renamed.ledger.categories.find((category) => category.id === id)?.name).toBe("Groceries");
    expect(renamed.ledger.transactions.find((row) => row.id === "one")?.categoryId).toBe("food");
  });
  it.each(["", " ", "FOOD", "Uncategorised", "x".repeat(101)])("rejects invalid, duplicate or reserved category name %j", async (name) => {
    const before = await backend.read();
    await expect(backend.execute({ type: "saveCategory", name })).rejects.toThrow(/category|name|reserved/i);
    expect(await backend.read()).toEqual(before);
  });
  it("deleting a category leaves transactions uncategorised and removes linked rules/budgets", async () => {
    const result = await backend.execute({ type: "deleteCategory", id: "food" });
    expect(result.ledger.categories.map((category) => category.id)).toEqual(["home"]);
    expect(result.ledger.transactions.find((row) => row.id === "one")?.categoryId).toBeNull();
    expect(result.ledger.transactions.find((row) => row.id === "three")?.categoryId).toBe("home");
    expect(result.ledger.rules).toEqual([]);
    expect(result.ledger.budgets["2026-11"]).toEqual({ home: 2000 });
  });
  it("merges all references and adds monthly budgets exactly", async () => {
    const result = await backend.execute({ type: "mergeCategory", sourceId: "food", targetId: "home" });
    expect(result.ledger.categories.map((category) => category.id)).toEqual(["home"]);
    expect(result.ledger.transactions.find((row) => row.id === "one")?.categoryId).toBe("home");
    expect(result.ledger.rules[0]?.categoryId).toBe("home");
    expect(result.ledger.budgets["2026-11"]).toEqual({ home: 3000 });
  });
  it("rejects missing references and a merge into itself without changing state", async () => {
    const before = await backend.read();
    for (const command of [{ type: "mergeCategory", sourceId: "food", targetId: "food" }, { type: "mergeCategory", sourceId: "missing", targetId: "home" }, { type: "deleteCategory", id: "missing" }, { type: "saveCategory", id: "missing", name: "New" }] as const) await expect(backend.execute(command)).rejects.toThrow(/different|not found/i);
    expect(await backend.read()).toEqual(before);
  });
  it("rejects budget overflow atomically during a merge", async () => {
    const initial = seed(); initial.budgets["2026-11"]!.food = Number.MAX_SAFE_INTEGER;
    backend = await open(initial);
    const before = await backend.read();
    await expect(backend.execute({ type: "mergeCategory", sourceId: "food", targetId: "home" })).rejects.toThrow(/amount|range/i);
    expect(await backend.read()).toEqual(before);
  });
  it("creates, edits and deletes rules, applying only to uncategorised rows and imports", async () => {
    const saved = await backend.execute({ type: "saveRule", contains: "coffee", categoryId: "food" });
    const id = saved.ledger.rules.find((rule) => rule.contains === "coffee")!.id;
    const applied = await backend.execute({ type: "applyRules" });
    expect(applied.ledger.transactions.find((row) => row.id === "two")?.categoryId).toBe("food");
    expect(applied.ledger.transactions.find((row) => row.id === "three")?.categoryId).toBe("home");
    const preview = await backend.previewCsv('Date,Payee,Amount\n21/11/2026,Coffee beans,-1.20', { date: 0, payee: 1, amount: 2, debit: null, credit: null, dateOrder: "DMY", decimalSeparator: "." });
    expect(preview.accepted[0]?.categoryId).toBe("food");
    await backend.execute({ type: "saveRule", id, contains: "tea", categoryId: "home" });
    expect((await backend.execute({ type: "deleteRule", id })).ledger.rules.map((rule) => rule.id)).toEqual(["corner-rule"]);
  });
  it("uses the first matching rule and rejects duplicate or invalid rules", async () => {
    await backend.execute({ type: "saveRule", contains: "coffee", categoryId: "home" });
    await backend.execute({ type: "saveRule", contains: "beans", categoryId: "food" });
    const preview = await backend.previewCsv('Date,Payee,Amount\n21/11/2026,Coffee beans,-1.20', { date: 0, payee: 1, amount: 2, debit: null, credit: null, dateOrder: "DMY", decimalSeparator: "." });
    expect(preview.accepted[0]?.categoryId).toBe("home");
    for (const command of [{ type: "saveRule", contains: "COFFEE", categoryId: "food" }, { type: "saveRule", contains: " ", categoryId: "food" }, { type: "saveRule", contains: "new", categoryId: "missing" }, { type: "deleteRule", id: "missing" }] as const) await expect(backend.execute(command)).rejects.toThrow(/rule|text|category|exists|not found/i);
  });
});
