import { test, expect, type Page } from "@playwright/test";

async function foodCategory(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Categories", exact: true }).click();
  await page.getByLabel("Category name", { exact: true }).fill("Food");
  await page.getByRole("button", { name: "Add category", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Category created");
}
async function transaction(page: Page, payee: string, amount: string, category?: string): Promise<void> {
  await page.getByRole("button", { name: "Transactions", exact: true }).click();
  await page.getByRole("button", { name: "Add transaction", exact: true }).click();
  await page.getByLabel("Date", { exact: true }).fill("2026-11-18");
  await page.getByLabel("Payee", { exact: true }).fill(payee);
  await page.getByLabel("Amount", { exact: true }).fill(amount);
  if (category) await page.getByLabel("Category", { exact: true }).selectOption({ label: category });
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(page.getByRole("status")).toContainText("Transaction saved");
}
test.beforeEach(async ({ page }) => { await page.goto("/"); await expect(page.getByTestId("backend-badge")).toHaveText("mock"); });

test("shows exact monthly totals and saves an independent budget for the selected month", async ({ page }) => {
  await foodCategory(page);
  await transaction(page, "Shop", "-12.50", "Food");
  await transaction(page, "Salary", "100.00");
  const summary = page.getByRole("button", { name: "Summary", exact: true });
  await expect(summary).toBeVisible(); await summary.click();
  await page.getByLabel("Month", { exact: true }).fill("2026-11");
  await page.getByLabel("Month", { exact: true }).press("Tab");
  await expect(page.getByTestId("summary-income")).toHaveText("GBP 100.00");
  await expect(page.getByTestId("summary-spending")).toHaveText("GBP 12.50");
  await expect(page.getByTestId("summary-balance")).toHaveText("GBP 87.50");
  await page.getByLabel("Budget for Food", { exact: true }).fill("20.00");
  await page.getByRole("button", { name: "Save budget for Food" }).click();
  await expect(page.getByRole("region", { name: "Category Food" }).getByTestId("budget-remaining")).toHaveText("GBP 7.50 left");
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.getByLabel("Month", { exact: true })).toHaveValue("2026-12");
  await expect(page.getByTestId("summary-spending")).toHaveText("GBP 0.00");
  await expect(page.getByLabel("Budget for Food", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(page.getByLabel("Budget for Food", { exact: true })).toHaveValue("20.00");
});
test("moves across years and rejects a negative budget without losing the input", async ({ page }) => {
  await foodCategory(page);
  await expect(page.getByRole("button", { name: "Summary", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Summary", exact: true }).click();
  await page.getByLabel("Month", { exact: true }).fill("2026-01");
  await page.getByLabel("Month", { exact: true }).press("Tab");
  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(page.getByLabel("Month", { exact: true })).toHaveValue("2025-12");
  await page.getByRole("button", { name: "Next month" }).click();
  await page.getByLabel("Budget for Food", { exact: true }).fill("-0.01");
  await page.getByRole("button", { name: "Save budget for Food" }).click();
  await expect(page.getByRole("alert")).toContainText("negative");
  await expect(page.getByLabel("Budget for Food", { exact: true })).toHaveValue("-0.01");
  await page.getByLabel("Budget for Food", { exact: true }).fill("0.00");
  await page.getByRole("button", { name: "Save budget for Food" }).click();
  await expect(page.getByRole("region", { name: "Category Food" }).getByTestId("budget-remaining")).toHaveText("GBP 0.00 left");
});
