import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { createTestDirectory, removeTestDirectory } from "../support/directories";
import { LedgerService } from "../../domain/service";
import { MemoryLedgerStore } from "../../domain/memory-store";
import { FileLedgerStore } from "../../electron/ledger-store";
import type { LedgerBackend, TransactionDraft } from "../../contracts/ledger";
import { createLedgerMock } from "../../src/ledger-api";

const transaction: TransactionDraft = { date: "2026-11-18", payee: "Grocer", amount: -1234, categoryId: null, note: "Milk" };

describe.each(["memory", "file"])("ledger conformance: %s", (kind) => {
  let directory: string;
  let service: Pick<LedgerBackend, "read" | "execute">;
  beforeEach(async () => {
    directory = await createTestDirectory("contract-");
    let sequence = 0;
    const createId = () => `id-${++sequence}`;
    service = kind === "memory" ? createLedgerMock(new MemoryLedgerStore(), createId) : await LedgerService.open(new FileLedgerStore(join(directory, "ledger.json")), createId);
  });
  afterEach(async () => { await removeTestDirectory(directory); });

  it("adds, edits and deletes through the same contract, newest first", async () => {
    await service.execute({ type: "saveTransaction", transaction });
    let snapshot = await service.execute({ type: "saveTransaction", transaction: { ...transaction, date: "2026-11-19", payee: "Salary", amount: 200000 } });
    expect(snapshot.ledger.transactions.map((row) => row.payee)).toEqual(["Salary", "Grocer"]);
    snapshot = await service.execute({ type: "saveTransaction", id: "id-1", transaction: { ...transaction, amount: -1250, note: "Two pints" } });
    expect(snapshot.ledger.transactions.find((row) => row.id === "id-1")).toEqual({ ...transaction, id: "id-1", amount: -1250, note: "Two pints" });
    snapshot = await service.execute({ type: "deleteTransaction", id: "id-1" });
    expect(snapshot.ledger.transactions.map((row) => row.id)).toEqual(["id-2"]);
  });
  it.each([{ date: "2026-02-30" }, { payee: " " }, { amount: 1.5 }, { categoryId: "missing" }])("rejects invalid transaction %j without changing state", async (invalid) => {
    const before = await service.read();
    await expect(service.execute({ type: "saveTransaction", transaction: { ...transaction, ...invalid } })).rejects.toThrow();
    expect(await service.read()).toEqual(before);
  });
  it("rejects stale IDs and unknown commands without changing state", async () => {
    await expect(service.execute({ type: "deleteTransaction", id: "missing" })).rejects.toThrow(/not found/i);
    await expect(service.execute({ type: "not-a-command" } as never)).rejects.toThrow(/command/i);
    expect((await service.read()).ledger.transactions).toEqual([]);
  });
  it("serialises concurrent writes and returns detached snapshots", async () => {
    await Promise.all(Array.from({ length: 10 }, (_, index) => service.execute({ type: "saveTransaction", transaction: { ...transaction, payee: `Shop ${index}` } })));
    const snapshot = await service.read();
    expect(snapshot.ledger.transactions).toHaveLength(10);
    snapshot.ledger.transactions.length = 0;
    expect((await service.read()).ledger.transactions).toHaveLength(10);
  });
  it("persists a supported single currency and rejects unsupported ones", async () => {
    expect((await service.execute({ type: "setCurrency", currency: "USD" })).ledger.currency).toBe("USD");
    await expect(service.execute({ type: "setCurrency", currency: "JPY" })).rejects.toThrow(/currency/i);
  });
});
