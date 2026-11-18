import type { CsvMapping, CsvRecord, CsvTable } from "../contracts/ledger";
import { parseCsvRecords } from "./csv-parser";

export const MAX_CSV_CHARACTERS = 20 * 1024 * 1024;
const DETECTION_SAMPLE_LENGTH = 64 * 1024;
const HEADER_SCAN_ROWS = 50;
const DELIMITERS = [",", ";", "\t", "|"] as const;
const HEADER_ALIASES = {
  date: ["date", "transactiondate", "bookingdate", "postingdate", "valuedate"],
  payee: ["payee", "description", "merchant", "details", "narrative", "transactiondescription", "name"],
  amount: ["amount", "signedamount", "transactionamount", "value"],
  debit: ["debit", "debits", "withdrawal", "withdrawals", "moneyout", "paidout"],
  credit: ["credit", "credits", "deposit", "deposits", "moneyin", "paidin"],
  note: ["note", "notes", "memo"],
} as const;

function headerKey(value: string): string { return value.trim().toLowerCase().replace(/[^a-z]/g, ""); }
function columnIndex(headers: readonly string[], kind: keyof typeof HEADER_ALIASES): number | null {
  const aliases: readonly string[] = HEADER_ALIASES[kind];
  const index = headers.findIndex((header) => aliases.includes(headerKey(header)));
  return index < 0 ? null : index;
}
function headerScore(record: CsvRecord): number {
  return (["date", "payee", "amount", "debit", "credit"] as const).filter((kind) => columnIndex(record.fields, kind) !== null).length;
}

/** Detect headers independently of preamble width. O(r*c) time, O(r) space for the bounded sample. */
function chooseHeader(records: readonly CsvRecord[]): { index: number; score: number; consistency: number } {
  const widths = new Map<number, number>();
  for (const record of records) if (!record.error && record.fields.length > 1) widths.set(record.fields.length, (widths.get(record.fields.length) ?? 0) + 1);
  let width = 0;
  let consistency = 0;
  for (const [candidate, count] of widths) if (count > consistency) { width = candidate; consistency = count; }
  let index = records.findIndex((record) => !record.error && record.fields.length === width);
  let score = 0;
  records.slice(0, HEADER_SCAN_ROWS).forEach((record, candidate) => {
    const candidateScore = record.error ? 0 : headerScore(record);
    if (record.fields.length > 1 && candidateScore >= 2 && candidateScore > score) { index = candidate; score = candidateScore; }
  });
  return { index, score, consistency };
}

/** Parse the chosen delimiter once; retain physical line numbers for every subsequent row. O(n) time/space. */
export function inspectCsv(source: string): CsvTable {
  if (typeof source !== "string" || !source.trim() || source.length > MAX_CSV_CHARACTERS) throw new Error("CSV must contain a header and be at most 20 MiB of text.");
  const normalized = source.replace(/^\uFEFF/, "");
  let delimiter: string = DELIMITERS[0];
  let best = { score: -1, consistency: -1 };
  for (const candidate of DELIMITERS) {
    const detected = chooseHeader(parseCsvRecords(normalized.slice(0, DETECTION_SAMPLE_LENGTH), candidate));
    if (detected.score > best.score || (detected.score === best.score && detected.consistency > best.consistency)) { delimiter = candidate; best = detected; }
  }
  const records = parseCsvRecords(normalized, delimiter);
  const { index } = chooseHeader(records);
  const header = records[index];
  if (!header || header.fields.length < 2) throw new Error("CSV needs a readable header row with multiple columns.");
  return { delimiter, headerLine: header.line, headers: header.fields.map((value, column) => value.trim() || `Column ${column + 1}`), rows: records.slice(index + 1) };
}

/** Suggest, but never silently lock, the person's mapping and number/date conventions. */
export function suggestMapping(table: CsvTable): CsvMapping {
  const date = columnIndex(table.headers, "date") ?? 0;
  const payee = columnIndex(table.headers, "payee") ?? 1;
  const debit = columnIndex(table.headers, "debit");
  const credit = columnIndex(table.headers, "credit");
  const signed = columnIndex(table.headers, "amount");
  const amount = signed ?? (debit === null && credit === null && table.headers.length > 2 ? 2 : null);
  const sample = table.rows.find((record) => !record.error);
  const sampleAmount = sample?.fields[amount ?? debit ?? credit ?? 0] ?? "";
  return { date, payee, amount, debit: amount === null ? debit : null, credit: amount === null ? credit : null, note: columnIndex(table.headers, "note"), dateOrder: /^\d{4}-/.test(sample?.fields[date] ?? "") ? "YMD" : "DMY", decimalSeparator: sampleAmount.lastIndexOf(",") > sampleAmount.lastIndexOf(".") ? "," : "." };
}
