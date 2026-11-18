import type { CsvMapping, ImportPreview, LedgerBackend, LedgerSnapshot } from "../contracts/ledger";
import { inspectCsv, suggestMapping } from "../domain/csv";
import { renderImportDialog, renderImportPreview } from "./import-view";

/** Own one mapping/receipt lifecycle; only the service's immutable token can confirm an import. */
export function openImportDialog(source: string, snapshot: LedgerSnapshot, backend: LedgerBackend, onCommit: (next: LedgerSnapshot) => void): void {
  const table = inspectCsv(source);
  const suggested = suggestMapping(table);
  const dialog = document.createElement("dialog");
  dialog.className = "import-dialog";
  dialog.setAttribute("aria-labelledby", "csv-title");
  dialog.innerHTML = renderImportDialog(table, suggested);
  document.body.append(dialog);
  let current: ImportPreview | null = null;
  let generation = 0;
  let committing = false;
  const control = <T extends HTMLElement>(id: string): T => {
    const found = dialog.querySelector<T>(`#${id}`);
    if (!found) throw new Error(`Missing import control: ${id}`);
    return found;
  };
  const confirm = control<HTMLButtonElement>("csv-confirm");
  const previewButton = control<HTMLButtonElement>("csv-preview-button");
  const error = control("csv-error");
  const selectedColumn = (id: string): number | null => {
    const value = control<HTMLSelectElement>(id).value;
    return value === "" ? null : Number(value);
  };
  const readMapping = (): CsvMapping => {
    const split = control<HTMLSelectElement>("csv-mode").value === "split";
    return { date: selectedColumn("csv-date")!, payee: selectedColumn("csv-payee")!, amount: split ? null : selectedColumn("csv-amount"), debit: split ? selectedColumn("csv-debit") : null, credit: split ? selectedColumn("csv-credit") : null, note: selectedColumn("csv-note"), dateOrder: control<HTMLSelectElement>("csv-order").value as CsvMapping["dateOrder"], decimalSeparator: control<HTMLSelectElement>("csv-decimal").value as CsvMapping["decimalSeparator"] };
  };
  const showError = (failure: unknown): void => { error.textContent = failure instanceof Error ? failure.message : String(failure); error.hidden = false; };
  const preview = async (): Promise<void> => {
    const request = ++generation;
    current = null; confirm.disabled = true; previewButton.disabled = true; error.hidden = true;
    try {
      const result = await backend.previewCsv(source, readMapping());
      if (request !== generation || !dialog.isConnected) return;
      current = result;
      control("csv-preview").innerHTML = renderImportPreview(result, snapshot.ledger.currency);
      confirm.disabled = result.accepted.length === 0;
    } catch (failure) { if (request === generation) showError(failure); }
    finally { if (request === generation) previewButton.disabled = false; }
  };
  control("csv-mapping-form").addEventListener("change", () => {
    generation += 1; current = null; confirm.disabled = true; previewButton.disabled = false;
    const split = control<HTMLSelectElement>("csv-mode").value === "split";
    control("csv-signed").hidden = split; control("csv-split").hidden = !split;
    control("csv-preview").textContent = "Mapping changed. Preview again before confirming.";
  });
  control("csv-mapping-form").addEventListener("submit", (event) => { event.preventDefault(); void preview(); });
  control("csv-cancel").addEventListener("click", () => { if (!committing) dialog.close(); });
  dialog.addEventListener("cancel", (event) => { if (committing) event.preventDefault(); });
  dialog.addEventListener("close", () => { generation += 1; dialog.remove(); document.querySelector<HTMLButtonElement>('[data-action="import"]')?.focus(); });
  confirm.addEventListener("click", () => {
    if (!current || committing) return;
    committing = true; confirm.disabled = true; previewButton.disabled = true;
    void backend.execute({ type: "commitImport", token: current.token }).then((next) => { dialog.close(); onCommit(next); }).catch((failure: unknown) => { showError(failure); committing = false; confirm.disabled = false; previewButton.disabled = false; });
  });
  dialog.showModal();
  void preview();
}
