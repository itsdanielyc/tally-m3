import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { createEmptyLedger, type LedgerBackend, type LedgerStore } from "../../contracts/ledger";
import { MemoryLedgerStore } from "../../domain/memory-store";
import { LedgerService } from "../../domain/service";
import { FileLedgerStore } from "../../electron/ledger-store";
import { createLedgerMock } from "../../src/api";
import { createTestDirectory, removeTestDirectory } from "../support/directories";

describe.each(["mock", "file"])("monthly budget contract: %s", (kind) => {
  let directory: string;
  let backend: Pick<LedgerBackend, "read" | "execute">;
  let store: LedgerStore;
  beforeEach(async () => {
    directory = await createTestDirectory("budget-contract-");
    const initial = createEmptyLedger(); initial.categories.push({ id: "food", name: "Food" });
    store = kind === "mock" ? new MemoryLedgerStore(initial) : new FileLedgerStore(join(directory, "ledger.json"));
    if (kind === "file") await store.save(initial);
    backend = kind === "mock" ? createLedgerMock(store) : await LedgerService.open(store);
  });
  afterEach(async () => { await removeTestDirectory(directory); });
  it("persists independent monthly budgets, including an explicit zero", async () => {
    await backend.execute({ type: "setBudget", month: "2026-11", categoryId: "food", amount: 2000 });
    await backend.execute({ type: "setBudget", month: "2026-12", categoryId: "food", amount: 0 });
    expect((await store.load()).budgets).toEqual({ "2026-11": { food: 2000 }, "2026-12": { food: 0 } });
  });
  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid budget amount %s without writing", async (amount) => {
    const before = await backend.read();
    await expect(backend.execute({ type: "setBudget", month: "2026-11", categoryId: "food", amount })).rejects.toThrow(/amount|budget/i);
    expect(await backend.read()).toEqual(before);
  });
  it("rejects an invalid month or missing category", async () => {
    await expect(backend.execute({ type: "setBudget", month: "2026-13", categoryId: "food", amount: 100 })).rejects.toThrow(/month/i);
    await expect(backend.execute({ type: "setBudget", month: "2026-11", categoryId: "missing", amount: 100 })).rejects.toThrow(/category|not found/i);
  });
});
