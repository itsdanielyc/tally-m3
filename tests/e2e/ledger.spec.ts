import { _electron as electron, test, expect, type ElectronApplication, type Page } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createTestDirectory, removeTestDirectory } from "../support/directories";
import { LEDGER_VERSION, type LedgerSnapshot } from "../../contracts/ledger";

let application: ElectronApplication;
let ledgerWindow: Page;
let directory: string;
const consoleErrors: string[] = [];
const BANK_ROW_COUNT = 2000;

async function launchLedger(): Promise<void> {
  application = await electron.launch({ args: ["."], cwd: process.cwd(), env: { ...process.env, TALLY_TEST_MODE: "1", TALLY_DATA_DIR: directory, TALLY_TEST_IMPORT_PATH: join(directory, "bank.csv") } });
  ledgerWindow = await application.firstWindow();
  ledgerWindow.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await ledgerWindow.waitForLoadState("domcontentloaded");
  await expect(ledgerWindow.getByTestId("backend-badge")).toHaveText("native");
}

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
  directory = await createTestDirectory("electron-ledger-");
  const rows = ['18/11/2026,Green Market,-12.50', '19/11/2026,Payday,2000.00', ...Array.from({ length: BANK_ROW_COUNT - 2 }, (_, index) => `01/10/2026,Archive ${index},-1.00`)];
  await writeFile(join(directory, "bank.csv"), `Statement\nGenerated today\nDate,Payee,Amount\n${rows.join("\n")}\n31/02/2026,Rejected,1.00`, "utf8");
  await launchLedger();
});
test.afterAll(async () => { await application?.close(); if (directory) await removeTestDirectory(directory); });

test("native ledger uses the contract across a sandboxed IPC bridge", async () => {
  await expect(ledgerWindow).toHaveTitle("Tally");
  expect(await application.evaluate(() => ({ os: process.platform, arch: process.arch }))).toEqual({ os: process.platform, arch: process.arch });
  const exposed = await ledgerWindow.evaluate(() => ({ require: typeof (window as unknown as { require?: unknown }).require, process: typeof (window as unknown as { process?: unknown }).process }));
  expect(exposed).toEqual({ require: "undefined", process: "undefined" });
  const snapshot: LedgerSnapshot = await ledgerWindow.evaluate(() => window.electronBridge!.ledger.read());
  expect(snapshot.ledger.version).toBe(LEDGER_VERSION);
  expect(snapshot.ledger.transactions).toEqual([]);
  const invalid = await ledgerWindow.evaluate(async () => {
    try {
      await window.electronBridge!.ledger.execute({ type: "saveTransaction", transaction: { date: "2026-11-18", payee: "Invalid", amount: 0.5, categoryId: null, note: "" } });
      return "accepted";
    } catch (error) { return String(error); }
  });
  expect(invalid).toContain("whole minor units");
  await mkdir("artifacts/e2e", { recursive: true });
  await ledgerWindow.screenshot({ path: `artifacts/e2e/ledger-${process.platform}-${process.arch}.png` });
});
test("adds and edits a real transaction then reopens the exact file after process restart", async () => {
  await ledgerWindow.getByRole("button", { name: "Add transaction", exact: true }).click();
  await ledgerWindow.getByLabel("Date", { exact: true }).fill("2026-11-18");
  await ledgerWindow.getByLabel("Payee", { exact: true }).fill("Green Market");
  await ledgerWindow.getByLabel("Amount", { exact: true }).fill("-12.34");
  await ledgerWindow.getByLabel("Note", { exact: true }).fill("Exact note");
  await ledgerWindow.getByRole("button", { name: "Save transaction" }).click();
  await expect(ledgerWindow.getByRole("cell", { name: "GBP -12.34", exact: true })).toBeVisible();
  await ledgerWindow.getByRole("button", { name: "Edit Green Market", exact: true }).click();
  await ledgerWindow.getByLabel("Amount", { exact: true }).fill("-12.35");
  await ledgerWindow.getByRole("button", { name: "Save transaction" }).click();
  await expect(ledgerWindow.getByRole("cell", { name: "GBP -12.35", exact: true })).toBeVisible();
  const source = await readFile(join(directory, "ledger.json"), "utf8");
  await application.close();
  await launchLedger();
  await expect(ledgerWindow.getByRole("cell", { name: "GBP -12.35", exact: true })).toBeVisible();
  expect(await readFile(join(directory, "ledger.json"), "utf8")).toBe(source);
  const snapshot: LedgerSnapshot = await ledgerWindow.evaluate(() => window.electronBridge!.ledger.read());
  expect(snapshot.ledger.transactions[0]).toMatchObject({ date: "2026-11-18", payee: "Green Market", amount: -1235, categoryId: null, note: "Exact note" });
});
test("deletes from the real file and logs no console errors", async () => {
  await ledgerWindow.getByRole("button", { name: "Delete Green Market", exact: true }).click();
  await expect(ledgerWindow.getByText("Your ledger is empty", { exact: true })).toBeVisible();
  expect(JSON.parse(await readFile(join(directory, "ledger.json"), "utf8")).transactions).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("imports 2,000 real CSV rows in under five seconds through the named native-dialog bypass", async () => {
  await ledgerWindow.getByRole("button", { name: "Import CSV", exact: true }).click();
  const dialog = ledgerWindow.getByRole("dialog", { name: "Import a bank CSV" });
  await expect(dialog.getByTestId("import-counts")).toHaveText("2000 accepted · 0 duplicates · 1 rejected");
  await expect(dialog.getByText(/Line 2004:/)).toBeVisible();
  await ledgerWindow.screenshot({ path: `artifacts/e2e/import-preview-${process.platform}-${process.arch}.png` });
  const start = performance.now();
  await dialog.getByRole("button", { name: "Confirm import" }).click();
  await expect(ledgerWindow.getByRole("status")).toContainText("Imported 2000 transactions");
  expect(performance.now() - start).toBeLessThan(5000);
  expect(JSON.parse(await readFile(join(directory, "ledger.json"), "utf8")).transactions).toHaveLength(BANK_ROW_COUNT);
  await ledgerWindow.screenshot({ path: `artifacts/e2e/import-${process.platform}-${process.arch}.png` });
  await ledgerWindow.getByRole("button", { name: "Import CSV", exact: true }).click();
  await expect(dialog.getByTestId("import-counts")).toHaveText("0 accepted · 2000 duplicates · 1 rejected");
  await expect(dialog.getByRole("button", { name: "Confirm import" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancel import" }).click();
});

test("native category rules apply to existing and imported uncategorised rows", async () => {
  await ledgerWindow.getByRole("button", { name: "Categories", exact: true }).click();
  await ledgerWindow.getByLabel("Category name", { exact: true }).fill("Food");
  await ledgerWindow.getByRole("button", { name: "Add category", exact: true }).click();
  await ledgerWindow.getByLabel("Rule contains", { exact: true }).fill("green");
  await ledgerWindow.getByLabel("Rule category").selectOption({ label: "Food" });
  await ledgerWindow.getByRole("button", { name: "Save rule", exact: true }).click();
  await ledgerWindow.getByRole("button", { name: "Apply rules to uncategorised" }).click();
  await expect(ledgerWindow.getByRole("status")).toContainText("Applied rules to 1 transaction");
  await ledgerWindow.screenshot({ path: `artifacts/e2e/categories-${process.platform}-${process.arch}.png` });
  await ledgerWindow.getByRole("button", { name: "Transactions", exact: true }).click();
  await expect(ledgerWindow.getByRole("row").filter({ hasText: "Green Market" }).getByRole("cell", { name: "Food", exact: true })).toBeVisible();
  await writeFile(join(directory, "bank.csv"), 'Date,Payee,Amount\n20/11/2026,Green Market,-2.50', "utf8");
  await ledgerWindow.getByRole("button", { name: "Import CSV", exact: true }).click();
  const dialog = ledgerWindow.getByRole("dialog", { name: "Import a bank CSV" });
  await expect(dialog.getByRole("cell", { name: "Food", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Confirm import" }).click();
  const snapshot = await ledgerWindow.evaluate(() => window.electronBridge!.ledger.read());
  const imported = snapshot.ledger.transactions.find((row) => row.date === "2026-11-20");
  expect(snapshot.ledger.categories.find((category) => category.id === imported?.categoryId)?.name).toBe("Food");
  expect(consoleErrors).toEqual([]);
});

test("native monthly totals and budget equal the exact imported transactions", async () => {
  await ledgerWindow.getByRole("button", { name: "Summary", exact: true }).click();
  await ledgerWindow.getByLabel("Month", { exact: true }).fill("2026-11");
  await ledgerWindow.getByLabel("Month", { exact: true }).press("Tab");
  await expect(ledgerWindow.getByTestId("summary-income")).toHaveText("GBP 2000.00");
  await expect(ledgerWindow.getByTestId("summary-spending")).toHaveText("GBP 15.00");
  await expect(ledgerWindow.getByTestId("summary-balance")).toHaveText("GBP 1985.00");
  await ledgerWindow.getByLabel("Budget for Food", { exact: true }).fill("20.00");
  await ledgerWindow.getByRole("button", { name: "Save budget for Food" }).click();
  await expect(ledgerWindow.getByRole("region", { name: "Category Food" }).getByTestId("budget-remaining")).toHaveText("GBP 5.00 left");
  const saved = JSON.parse(await readFile(join(directory, "ledger.json"), "utf8"));
  const food = saved.categories.find((category: { name: string }) => category.name === "Food");
  expect(saved.budgets["2026-11"][food.id]).toBe(2000);
  await ledgerWindow.screenshot({ path: `artifacts/e2e/summary-${process.platform}-${process.arch}.png` });
  await ledgerWindow.getByRole("button", { name: "Next month" }).click();
  await expect(ledgerWindow.getByTestId("summary-spending")).toHaveText("GBP 0.00");
  await ledgerWindow.getByRole("button", { name: "Previous month" }).click();
  expect(consoleErrors).toEqual([]);
});
