import type { Category } from "../contracts/ledger";
import type { TransactionFilters, TransactionPage } from "../domain/find";
import { formatMinorUnits } from "../domain/money";
import { escapeHtml } from "./html";

export const TRANSACTION_PAGE_SIZE = 50;
export const CATEGORY_FILTER_PREFIX = "category:";
export interface TransactionViewState { filters: TransactionFilters; page: number }

/** Keep drafts in the form until explicit application, preserving typing focus and validation errors. */
export function renderFindControls(filters: TransactionFilters, categories: readonly Category[]): string {
  const advanced = !!(filters.fromDate || filters.toDate || filters.minimumAmount !== null || filters.maximumAmount !== null);
  return `<form id="filter-form" class="filter-panel"><div class="filter-primary"><div><label for="filter-query">Search payee and note</label><input id="filter-query" value="${escapeHtml(filters.query)}" placeholder="Find a transaction…" autocomplete="off"></div><div><label for="filter-category">Filter category</label><select id="filter-category"><option value="all" ${filters.categoryId === undefined ? "selected" : ""}>All categories</option><option value="uncategorised" ${filters.categoryId === null ? "selected" : ""}>Uncategorised</option>${categories.map((category) => `<option value="${CATEGORY_FILTER_PREFIX}${escapeHtml(category.id)}" ${filters.categoryId === category.id ? "selected" : ""}>${escapeHtml(category.name)}</option>`).join("")}</select></div><button type="submit">Apply filters</button><button type="button" data-action="clear-filters">Clear filters</button></div>
    <details ${advanced ? "open" : ""}><summary>Date and amount filters</summary><div class="filter-bounds"><div><label for="filter-from">From date</label><input id="filter-from" type="date" value="${filters.fromDate ?? ""}"></div><div><label for="filter-to">To date</label><input id="filter-to" type="date" value="${filters.toDate ?? ""}"></div><div><label for="filter-minimum">Minimum amount</label><input id="filter-minimum" inputmode="decimal" value="${filters.minimumAmount === null ? "" : formatMinorUnits(filters.minimumAmount)}" placeholder="-100.00"></div><div><label for="filter-maximum">Maximum amount</label><input id="filter-maximum" inputmode="decimal" value="${filters.maximumAmount === null ? "" : formatMinorUnits(filters.maximumAmount)}" placeholder="0.00"></div></div><small>Bounds include the entered values. Negative amounts are spending; positive amounts are income.</small></details></form>`;
}

export function renderPager(page: TransactionPage): string {
  const first = page.totalCount ? page.offset + 1 : 0;
  return `<div class="pager"><span data-testid="page-count">${first}–${page.offset + page.rows.length} of ${page.totalCount}</span><div><button type="button" data-page="${Math.max(0, page.page - 1)}" aria-label="Previous page" ${page.page === 0 ? "disabled" : ""}>Previous</button><button type="button" data-page="${page.page + 1}" aria-label="Next page" ${page.page >= page.totalPages - 1 ? "disabled" : ""}>Next</button></div></div>`;
}
