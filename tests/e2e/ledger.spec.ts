import { _electron as electron, test, expect, type ElectronApplication, type Page } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createTestDirectory, removeTestDirectory } from "../support/directories";
import { LEDGER_VERSION, type LedgerSnapshot } from "../../contracts/ledger";

let application: ElectronApplication;
let ledgerWindow: Page;
let directory: string;
const consoleErrors: string[] = [];

async function launchLedger(): Promise<void> {
  application = await electron.launch({ args: ["."], cwd: process.cwd(), env: { ...process.env, TALLY_TEST_MODE: "1", TALLY_DATA_DIR: directory } });
  ledgerWindow = await application.firstWindow();
  ledgerWindow.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await ledgerWindow.waitForLoadState("domcontentloaded");
  await expect(ledgerWindow.getByTestId("backend-badge")).toHaveText("native");
}

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => { directory = await createTestDirectory("electron-ledger-"); await launchLedger(); });
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
