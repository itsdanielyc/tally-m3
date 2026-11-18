import type { Category, Transaction } from "../contracts/ledger";
import { formatMinorUnits } from "./money";

const CSV_HEADER = "Date,Payee,Amount,Category,Note";
export const DEFAULT_CSV_FILENAME = "tally-transactions.csv";
const ROW_SEPARATOR = "\r\n";

/** Quote every cell so delimiters, quotes and original note line breaks survive the round trip. */
function quoteCell(value: string): string { return `"${value.replaceAll('"', '""')}"`; }

/** Export exactly the supplied matching set, never a UI page. O(n+c+text) time/space. */
export function exportTransactions(transactions: readonly Transaction[], categories: readonly Category[]): string {
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const rows = transactions.map((row) => [row.date, row.payee, formatMinorUnits(row.amount), row.categoryId === null ? "" : names.get(row.categoryId) ?? "", row.note].map(quoteCell).join(","));
  return [CSV_HEADER, ...rows].join(ROW_SEPARATOR) + ROW_SEPARATOR;
}
