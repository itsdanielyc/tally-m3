import { test, expect, type Page } from "@playwright/test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { captureGeometry, assertGeometry } from "./geometry";

async function addTransaction(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Add transaction", exact: true }).click();
  await page.getByLabel("Date", { exact: true }).fill("2026-11-18");
  await page.getByLabel("Payee", { exact: true }).fill("Green Market");
  await page.getByLabel("Amount", { exact: true }).fill("-12.34");
  await page.getByLabel("Note", { exact: true }).fill("Milk & bread");
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(page.getByRole("status")).toContainText("Transaction saved");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("backend-badge")).toHaveText("mock");
  await expect(page.getByRole("heading", { name: "Transactions", exact: true })).toBeVisible();
});

test("records, edits and deletes a transaction through the labelled mock", async ({ page }) => {
  await addTransaction(page);
  await expect(page.getByRole("cell", { name: "GBP -12.34", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit Green Market", exact: true }).click();
  await page.getByLabel("Amount", { exact: true }).fill("-12.35");
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(page.getByRole("cell", { name: "GBP -12.35", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete Green Market", exact: true }).click();
  await expect(page.getByText("Your ledger is empty", { exact: true })).toBeVisible();
});
test("invalid fractional cents stay in the form with an actionable error", async ({ page }) => {
  await page.getByRole("button", { name: "Add transaction", exact: true }).click();
  await page.getByLabel("Payee", { exact: true }).fill("Shop");
  await page.getByLabel("Amount", { exact: true }).fill("0.001");
  await page.getByRole("button", { name: "Save transaction" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Amount");
  await expect(page.getByRole("dialog")).toBeVisible();
});
test("settings changes the one currency without changing stored minor units", async ({ page }) => {
  await addTransaction(page);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Ledger currency").selectOption("USD");
  await page.getByRole("button", { name: "Save currency" }).click();
  await page.getByRole("button", { name: "Transactions", exact: true }).click();
  await expect(page.getByRole("cell", { name: "USD -12.34", exact: true })).toBeVisible();
});
test("tier 1: ledger accessibility structure", async ({ page }) => {
  await expect(page.locator("main")).toMatchAriaSnapshot({ name: "ledger.aria.yml" });
});
test("tier 2: ledger geometry", async ({ page }) => {
  assertGeometry(join(test.info().project.testDir, "__snapshots__", "transactions.spec.ts", "ledger.geometry.json"), await captureGeometry(page));
});
test("tier 3: ledger pixels", async ({ page }, info) => {
  const name = `ledger-${info.project.name}-${process.platform}.png`;
  test.skip(!process.env.CI && !existsSync(join(info.project.testDir, "__snapshots__", "transactions.spec.ts", name)), "runner baseline pending");
  await expect(page).toHaveScreenshot(name, { fullPage: true });
});
