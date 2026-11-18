import type { Transaction } from "../contracts/ledger";
import { assertMinorUnits, isISODate } from "./money";

export interface TransactionFilters {
  query: string;
  /** undefined means all; null means uncategorised; a string selects an ID. */
  categoryId: string | null | undefined;
  fromDate: string | null;
  toDate: string | null;
  minimumAmount: number | null;
  maximumAmount: number | null;
}
export interface TransactionPage { rows: Transaction[]; page: number; totalPages: number; totalCount: number; offset: number }

export function defaultFilters(): TransactionFilters { return { query: "", categoryId: undefined, fromDate: null, toDate: null, minimumAmount: null, maximumAmount: null }; }

/** Validate a draft without scanning or allocating the transaction result set. */
export function validateFilters(filters: TransactionFilters): void {
  if (typeof filters.query !== "string") throw new Error("Search must be text.");
  for (const date of [filters.fromDate, filters.toDate]) if (date !== null && !isISODate(date)) throw new Error("Filter date must be a real YYYY-MM-DD date.");
  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) throw new Error("Date range starts after its end.");
  for (const amount of [filters.minimumAmount, filters.maximumAmount]) if (amount !== null) assertMinorUnits(amount);
  if (filters.minimumAmount !== null && filters.maximumAmount !== null && filters.minimumAmount > filters.maximumAmount) throw new Error("Amount range minimum exceeds its maximum.");
}

/** One linear scan, literal text matching, and inclusive bounds. O(n*l) time, O(m) result space. */
export function filterTransactions(transactions: readonly Transaction[], filters: TransactionFilters): Transaction[] {
  validateFilters(filters);
  const query = filters.query.trim().normalize("NFC").toLowerCase();
  return transactions.filter((row) => {
    if (filters.categoryId !== undefined && row.categoryId !== filters.categoryId) return false;
    if (filters.fromDate && row.date < filters.fromDate) return false;
    if (filters.toDate && row.date > filters.toDate) return false;
    if (filters.minimumAmount !== null && row.amount < filters.minimumAmount) return false;
    if (filters.maximumAmount !== null && row.amount > filters.maximumAmount) return false;
    if (!query) return true;
    return row.payee.normalize("NFC").toLowerCase().includes(query) || row.note.normalize("NFC").toLowerCase().includes(query);
  });
}

/** Bound DOM work to one page; the full matching array remains available to export. O(p) time/space. */
export function paginateTransactions(rows: readonly Transaction[], requestedPage: number, pageSize: number): TransactionPage {
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 0 || !Number.isSafeInteger(pageSize) || pageSize < 1) throw new Error("Page and page size must be valid positive bounds.");
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(requestedPage, totalPages - 1);
  const offset = page * pageSize;
  return { rows: rows.slice(offset, offset + pageSize), page, totalPages, totalCount: rows.length, offset };
}
