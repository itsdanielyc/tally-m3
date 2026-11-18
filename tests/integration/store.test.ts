import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createTestDirectory, removeTestDirectory } from "../support/directories";
import { createEmptyLedger } from "../../contracts/ledger";
import { FileLedgerStore } from "../../electron/ledger-store";
import { LedgerService } from "../../domain/service";

describe("real atomic ledger I/O", () => {
  let directory: string;
  let path: string;
  beforeEach(async () => {
    directory = await createTestDirectory("store-");
    path = join(directory, "ledger.json");
  });
  afterEach(async () => { await removeTestDirectory(directory); });

  it("saves, reopens exact data and ignores an interrupted temporary file", async () => {
    const ledger = createEmptyLedger();
    ledger.transactions.push({ id: "one", date: "2026-11-18", payee: "A & B", amount: -1, categoryId: null, note: "Exact\ntext" });
    await new FileLedgerStore(path).save(ledger);
    await writeFile(`${path}.pending`, '{"partial":');
    expect(await new FileLedgerStore(path).load()).toEqual(ledger);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual(ledger);
  });
  it("migrates version zero and never overwrites corrupt or newer data", async () => {
    await writeFile(path, JSON.stringify({ version: 0, transactions: [] }));
    expect(await new FileLedgerStore(path).load()).toEqual(createEmptyLedger());
    for (const source of ['{"version":99}', '{"version":1', '{"version":1,"transactions":[]}']) {
      await writeFile(path, source);
      await expect(new FileLedgerStore(path).load()).rejects.toThrow(/ledger|version|schema/i);
      expect(await readFile(path, "utf8")).toBe(source);
    }
  });
  it("a denied rename after a real flushed write preserves file and service state", async () => {
    await new FileLedgerStore(path).save(createEmptyLedger());
    const original = await readFile(path, "utf8");
    const service = await LedgerService.open(new FileLedgerStore(path, { replaceFile: async () => { throw new Error("EACCES: injected rename denial"); } }));
    const before = await service.read();
    await expect(service.execute({ type: "setCurrency", currency: "USD" })).rejects.toThrow(/EACCES/);
    expect(await service.read()).toEqual(before);
    expect(await readFile(path, "utf8")).toBe(original);
  });
  it("fails loudly on a filesystem path that is not a directory", async () => {
    await writeFile(path, "keep me");
    await expect(new FileLedgerStore(join(path, "ledger.json")).save(createEmptyLedger())).rejects.toThrow();
    expect(await readFile(path, "utf8")).toBe("keep me");
  });
});
