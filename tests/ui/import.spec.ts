import { test, expect } from "@playwright/test";

const source = 'Statement\nGenerated today\nWhen;Merchant;Debit;Credit\n01/02/2026;Corner Shop;12,34;\n19/02/2026;Salary;;2000,00\n31/02/2026;Broken;1,00;';

test.beforeEach(async ({ page }) => { await page.goto("/"); await expect(page.getByTestId("backend-badge")).toHaveText("mock"); });
test("maps a bank file, previews dates and rejections, confirms, and counts duplicates on repeat", async ({ page }) => {
  await page.getByTestId("csv-file-input").setInputFiles({ name: "bank.csv", mimeType: "text/csv", buffer: Buffer.from(source) });
  const dialog = page.getByRole("dialog", { name: "Import a bank CSV" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/header line 3/i)).toBeVisible();
  await dialog.getByLabel("Date column", { exact: true }).selectOption("0");
  await dialog.getByLabel("Payee column", { exact: true }).selectOption("1");
  await dialog.getByLabel("Amount format").selectOption("split");
  await dialog.getByLabel("Debit column").selectOption("2");
  await dialog.getByLabel("Credit column").selectOption("3");
  await dialog.getByLabel("Decimal separator").selectOption(",");
  await dialog.getByLabel("Date order").selectOption("DMY");
  await dialog.getByRole("button", { name: "Preview import" }).click();
  await expect(dialog.getByTestId("import-counts")).toHaveText("2 accepted · 0 duplicates · 1 rejected");
  await expect(dialog.getByText("2026-02-01", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/Line 6:/)).toBeVisible();
  await dialog.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.getByRole("status")).toContainText("Imported 2 transactions");
  await expect(page.getByRole("cell", { name: "GBP -12.34", exact: true })).toBeVisible();
  await page.getByTestId("csv-file-input").setInputFiles({ name: "bank.csv", mimeType: "text/csv", buffer: Buffer.from(source) });
  await expect(page.getByTestId("import-counts")).toHaveText("0 accepted · 2 duplicates · 1 rejected");
  await expect(page.getByRole("button", { name: "Confirm import" })).toBeDisabled();
});
test("a mapping change disables confirmation until a fresh preview and cancellation writes nothing", async ({ page }) => {
  await page.getByTestId("csv-file-input").setInputFiles({ name: "bank.csv", mimeType: "text/csv", buffer: Buffer.from('Date,Payee,Amount\n01/02/2026,Shop,-1.00') });
  const dialog = page.getByRole("dialog", { name: "Import a bank CSV" });
  await expect(dialog.getByTestId("import-counts")).toContainText("1 accepted");
  await dialog.getByLabel("Date order").selectOption("MDY");
  await expect(dialog.getByRole("button", { name: "Confirm import" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Preview import" }).click();
  await expect(dialog.getByText("2026-01-02", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel import" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Your ledger is empty", { exact: true })).toBeVisible();
});
