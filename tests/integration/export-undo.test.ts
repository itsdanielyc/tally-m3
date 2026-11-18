import { expect, it } from "vitest";
import { readFile, writeFile, readdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { createEmptyLedger } from "../../contracts/ledger";
import { exportTransactions } from "../../domain/export";
import { inspectCsv, suggestMapping } from "../../domain/csv";
import { LedgerService } from "../../domain/service";
import { FileLedgerStore } from "../../electron/ledger-store";
import { readCsvSource } from "../../electron/csv-io";
import { writeCsvExport } from "../../electron/csv-export";
import { createTestDirectory, removeTestDirectory } from "../support/directories";

it("writes an actual CSV and imports its category, Unicode and quoted note into an empty ledger", async () => {
  const directory = await createTestDirectory("export-roundtrip-");
  try {
    const ledger = createEmptyLedger(); ledger.categories.push({ id: "food", name: "Food" });
    ledger.transactions.push({ id: "one", date: "2026-11-18", payee: 'Café, "corner"', amount: -1234, categoryId: "food", note: "line 1\r\nline 2" });
    const primary = join(directory, "ledger.json"); await new FileLedgerStore(primary).save(ledger);
    const before = await readFile(primary, "utf8"); const csvFile = join(directory, "shown.csv");
    await writeCsvExport(csvFile, exportTransactions(ledger.transactions, ledger.categories), primary);
    expect(await readFile(primary, "utf8")).toBe(before);
    const target = await LedgerService.open(new FileLedgerStore(join(directory, "empty.json")));
    const source = await readCsvSource(csvFile); const preview = await target.previewCsv(source, suggestMapping(inspectCsv(source)));
    const imported = await target.execute({ type: "commitImport", token: preview.token });
    expect(imported.ledger.transactions[0]).toMatchObject({ date: "2026-11-18", payee: 'Café, "corner"', amount: -1234, note: "line 1\r\nline 2" });
    expect(imported.ledger.categories.find((category) => category.id === imported.ledger.transactions[0]?.categoryId)?.name).toBe("Food");
  } finally { await removeTestDirectory(directory); }
});
it("refuses export onto the live ledger or its pending file", async () => {
  const directory = await createTestDirectory("protected-export-");
  try {
    const primary = join(directory, "ledger.json"); await writeFile(primary, "preserve ledger"); await writeFile(`${primary}.pending`, "preserve pending");
    await expect(writeCsvExport(primary, "CSV", primary)).rejects.toThrow(/ledger/i);
    await expect(writeCsvExport(`${primary}.pending`, "CSV", primary)).rejects.toThrow(/ledger/i);
    expect(await readFile(primary, "utf8")).toBe("preserve ledger"); expect(await readFile(`${primary}.pending`, "utf8")).toBe("preserve pending");
  } finally { await removeTestDirectory(directory); }
});
it("a denied export rename preserves the prior CSV and removes its temporary file", async () => {
  const directory = await createTestDirectory("failed-export-");
  try {
    const output = join(directory, "shown.csv"); await writeFile(output, "previous CSV");
    await expect(writeCsvExport(output, "new CSV", join(directory, "ledger.json"), { replaceFile: async () => { throw new Error("EACCES: export denied"); } })).rejects.toThrow(/EACCES/);
    expect(await readFile(output, "utf8")).toBe("previous CSV");
    expect((await readdir(directory)).some((name) => name.endsWith(".tmp"))).toBe(false);
  } finally { await removeTestDirectory(directory); }
});
it("a failed undo preserves its slot and disk state, then retries and reopens unchanged", async () => {
  const directory = await createTestDirectory("failed-undo-");
  try {
    const primary = join(directory, "ledger.json"); let deny = false;
    const store = new FileLedgerStore(primary, { replaceFile: async (source, target) => { if (deny) throw new Error("EACCES: undo denied"); await rename(source, target); } });
    const service = await LedgerService.open(store);
    await service.execute({ type: "saveTransaction", transaction: { date: "2026-11-18", payee: "Shop", amount: -1, categoryId: null, note: "" } });
    const original = (await service.read()).ledger;
    const id = original.transactions[0]!.id; await service.execute({ type: "deleteTransaction", id });
    const before = await service.read(); const deletedFile = await readFile(primary, "utf8"); deny = true;
    await expect(service.execute({ type: "undo" })).rejects.toThrow(/EACCES/);
    expect(await service.read()).toEqual(before); expect(await readFile(primary, "utf8")).toBe(deletedFile);
    deny = false; await service.execute({ type: "undo" });
    expect((await (await LedgerService.open(store)).read()).ledger).toEqual(original);
  } finally { await removeTestDirectory(directory); }
});
