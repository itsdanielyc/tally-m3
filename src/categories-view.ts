import type { Category, LedgerSnapshot } from "../contracts/ledger";
import { escapeHtml } from "./html";

function categoryOptions(categories: readonly Category[], selected?: string): string {
  return categories.map((category) => `<option value="${escapeHtml(category.id)}" ${category.id === selected ? "selected" : ""}>${escapeHtml(category.name)}</option>`).join("");
}

/** Index counts/names once. O(t+c log c+r) time, O(c+r) auxiliary space. */
export function renderCategories(snapshot: LedgerSnapshot): string {
  const { ledger } = snapshot;
  const categories = [...ledger.categories].sort((left, right) => left.name.localeCompare(right.name));
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const counts = new Map<string, number>();
  let uncategorised = 0;
  for (const transaction of ledger.transactions) {
    if (transaction.categoryId === null) uncategorised += 1;
    else counts.set(transaction.categoryId, (counts.get(transaction.categoryId) ?? 0) + 1);
  }
  const rows = categories.map((category) => `<tr><td><strong>${escapeHtml(category.name)}</strong><small class="row-note">${counts.get(category.id) ?? 0} transactions</small></td><td class="row-actions"><button type="button" data-category-action="rename" data-id="${escapeHtml(category.id)}" aria-label="Rename ${escapeHtml(category.name)}">Rename</button><button type="button" data-category-action="delete-category" data-id="${escapeHtml(category.id)}" aria-label="Delete ${escapeHtml(category.name)}">Delete</button></td></tr>`).join("");
  const rules = ledger.rules.map((rule, index) => `<tr><td>${index + 1}. <strong>${escapeHtml(rule.contains)}</strong><small class="row-note">${escapeHtml(names.get(rule.categoryId) ?? "Missing category")}</small></td><td class="row-actions"><button type="button" data-category-action="edit-rule" data-id="${escapeHtml(rule.id)}" aria-label="Edit rule ${escapeHtml(rule.contains)}">Edit</button><button type="button" data-category-action="delete-rule" data-id="${escapeHtml(rule.id)}" aria-label="Delete rule ${escapeHtml(rule.contains)}">Delete</button></td></tr>`).join("");
  const options = categoryOptions(categories);
  return `<header class="page-header"><div><p class="eyebrow">GIVE EVERYDAY SPENDING A HOME</p><h1>Categories and rules</h1><p class="muted">Organise your ledger your way.</p></div></header>
    <div id="category-workspace"><div class="management-grid"><section class="management-panel"><h2>Categories</h2><form id="category-form"><label for="category-name">Category name</label><input id="category-name" required maxlength="100" autocomplete="off"><div class="form-actions"><button type="submit" class="primary" id="category-save">Add category</button><button type="button" id="category-cancel" hidden>Cancel category edit</button></div></form>
    ${rows ? `<table aria-label="Categories"><tbody>${rows}</tbody></table>` : '<p class="muted">No categories yet.</p>'}<p class="muted">${uncategorised} uncategorised transactions. Deleting a category removes its rules and budgets; its transactions remain.</p></section>
    <section class="management-panel"><h2>Payee rules</h2><p class="muted">Contains matching ignores case. The first matching rule wins; manually assigned categories stay as they are.</p><form id="rule-form"><label for="rule-contains">Rule contains</label><input id="rule-contains" required maxlength="200" autocomplete="off" ${categories.length ? "" : "disabled"}><label for="rule-category">Rule category</label><select id="rule-category" ${categories.length ? "" : "disabled"}>${options || '<option value="">Create a category first</option>'}</select><div class="form-actions"><button type="submit" class="primary" ${categories.length ? "" : "disabled"}>Save rule</button><button type="button" id="rule-cancel" hidden>Cancel rule edit</button></div></form>
    ${rules ? `<table aria-label="Payee rules"><tbody>${rules}</tbody></table>` : '<p class="muted">No rules yet.</p>'}<button type="button" data-category-action="apply-rules" ${ledger.rules.length && uncategorised ? "" : "disabled"}>Apply rules to uncategorised</button></section></div>
    <section class="management-panel"><h2>Merge categories</h2><p class="muted">Move every transaction, rule and budget into the target category. Monthly budgets are added together.</p><form id="merge-form" class="merge-form"><div><label for="merge-source">Merge source</label><select id="merge-source">${options}</select></div><div><label for="merge-target">Merge target</label><select id="merge-target">${categoryOptions(categories, categories[1]?.id)}</select></div><button type="submit" ${categories.length < 2 ? "disabled" : ""}>Merge categories</button></form></section></div>`;
}
