import type { CsvMapping, CsvTable, ImportPreview } from "../contracts/ledger";
import { formatMinorUnits } from "../domain/money";
import { escapeHtml } from "./view";
const PREVIEW_ROW_LIMIT = 5;

/** Render the mapping separately from results so changes cannot silently confirm an older preview. */
export function renderImportDialog(table: CsvTable, mapping: CsvMapping): string {
  const delimiterName = table.delimiter === "\t" ? "tab" : table.delimiter === ";" ? "semicolon" : table.delimiter === "," ? "comma" : "pipe";
  return `<div class="import-scroll"><form id="csv-mapping-form"><h2 id="csv-title">Import a bank CSV</h2><p class="muted">Detected ${delimiterName} delimiter · header line ${table.headerLine}</p>
    <div class="mapping-grid">${columnSelect("csv-date", "Date column", table.headers, mapping.date, false)}${columnSelect("csv-payee", "Payee column", table.headers, mapping.payee, false)}
    <div><label for="csv-mode">Amount format</label><select id="csv-mode"><option value="signed" ${mapping.amount !== null ? "selected" : ""}>One signed amount column</option><option value="split" ${mapping.amount === null ? "selected" : ""}>Separate debit and credit</option></select></div>
    <div><label for="csv-order">Date order</label><select id="csv-order">${[["DMY", "Day / month / year"], ["MDY", "Month / day / year"], ["YMD", "Year / month / day"]].map(([value, title]) => `<option value="${value}" ${mapping.dateOrder === value ? "selected" : ""}>${title}</option>`).join("")}</select></div></div>
    <div id="csv-signed" ${mapping.amount === null ? "hidden" : ""}>${columnSelect("csv-amount", "Amount column", table.headers, mapping.amount, true)}</div>
    <div id="csv-split" class="mapping-grid" ${mapping.amount !== null ? "hidden" : ""}>${columnSelect("csv-debit", "Debit column", table.headers, mapping.debit, true)}${columnSelect("csv-credit", "Credit column", table.headers, mapping.credit, true)}</div>
    <div class="mapping-grid"><div><label for="csv-decimal">Decimal separator</label><select id="csv-decimal"><option value="." ${mapping.decimalSeparator === "." ? "selected" : ""}>Decimal point (1,234.56)</option><option value="," ${mapping.decimalSeparator === "," ? "selected" : ""}>Decimal comma (1.234,56)</option></select></div>${columnSelect("csv-note", "Note column (optional)", table.headers, mapping.note ?? null, true)}</div>
    <button type="submit" id="csv-preview-button" class="secondary">Preview import</button></form>
    <section id="csv-preview" aria-label="Import preview" aria-live="polite"><p>Preparing preview…</p></section><p id="csv-error" class="error" role="alert" hidden></p></div>
    <div class="dialog-actions"><button type="button" id="csv-cancel">Cancel import</button><button type="button" class="primary" id="csv-confirm" disabled>Confirm import</button></div>`;
}

function columnSelect(id: string, label: string, headers: readonly string[], selected: number | null, allowNone: boolean): string {
  return `<div><label for="${id}">${label}</label><select id="${id}">${allowNone ? `<option value="" ${selected === null ? "selected" : ""}>None</option>` : ""}${headers.map((header, index) => `<option value="${index}" ${index === selected ? "selected" : ""}>${index + 1}. ${escapeHtml(header)}</option>`).join("")}</select></div>`;
}

/** Render every rejection with its physical line; preview only the first few accepted rows. O(n) space/time. */
export function renderImportPreview(preview: ImportPreview, currency: string): string {
  const shown = preview.accepted.slice(0, PREVIEW_ROW_LIMIT);
  const showNotes = shown.some((row) => row.note);
  const rows = shown.map((row) => `<tr><td>${row.date}</td><td>${escapeHtml(row.payee)}</td><td class="amount">${escapeHtml(currency)} ${formatMinorUnits(row.amount)}</td>${showNotes ? `<td class="import-note">${escapeHtml(row.note)}</td>` : ""}</tr>`).join("");
  return `<h3>Review before importing</h3><p data-testid="import-counts" class="import-counts">${preview.accepted.length} accepted · ${preview.duplicates} duplicates · ${preview.rejected.length} rejected</p>
    ${rows ? `<p class="muted">First ${shown.length} accepted rows of ${preview.totalRows} source rows.</p><div class="table-scroll"><table><thead><tr><th>Date</th><th>Payee</th><th class="amount">Amount</th>${showNotes ? "<th>Note</th>" : ""}</tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="muted">No new readable transactions to import.</p>`}
    ${preview.rejected.length ? `<details open><summary>Rows with problems (${preview.rejected.length})</summary><ul class="rejections">${preview.rejected.map((row) => `<li>Line ${row.line}: ${escapeHtml(row.reason)}</li>`).join("")}</ul></details>` : ""}`;
}
