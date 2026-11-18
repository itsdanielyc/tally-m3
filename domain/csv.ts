import type { CsvMapping, CsvRecord, DateOrder, ImportPreview, Ledger, TransactionDraft } from "../contracts/ledger";
import { inspectCsv } from "./csv-columns";
import { parseMinorUnits, isISODate } from "./money";
import { assertRecord, validateTransaction } from "./validation";
export { inspectCsv, suggestMapping } from "./csv-columns";

const TWO_DIGIT_YEAR_PIVOT = 70;
const MODERN_CENTURY = 2000;
const PREVIOUS_CENTURY = 1900;

/** Parse only explicit calendar conventions; ISO exports remain unambiguous in every mode. */
export function parseCsvDate(source: string, order: DateOrder): string {
  const value = source.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && isISODate(value)) return value;
  const match = /^(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})$/.exec(value);
  if (!match) throw new Error("Date does not match the selected date order.");
  const first = match[1]!;
  const middle = match[2]!;
  const last = match[3]!;
  const yearToken = order === "YMD" ? first : last;
  if (yearToken.length !== 2 && yearToken.length !== 4) throw new Error("Date year must have two or four digits.");
  let year = Number(yearToken);
  if (yearToken.length === 2) year += year < TWO_DIGIT_YEAR_PIVOT ? MODERN_CENTURY : PREVIOUS_CENTURY;
  const month = order === "MDY" ? first : middle;
  const day = order === "YMD" ? last : order === "MDY" ? middle : first;
  const date = `${String(year).padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  if (!isISODate(date)) throw new Error("Date is not a real calendar date.");
  return date;
}

/** Stable tuple encoding avoids collisions from delimiter characters in payees. */
export function transactionFingerprint(transaction: Pick<TransactionDraft, "date" | "amount" | "payee">): string {
  return JSON.stringify([transaction.date, transaction.amount, transaction.payee.normalize("NFC").trim().toLowerCase()]);
}

/** Require coherent, distinct source columns before trying individual rows. */
function validateMapping(mapping: CsvMapping, width: number): void {
  assertRecord(mapping, "Column mapping");
  if (!["DMY", "MDY", "YMD"].includes(mapping.dateOrder)) throw new Error("Choose a valid date order.");
  if (mapping.decimalSeparator !== "." && mapping.decimalSeparator !== ",") throw new Error("Choose a decimal separator.");
  const required = [mapping.date, mapping.payee];
  const optional = [mapping.amount, mapping.debit, mapping.credit];
  for (const index of required) if (!Number.isSafeInteger(index)) throw new Error("Map the date and payee columns.");
  for (const index of optional) if (index !== null && !Number.isSafeInteger(index)) throw new Error("Map amount columns or select None.");
  const indexes = [...required, ...optional, mapping.note, mapping.category].filter((index): index is number => index !== null && index !== undefined);
  if (indexes.some((index) => !Number.isSafeInteger(index) || index < 0 || index >= width)) throw new Error("Column mapping is outside the CSV header.");
  if (new Set(indexes).size !== indexes.length) throw new Error("Each mapped column must be distinct.");
  if (mapping.amount !== null && (mapping.debit !== null || mapping.credit !== null)) throw new Error("Choose a signed amount OR debit/credit columns.");
  if (mapping.amount === null && mapping.debit === null && mapping.credit === null) throw new Error("Map an amount column or debit/credit columns.");
}

function field(record: CsvRecord, index: number | null | undefined): string { return index === null || index === undefined ? "" : record.fields[index] ?? ""; }

/** Debit/credit columns use nonnegative magnitudes; an all-blank amount is not zero. */
function readAmount(record: CsvRecord, mapping: CsvMapping): number {
  if (mapping.amount !== null) return parseMinorUnits(field(record, mapping.amount), mapping.decimalSeparator);
  const debitText = field(record, mapping.debit).trim();
  const creditText = field(record, mapping.credit).trim();
  if (!debitText && !creditText) throw new Error("Amount is blank in both debit and credit columns.");
  const debit = debitText ? parseMinorUnits(debitText, mapping.decimalSeparator) : 0;
  const credit = creditText ? parseMinorUnits(creditText, mapping.decimalSeparator) : 0;
  if (debit < 0 || credit < 0) throw new Error("Debit and credit amounts must be nonnegative.");
  if (debit !== 0 && credit !== 0) throw new Error("Both debit and credit contain an amount.");
  return credit - debit;
}

/** O(t+n) expected time/space. Compare against stored rows, preserving source multiplicity. */
export function prepareImport(source: string, mapping: CsvMapping, ledger: Ledger): Omit<ImportPreview, "token"> {
  const table = inspectCsv(source);
  validateMapping(mapping, table.headers.length);
  const existingKeys = new Set(ledger.transactions.map(transactionFingerprint));
  const categoryIds = new Set(ledger.categories.map((category) => category.id));
  const accepted: TransactionDraft[] = [];
  const rejected: ImportPreview["rejected"] = [];
  let duplicates = 0;
  for (const record of table.rows) {
    try {
      if (record.error) throw new Error(record.error);
      if (record.fields.length !== table.headers.length) throw new Error(`Expected ${table.headers.length} columns; found ${record.fields.length}.`);
      const transaction = validateTransaction({ date: parseCsvDate(field(record, mapping.date), mapping.dateOrder), payee: field(record, mapping.payee), amount: readAmount(record, mapping), categoryId: null, note: field(record, mapping.note) }, categoryIds);
      if (existingKeys.has(transactionFingerprint(transaction))) { duplicates += 1; continue; }
      accepted.push(transaction);
    } catch (error) { rejected.push({ line: record.line, reason: error instanceof Error ? error.message : String(error) }); }
  }
  return { accepted, rejected, duplicates, totalRows: table.rows.length, newCategories: [] };
}
