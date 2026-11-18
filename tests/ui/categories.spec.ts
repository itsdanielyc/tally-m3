import { test, expect, type Page } from "@playwright/test";

async function categories(page: Page): Promise<void> {
  const button = page.getByRole("button", { name: "Categories", exact: true });
  await expect(button).toBeVisible(); await button.click();
}
async function addCategory(page: Page, name: string): Promise<void> {
  await page.getByLabel("Category name", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Category created");
}
test.beforeEach(async ({ page }) => { await page.goto("/"); await expect(page.getByTestId("backend-badge")).toHaveText("mock"); });
test("rules categorise existing uncategorised and imported transactions", async ({ page }) => {
  await page.getByRole("button", { name: "Add transaction", exact: true }).click();
  await page.getByLabel("Date", { exact: true }).fill("2026-11-18");
  await page.getByLabel("Payee", { exact: true }).fill("Green Store");
  await page.getByLabel("Amount", { exact: true }).fill("-10.00");
  await page.getByRole("button", { name: "Save transaction" }).click();
  await categories(page); await addCategory(page, "Food");
  await page.getByLabel("Rule contains", { exact: true }).fill("green");
  await page.getByLabel("Rule category").selectOption({ label: "Food" });
  await page.getByRole("button", { name: "Save rule", exact: true }).click();
  await page.getByRole("button", { name: "Apply rules to uncategorised" }).click();
  await page.getByRole("button", { name: "Transactions", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Food", exact: true })).toBeVisible();
  await page.getByTestId("csv-file-input").setInputFiles({ name: "bank.csv", mimeType: "text/csv", buffer: Buffer.from('Date,Payee,Amount\n19/11/2026,Green Shop,-1.00') });
  const dialog = page.getByRole("dialog", { name: "Import a bank CSV" });
  await expect(dialog.getByRole("cell", { name: "Food", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.getByRole("cell", { name: "Food", exact: true })).toHaveCount(2);
});
test("renames, merges and deletes categories and edits their rules", async ({ page }) => {
  await categories(page); await addCategory(page, "Food"); await addCategory(page, "Home");
  await page.getByLabel("Rule contains", { exact: true }).fill("shop");
  await page.getByLabel("Rule category").selectOption({ label: "Food" });
  await page.getByRole("button", { name: "Save rule", exact: true }).click();
  await page.getByRole("button", { name: "Rename Food", exact: true }).click();
  await page.getByLabel("Category name", { exact: true }).fill("Groceries");
  await page.getByRole("button", { name: "Save category", exact: true }).click();
  await page.getByLabel("Merge source").selectOption({ label: "Groceries" });
  await page.getByLabel("Merge target").selectOption({ label: "Home" });
  await page.getByRole("button", { name: "Merge categories", exact: true }).click();
  await expect(page.getByRole("button", { name: "Rename Groceries", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Edit rule shop", exact: true }).click();
  await page.getByLabel("Rule contains", { exact: true }).fill("corner");
  await page.getByRole("button", { name: "Save rule", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit rule corner", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete Home", exact: true }).click();
  await expect(page.getByText("No categories yet.", { exact: true })).toBeVisible();
  await expect(page.getByText("No rules yet.", { exact: true })).toBeVisible();
});
test("a rejected duplicate category retains the entered name", async ({ page }) => {
  await categories(page); await addCategory(page, "Food");
  await page.getByLabel("Category name", { exact: true }).fill("FOOD");
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("already exists");
  await expect(page.getByLabel("Category name", { exact: true })).toHaveValue("FOOD");
});
