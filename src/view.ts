import { SUPPORTED_CURRENCIES, type LedgerSnapshot, type Transaction } from "../contracts/ledger";
import { formatMinorUnits } from "../domain/money";

export type ActiveView = "transactions" | "settings";

/** Escape every value inserted into HTML, including payees imported from external files. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

/** Render a persistent navigation shell around a single active, semantic main surface. */
export function renderApplication(snapshot: LedgerSnapshot, activeView: ActiveView, backendKind: string, error: string): string {
  const content = activeView === "settings" ? renderSettings(snapshot) : renderTransactions(snapshot);
  return `<aside class="sidebar" data-geo="sidebar">
    <a class="wordmark" href="#" aria-label="Tally home"><span class="brand-mark" aria-hidden="true">t</span>Tally<span class="version">0.1</span></a>
    <p class="nav-label">YOUR MONEY, IN VIEW</p>
    <nav aria-label="Main navigation">${navigationButton("transactions", "Transactions", activeView)}${navigationButton("settings", "Settings", activeView)}</nav>
    <div class="sidebar-foot"><span class="local-dot" aria-hidden="true"></span> Stored on this device<br><small data-testid="backend-badge">${backendKind}</small></div>
  </aside>
  <main class="workspace" data-geo="workspace">${content}
    <p class="feedback error" role="alert" ${error ? "" : "hidden"}>${escapeHtml(error)}</p>
    <p class="feedback" role="status">${escapeHtml(snapshot.notice)}</p>
  </main>${renderTransactionDialog(snapshot)}<input id="csv-file-input" data-testid="csv-file-input" type="file" accept=".csv,text/csv" hidden>`;
}

function navigationButton(view: ActiveView, label: string, activeView: ActiveView): string {
  return `<button type="button" data-view="${view}" ${view === activeView ? 'aria-current="page"' : ""}>${label}</button>`;
}

/** O(t+c) time and space: category names are indexed once for the visible transaction list. */
function renderTransactions(snapshot: LedgerSnapshot): string {
  const { ledger } = snapshot;
  const categories = new Map(ledger.categories.map((category) => [category.id, category.name]));
  const rows = ledger.transactions.map((transaction) => renderTransactionRow(transaction, ledger.currency, categories)).join("");
  return `<header class="page-header" data-geo="page-header"><div><p class="eyebrow">THE EVERYDAY LEDGER</p><h1>Transactions</h1><p class="muted">A little clarity for every day.</p></div><div class="header-actions"><button data-action="import" type="button">Import CSV</button><button class="primary" data-action="add" type="button">Add transaction</button></div></header>
    <section class="ledger-panel" data-geo="ledger-panel" aria-label="Transaction ledger">
      <div class="panel-heading"><h2>All transactions <span class="count">${ledger.transactions.length}</span></h2><span class="currency-label">Amounts in ${escapeHtml(ledger.currency)}</span></div>
      ${rows ? `<div class="table-scroll"><table><thead><tr><th scope="col">Date</th><th scope="col">Payee / note</th><th scope="col">Category</th><th scope="col" class="amount">Amount</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty-state" data-geo="empty-state"><div class="empty-icon" aria-hidden="true">≡</div><h3>Your ledger is empty</h3><p>Add your first transaction to start keeping track.</p><button type="button" class="secondary" data-action="add">Add your first transaction</button></div>`}
      <footer class="panel-footer">One ledger. A clearer picture.<span>Everything stays on your computer.</span></footer>
    </section>`;
}

function renderTransactionRow(transaction: Transaction, currency: string, categories: ReadonlyMap<string, string>): string {
  const category = transaction.categoryId ? categories.get(transaction.categoryId) ?? "Uncategorised" : "Uncategorised";
  return `<tr><td class="date">${escapeHtml(transaction.date)}</td><td><strong>${escapeHtml(transaction.payee)}</strong>${transaction.note ? `<small class="row-note">${escapeHtml(transaction.note)}</small>` : ""}</td><td><span class="category-chip">${escapeHtml(category)}</span></td><td class="amount ${transaction.amount > 0 ? "income" : ""}">${escapeHtml(currency)} ${formatMinorUnits(transaction.amount)}</td><td class="row-actions"><button type="button" data-action="edit" data-id="${escapeHtml(transaction.id)}" aria-label="Edit ${escapeHtml(transaction.payee)}">Edit</button><button type="button" data-action="delete" data-id="${escapeHtml(transaction.id)}" aria-label="Delete ${escapeHtml(transaction.payee)}">Delete</button></td></tr>`;
}

function renderSettings(snapshot: LedgerSnapshot): string {
  return `<header class="page-header"><div><p class="eyebrow">MAKE IT YOURS</p><h1>Settings</h1><p class="muted">A simple home for your ledger.</p></div></header>
    <section class="settings-panel"><h2>One ledger, one currency</h2><p>Changing currency relabels existing amounts. It does not convert them.</p><form id="settings-form"><label for="currency">Ledger currency</label><select id="currency" name="currency">${SUPPORTED_CURRENCIES.map((currency) => `<option ${currency === snapshot.ledger.currency ? "selected" : ""}>${currency}</option>`).join("")}</select><button class="primary" type="submit">Save currency</button></form></section>`;
}

function renderTransactionDialog(snapshot: LedgerSnapshot): string {
  return `<dialog id="transaction-dialog" aria-labelledby="transaction-title"><form id="transaction-form"><div class="dialog-heading"><h2 id="transaction-title">Add transaction</h2><button type="button" data-action="cancel-transaction" aria-label="Close transaction form">×</button></div>
    <label for="transaction-date">Date</label><input id="transaction-date" name="date" type="date" required>
    <label for="transaction-payee">Payee</label><input id="transaction-payee" name="payee" maxlength="200" required autocomplete="off">
    <label for="transaction-amount">Amount</label><input id="transaction-amount" name="amount" inputmode="decimal" required aria-describedby="amount-help" placeholder="-12.34"><small id="amount-help">Negative for spending. Positive for income. Use two decimal places.</small>
    <label for="transaction-category">Category <span class="optional">(optional)</span></label><select id="transaction-category" name="category"><option value="">Uncategorised</option>${snapshot.ledger.categories.map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`).join("")}</select>
    <label for="transaction-note">Note <span class="optional" aria-hidden="true">(optional)</span></label><textarea id="transaction-note" name="note" aria-label="Note" rows="3" maxlength="10000"></textarea>
    <p id="transaction-error" class="error" role="alert" hidden></p><div class="dialog-actions"><button type="button" data-action="cancel-transaction">Cancel</button><button class="primary" type="submit">Save transaction</button></div></form></dialog>`;
}
