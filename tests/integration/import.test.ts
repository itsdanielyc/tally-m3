import { expect, it } from "vitest";
import { rename, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { LedgerService } from "../../domain/service";
import { FileLedgerStore } from "../../electron/ledger-store";
import { createTestDirectory, removeTestDirectory } from "../support/directories";
import { readCsvSource } from "../../electron/csv-io";

it("an import failing after a real flush publishes none of its rows and can be retried", async () => {
  const directory = await createTestDirectory("atomic-import-");
  try {
    const file = join(directory, "ledger.json");
    let denyReplacement = false;
    const service = await LedgerService.open(new FileLedgerStore(file, { replaceFile: async (source, target) => { if (denyReplacement) throw new Error("EACCES: import commit denied"); await rename(source, target); } }));
    await service.execute({ type: "setCurrency", currency: "USD" });
    const before = await service.read();
    const original = await readFile(file, "utf8");
    const preview = await service.previewCsv('Date,Payee,Amount\n18/11/2026,One,-1.00\n18/11/2026,Two,-2.00', { date: 0, payee: 1, amount: 2, debit: null, credit: null, dateOrder: "DMY", decimalSeparator: "." });
    denyReplacement = true;
    await expect(service.execute({ type: "commitImport", token: preview.token })).rejects.toThrow(/EACCES/);
    expect(await service.read()).toEqual(before);
    expect(await readFile(file, "utf8")).toBe(original);
    denyReplacement = false;
    expect((await service.execute({ type: "commitImport", token: preview.token })).ledger.transactions).toHaveLength(2);
    expect(JSON.parse(await readFile(file, "utf8")).transactions).toHaveLength(2);
  } finally { await removeTestDirectory(directory); }
});

it("imports actual UTF-8 and BOM-labelled UTF-16 files without changing non-ASCII payees", async () => {
  const directory = await createTestDirectory("csv-encoding-");
  try {
    const source = 'Date,Payee,Amount\n18/11/2026,Café,-1.23';
    const encodings = [Buffer.from(source, "utf8"), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(source, "utf16le")])];
    for (const [index, bytes] of encodings.entries()) {
      const input = join(directory, `bank-${index}.csv`);
      await writeFile(input, bytes);
      const service = await LedgerService.open(new FileLedgerStore(join(directory, `ledger-${index}.json`)));
      const preview = await service.previewCsv(await readCsvSource(input), { date: 0, payee: 1, amount: 2, debit: null, credit: null, dateOrder: "DMY", decimalSeparator: "." });
      expect((await service.execute({ type: "commitImport", token: preview.token })).ledger.transactions[0]).toMatchObject({ payee: "Café", amount: -123 });
    }
  } finally { await removeTestDirectory(directory); }
});

it("rejects malformed text encoding instead of silently changing a payee", async () => {
  const directory = await createTestDirectory("invalid-csv-text-");
  try {
    const file = join(directory, "bad.csv");
    const bytes = Buffer.concat([Buffer.from('Date,Payee,Amount\n18/11/2026,Caf'), Buffer.from([0xff]), Buffer.from(',-1.00')]);
    await writeFile(file, bytes);
    await expect(readCsvSource(file)).rejects.toThrow(/UTF-8|UTF-16/);
    expect(await readFile(file)).toEqual(bytes);
  } finally { await removeTestDirectory(directory); }
});
