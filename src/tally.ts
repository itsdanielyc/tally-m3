import "./tally.css";
import { ledgerBackend } from "./api";
import { renderApplication, type ActiveView } from "./view";
import { formatMinorUnits, parseMinorUnits } from "../domain/money";
import type { LedgerCommand, LedgerSnapshot } from "../contracts/ledger";
import { openImportDialog } from "./import-dialog";
import { bindCategoryEvents } from "./category-controller";
import { disableControls } from "./controls";
import { bindSummaryEvents } from "./summary-controller";
import { validateMonth } from "../domain/summary";
import { defaultFilters, filterTransactions, validateFilters, type TransactionFilters } from "../domain/find";
import { exportTransactions } from "../domain/export";
import { bindFindEvents } from "./find-controller";

let snapshot: LedgerSnapshot;
let activeView: ActiveView = "transactions";
let editingTransactionId: string | undefined;
let busy = false;
let errorMessage = "";
const initialDate = new Date();
let selectedMonth = `${initialDate.getFullYear()}-${String(initialDate.getMonth() + 1).padStart(2, "0")}`;
let filters = defaultFilters();
let currentPage = 0;

/** Require a known view element; a broken template fails at its source rather than later. */
function element<T extends HTMLElement>(id: string): T {
  const result = document.getElementById(id);
  if (!result) throw new Error(`Missing UI element: ${id}`);
  return result as T;
}

function render(): void {
  if (filters.categoryId !== undefined && filters.categoryId !== null && !snapshot.ledger.categories.some((category) => category.id === filters.categoryId)) filters = { ...filters, categoryId: undefined };
  document.body.className = "tally-app";
  document.body.innerHTML = renderApplication(snapshot, activeView, ledgerBackend.kind, errorMessage, selectedMonth, { filters, page: currentPage });
  bindCategoryEvents(snapshot, execute);
  bindSummaryEvents(selectedMonth, changeMonth, execute, reportOperationError);
  bindFindEvents(applyFilters, (page) => { currentPage = page; render(); }, reportOperationError);
  document.getElementById("transaction-form")?.addEventListener("submit", (event) => { event.preventDefault(); void saveTransaction(); });
  document.getElementById("settings-form")?.addEventListener("submit", (event) => {
    event.preventDefault(); void execute({ type: "setCurrency", currency: element<HTMLSelectElement>("currency").value });
  });
  document.getElementById("csv-file-input")?.addEventListener("change", (event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (file) void file.text().then(showImport).catch(reportOperationError);
  });
}

function showImport(source: string): void {
  try { openImportDialog(source, snapshot, ledgerBackend, (next) => { snapshot = next; activeView = "transactions"; filters = defaultFilters(); currentPage = 0; errorMessage = ""; render(); }); }
  catch (error) { reportOperationError(error); }
}

function reportOperationError(error: unknown): void {
  errorMessage = describeError(error);
  const alert = document.querySelector<HTMLElement>('main [role="alert"]');
  if (alert) { alert.textContent = errorMessage; alert.hidden = false; }
  else render();
}

function changeMonth(month: string): void {
  try { selectedMonth = validateMonth(month); errorMessage = ""; render(); }
  catch (error) { reportOperationError(error); }
}

function applyFilters(next: TransactionFilters): void {
  try { validateFilters(next); filters = next; currentPage = 0; errorMessage = ""; render(); }
  catch (error) { reportOperationError(error); }
}

async function exportShownTransactions(): Promise<void> {
  if (busy) return;
  const main = document.querySelector("main");
  const restore = main ? disableControls(main) : () => {};
  busy = true;
  try {
    const shown = filterTransactions(snapshot.ledger.transactions, filters);
    if (!shown.length) return;
    const saved = await ledgerBackend.exportCsv(exportTransactions(shown, snapshot.ledger.categories));
    snapshot.notice = saved ? `Exported ${shown.length} transaction${shown.length === 1 ? "" : "s"} to CSV.` : "Export cancelled.";
    errorMessage = ""; render();
  } catch (error) { reportOperationError(error); }
  finally { busy = false; restore(); }
}

async function chooseImportFile(): Promise<void> {
  if (ledgerBackend.kind === "mock") { element<HTMLInputElement>("csv-file-input").click(); return; }
  busy = true;
  try { const source = await ledgerBackend.openCsv(); if (source !== null) showImport(source); }
  catch (error) { reportOperationError(error); }
  finally { busy = false; }
}

/** Mutations retain the previous view on error and publish only the confirmed snapshot. */
async function execute(command: LedgerCommand): Promise<boolean> {
  if (busy) return false;
  busy = true;
  errorMessage = "";
  const main = document.querySelector("main");
  const restoreControls = main ? disableControls(main) : () => {};
  try { snapshot = await ledgerBackend.execute(command); render(); return true; }
  catch (error) {
    reportOperationError(error);
    return false;
  }
  finally { busy = false; restoreControls(); }
}

function openTransaction(id?: string): void {
  editingTransactionId = id;
  element("transaction-error").hidden = true;
  element("transaction-error").textContent = "";
  const transaction = snapshot.ledger.transactions.find((row) => row.id === id);
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  element("transaction-title").textContent = transaction ? "Edit transaction" : "Add transaction";
  element<HTMLInputElement>("transaction-date").value = transaction?.date ?? todayISO;
  element<HTMLInputElement>("transaction-payee").value = transaction?.payee ?? "";
  element<HTMLInputElement>("transaction-amount").value = transaction ? formatMinorUnits(transaction.amount) : "";
  element<HTMLSelectElement>("transaction-category").value = transaction?.categoryId ?? "";
  element<HTMLTextAreaElement>("transaction-note").value = transaction?.note ?? "";
  element<HTMLDialogElement>("transaction-dialog").showModal();
}

async function saveTransaction(): Promise<void> {
  if (busy) return;
  const alert = element("transaction-error");
  const submit = document.querySelector<HTMLButtonElement>("#transaction-form button[type=submit]")!;
  let restoreForm: (() => void) | undefined;
  try {
    const transaction = {
      date: element<HTMLInputElement>("transaction-date").value,
      payee: element<HTMLInputElement>("transaction-payee").value,
      amount: parseMinorUnits(element<HTMLInputElement>("transaction-amount").value),
      categoryId: element<HTMLSelectElement>("transaction-category").value || null,
      note: element<HTMLTextAreaElement>("transaction-note").value,
    };
    restoreForm = disableControls(element("transaction-form"));
    busy = true; submit.disabled = true;
    snapshot = await ledgerBackend.execute({ type: "saveTransaction", transaction, id: editingTransactionId });
    filters = defaultFilters(); currentPage = 0; errorMessage = ""; render();
    document.querySelector<HTMLButtonElement>('[data-action="add"]')?.focus();
  } catch (error) { alert.textContent = describeError(error); alert.hidden = false; }
  finally { busy = false; restoreForm?.(); if (submit.isConnected) submit.disabled = false; }
}

document.body.addEventListener("click", (event) => {
  const target = (event.target as Element).closest<HTMLElement>("button, .wordmark");
  if (!target || busy) return;
  if (target.classList.contains("wordmark")) { event.preventDefault(); activeView = "transactions"; render(); return; }
  if (target.dataset.view) { activeView = target.dataset.view as ActiveView; errorMessage = ""; render(); return; }
  switch (target.dataset.action) {
    case "add": openTransaction(); break;
    case "edit": openTransaction(target.dataset.id); break;
    case "delete": void execute({ type: "deleteTransaction", id: target.dataset.id! }); break;
    case "import": void chooseImportFile(); break;
    case "export": void exportShownTransactions(); break;
    case "undo": void execute({ type: "undo" }); break;
    case "clear-filters": filters = defaultFilters(); currentPage = 0; errorMessage = ""; render(); break;
    case "cancel-transaction": element<HTMLDialogElement>("transaction-dialog").close(); break;
  }
});

function describeError(error: unknown): string { return error instanceof Error ? error.message : String(error); }

ledgerBackend.read().then((initial) => { snapshot = initial; render(); }).catch((error: unknown) => {
  document.body.className = "tally-app";
  document.body.textContent = `Tally could not open your ledger: ${describeError(error)}`;
});
