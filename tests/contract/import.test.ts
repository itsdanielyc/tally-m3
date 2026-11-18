import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { join } from "node:path";
import { LedgerService } from "../../domain/service";
import { FileLedgerStore } from "../../electron/ledger-store";
import { createLedgerMock } from "../../src/api";
import { createTestDirectory, removeTestDirectory } from "../support/directories";
import type { CsvMapping, LedgerBackend } from "../../contracts/ledger";

const mapping: CsvMapping = { date: 0, payee: 1, amount: 2, debit: null, credit: null, dateOrder: "DMY", decimalSeparator: "." };
const source = 'Date,Payee,Amount\n18/11/2026,Green,-12.34\n19/11/2026,Pay,2000.00\nbad,Rejected,1.00';

describe.each(["mock", "file"])("CSV contract: %s", (kind) => {
  let directory: string;
  let backend: Pick<LedgerBackend, "read" | "execute" | "previewCsv">;
  beforeEach(async () => { directory = await createTestDirectory("import-contract-"); backend = kind === "mock" ? createLedgerMock() : await LedgerService.open(new FileLedgerStore(join(directory, "ledger.json"))); });
  afterEach(async () => { await removeTestDirectory(directory); });
  it("previews without writing, commits accepted rows together, and skips the same file afterwards", async () => {
    const preview = await backend.previewCsv(source, mapping);
    expect(preview.accepted).toHaveLength(2);
    expect(preview.rejected).toHaveLength(1);
    expect((await backend.read()).ledger.transactions).toEqual([]);
    expect((await backend.execute({ type: "commitImport", token: preview.token })).ledger.transactions).toHaveLength(2);
    const repeated = await backend.previewCsv(source, mapping);
    expect(repeated.accepted).toEqual([]);
    expect(repeated.duplicates).toBe(2);
    expect((await backend.read()).ledger.transactions).toHaveLength(2);
  });
  it("rejects a stale or forged preview without importing anything", async () => {
    const preview = await backend.previewCsv(source, mapping);
    await expect(backend.execute({ type: "commitImport", token: "forged" })).rejects.toThrow(/preview|token/i);
    await backend.execute({ type: "setCurrency", currency: "USD" });
    await expect(backend.execute({ type: "commitImport", token: preview.token })).rejects.toThrow(/stale|preview/i);
    expect((await backend.read()).ledger.transactions).toEqual([]);
  });
  it("does not trust renderer changes to preview rows", async () => {
    const preview = await backend.previewCsv(source, mapping);
    preview.accepted[0]!.amount = 999;
    preview.accepted.pop();
    const saved = await backend.execute({ type: "commitImport", token: preview.token });
    expect(saved.ledger.transactions).toHaveLength(2);
    expect(saved.ledger.transactions.find((row) => row.payee === "Green")?.amount).toBe(-1234);
  });
});
