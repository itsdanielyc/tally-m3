import type { LedgerSnapshot } from "../contracts/ledger";
import { monthlySummary, type CategorySummary } from "../domain/summary";
import { formatMinorUnits } from "../domain/money";
import { escapeHtml } from "./html";

const ZERO_BUDGET_PROGRESS_CAP = 1;

/** Render totals from the same ledger snapshot that feeds the transaction list. */
export function renderSummary(snapshot: LedgerSnapshot, month: string): string {
  const summary = monthlySummary(snapshot.ledger, month);
  const currency = snapshot.ledger.currency;
  const amount = (value: bigint): string => `${escapeHtml(currency)} ${formatMinorUnits(value)}`;
  const title = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  return `<header class="page-header"><div><p class="eyebrow">THE MONTH, IN PERSPECTIVE</p><h1>Monthly summary</h1><p class="muted">${escapeHtml(title)} · ${summary.transactionCount} transactions</p></div><div class="month-controls"><button type="button" id="previous-month" aria-label="Previous month" ${month === "0001-01" ? "disabled" : ""}>←</button><label class="sr-only" for="summary-month">Month</label><input id="summary-month" type="month" min="0001-01" max="9999-12" value="${month}"><button type="button" id="next-month" aria-label="Next month" ${month === "9999-12" ? "disabled" : ""}>→</button></div></header>
    <div class="summary-overview"><section class="summary-stat"><h2>Income</h2><p data-testid="summary-income" class="income">${amount(summary.income)}</p></section><section class="summary-stat"><h2>Spending</h2><p data-testid="summary-spending">${amount(summary.spending)}</p></section><section class="summary-stat"><h2>Balance</h2><p data-testid="summary-balance">${amount(summary.balance)}</p></section></div>
    <section id="summary-categories" aria-label="Category totals and budgets"><h2>Categories and budgets</h2><p class="muted">Budgets use net spending. Credits and refunds in a category add back to its amount left.</p><div class="summary-grid">${summary.categories.map((category) => categoryCard(category, currency)).join("") || '<p class="muted">No category activity this month. Create categories to set monthly budgets.</p>'}</div></section>`;
}

function categoryCard(category: CategorySummary, currency: string): string {
  const amount = (value: number | bigint): string => `${escapeHtml(currency)} ${formatMinorUnits(value)}`;
  const hasBudget = category.budget !== undefined;
  const remaining = category.remaining;
  const label = remaining === null ? "No budget set" : remaining < 0n ? `Over by ${amount(-remaining)}` : `${amount(remaining)} left`;
  const used = category.net < 0n ? -category.net : 0n;
  const cap = category.budget && category.budget > 0 ? category.budget : ZERO_BUDGET_PROGRESS_CAP;
  const progress = used > BigInt(cap) ? cap : Number(used);
  return `<section class="summary-category" aria-label="Category ${escapeHtml(category.name)}"><h3>${escapeHtml(category.name)}</h3><dl class="category-totals"><div><dt>Income</dt><dd>${amount(category.income)}</dd></div><div><dt>Spending</dt><dd>${amount(category.spending)}</dd></div><div><dt>Net</dt><dd>${amount(category.net)}</dd></div></dl>
    ${category.categoryId === null ? '<p class="muted">Assign a category to budget these transactions.</p>' : `<form class="budget-form" data-category-id="${escapeHtml(category.categoryId)}"><label for="budget-${escapeHtml(category.categoryId)}">Budget for ${escapeHtml(category.name)}</label><div class="budget-input"><input id="budget-${escapeHtml(category.categoryId)}" inputmode="decimal" required placeholder="Not set" value="${hasBudget ? formatMinorUnits(category.budget!) : ""}"><button type="submit" aria-label="Save budget for ${escapeHtml(category.name)}">Save</button></div></form>`}
    <p data-testid="budget-remaining" class="budget-remaining ${remaining !== null && remaining < 0n ? "error" : ""}">${label}</p>${hasBudget ? `<progress aria-label="Budget used for ${escapeHtml(category.name)}" max="${cap}" value="${progress}" class="${remaining !== null && remaining < 0n ? "over-budget" : ""}"></progress>` : ""}</section>`;
}
