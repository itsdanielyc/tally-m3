import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createEmptyLedger } from "../../contracts/ledger";
import { inspectCsv, prepareImport, suggestMapping } from "../../domain/csv";

async function transaction(page: Page, payee: string, amount: string, note: string): Promise<void> {
  await page.getByRole("button", { name: "Add transaction", exact: true }).click();
  await page.getByLabel("Date", { exact: true }).fill("2026-11-18"); await page.getByLabel("Payee", { exact: true }).fill(payee);
  await page.getByLabel("Amount", { exact: true }).fill(amount); await page.getByLabel("Note", { exact: true }).fill(note);
  await page.getByRole("button", { name: "Save transaction" }).click(); await expect(page.getByRole("status")).toContainText("Transaction saved");
}
test.beforeEach(async ({ page }) => { await page.goto("/"); await expect(page.getByTestId("backend-badge")).toHaveText("mock"); });
test("finds note text with inclusive signed ranges and exports only matching rows", async ({ page }, info) => {
  await transaction(page, "Shop", "-12.50", 'Milk, "bread"'); await transaction(page, "Salary", "100.00", "Payday");
  const search = page.getByLabel("Search payee and note", { exact: true }); await expect(search).toBeVisible(); await search.fill("MILK");
  await page.getByText("Date and amount filters", { exact: true }).click();
  await page.getByLabel("From date", { exact: true }).fill("2026-11-18"); await page.getByLabel("To date", { exact: true }).fill("2026-11-18");
  await page.getByLabel("Minimum amount", { exact: true }).fill("-12.50"); await page.getByLabel("Maximum amount", { exact: true }).fill("-12.50");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "Salary" })).toHaveCount(0);
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const file = info.outputPath("filtered.csv"); await (await download).saveAs(file);
  const source = await readFile(file, "utf8"); const preview = prepareImport(source, suggestMapping(inspectCsv(source)), createEmptyLedger());
  expect(preview.accepted).toHaveLength(1); expect(preview.accepted[0]).toMatchObject({ payee: "Shop", amount: -1250, note: 'Milk, "bread"' });
  await expect(page.getByRole("status")).toContainText("Exported 1 transaction");
  await page.getByRole("button", { name: "Clear filters", exact: true }).click(); await expect(page.getByRole("row").filter({ hasText: "Salary" })).toBeVisible();
});
test("exports every matching page and filters uncategorised rows", async ({ page }, info) => {
  const source = 'Date,Payee,Amount\n' + Array.from({ length: 125 }, (_, index) => `2026-11-18,Shop ${index},-1.00`).join("\n");
  await page.getByTestId("csv-file-input").setInputFiles({ name: "many.csv", mimeType: "text/csv", buffer: Buffer.from(source) });
  await page.getByRole("button", { name: "Confirm import" }).click();
  await page.getByLabel("Filter category", { exact: true }).selectOption("uncategorised"); await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page.getByTestId("page-count")).toContainText("1–50 of 125");
  await page.getByRole("button", { name: "Next page", exact: true }).click(); await expect(page.getByTestId("page-count")).toContainText("51–100 of 125");
  const download = page.waitForEvent("download"); await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const file = info.outputPath("all-pages.csv"); await (await download).saveAs(file);
  const csv = await readFile(file, "utf8"); expect(prepareImport(csv, suggestMapping(inspectCsv(csv)), createEmptyLedger()).accepted).toHaveLength(125);
});
test("undoes one delete and clears the slot after a later mutation", async ({ page }) => {
  await transaction(page, "Shop", "-1.00", ""); await page.getByRole("button", { name: "Delete Shop", exact: true }).click();
  await page.getByRole("button", { name: "Undo transaction delete", exact: true }).click(); await expect(page.getByRole("cell", { name: "Shop", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Delete Shop", exact: true }).click(); await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Ledger currency").selectOption("USD"); await page.getByRole("button", { name: "Save currency" }).click();
  await expect(page.getByRole("button", { name: "Undo", exact: true })).toBeDisabled();
});
