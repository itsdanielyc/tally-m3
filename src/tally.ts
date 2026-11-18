import "./tally.css";
import { ledgerBackend } from "./ledger-api";
import { renderApplication, type ActiveView } from "./view";
import { formatMinorUnits, parseMinorUnits } from "../domain/money";
import type { LedgerCommand, LedgerSnapshot } from "../contracts/ledger";

let snapshot: LedgerSnapshot;
let activeView: ActiveView = "transactions";
let editingTransactionId: string | undefined;
let busy = false;
let errorMessage = "";

/** Require a known view element; a broken template fails at its source rather than later. */
function element<T extends HTMLElement>(id: string): T {
  const result = document.getElementById(id);
  if (!result) throw new Error(`Missing UI element: ${id}`);
  return result as T;
}

function render(): void {
  document.body.className = "tally-app";
  document.body.innerHTML = renderApplication(snapshot, activeView, ledgerBackend.kind, errorMessage);
  document.getElementById("transaction-form")?.addEventListener("submit", (event) => { event.preventDefault(); void saveTransaction(); });
  document.getElementById("settings-form")?.addEventListener("submit", (event) => {
    event.preventDefault(); void execute({ type: "setCurrency", currency: element<HTMLSelectElement>("currency").value });
  });
}

/** Mutations retain the previous view on error and publish only the confirmed snapshot. */
async function execute(command: LedgerCommand): Promise<boolean> {
  if (busy) return false;
  busy = true;
  errorMessage = "";
  try { snapshot = await ledgerBackend.execute(command); render(); return true; }
  catch (error) { errorMessage = describeError(error); render(); return false; }
  finally { busy = false; }
}

function openTransaction(id?: string): void {
  editingTransactionId = id;
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
  try {
    const transaction = {
      date: element<HTMLInputElement>("transaction-date").value,
      payee: element<HTMLInputElement>("transaction-payee").value,
      amount: parseMinorUnits(element<HTMLInputElement>("transaction-amount").value),
      categoryId: element<HTMLSelectElement>("transaction-category").value || null,
      note: element<HTMLTextAreaElement>("transaction-note").value,
    };
    busy = true; submit.disabled = true;
    snapshot = await ledgerBackend.execute({ type: "saveTransaction", transaction, id: editingTransactionId });
    errorMessage = ""; render();
    document.querySelector<HTMLButtonElement>('[data-action="add"]')?.focus();
  } catch (error) { alert.textContent = describeError(error); alert.hidden = false; }
  finally { busy = false; if (submit.isConnected) submit.disabled = false; }
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
    case "cancel-transaction": element<HTMLDialogElement>("transaction-dialog").close(); break;
  }
});

function describeError(error: unknown): string { return error instanceof Error ? error.message : String(error); }

ledgerBackend.read().then((initial) => { snapshot = initial; render(); }).catch((error: unknown) => {
  document.body.className = "tally-app";
  document.body.textContent = `Tally could not open your ledger: ${describeError(error)}`;
});
