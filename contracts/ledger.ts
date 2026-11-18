/** Current on-disk schema. Older versions are migrated explicitly by the store. */
export const LEDGER_VERSION = 1 as const;
export const DEFAULT_CURRENCY = "GBP";
export const SUPPORTED_CURRENCIES = ["GBP", "USD", "EUR", "CAD", "AUD", "NZD", "CHF", "CNY", "INR", "SEK", "NOK", "DKK", "PLN"] as const;

/** A signed amount in whole minor units: spending is negative, income positive. */
export interface TransactionDraft {
  date: string;
  payee: string;
  amount: number;
  categoryId: string | null;
  note: string;
}
export interface Transaction extends TransactionDraft { id: string }
export interface Category { id: string; name: string }
export interface PayeeRule { id: string; contains: string; categoryId: string }
export interface Ledger {
  version: typeof LEDGER_VERSION;
  currency: string;
  transactions: Transaction[];
  categories: Category[];
  rules: PayeeRule[];
  budgets: Record<string, Record<string, number>>;
}
export interface LedgerSnapshot { ledger: Ledger; revision: number; undoLabel: string | null; notice: string }

/** Fixed-scope command vocabulary; all untrusted payloads are validated in the service. */
export type LedgerCommand =
  | { type: "saveTransaction"; transaction: TransactionDraft; id?: string }
  | { type: "deleteTransaction"; id: string }
  | { type: "setCurrency"; currency: string }
  | { type: "commitImport"; token: string }
  | { type: "saveCategory"; name: string; id?: string }
  | { type: "deleteCategory"; id: string }
  | { type: "mergeCategory"; sourceId: string; targetId: string }
  | { type: "saveRule"; contains: string; categoryId: string; id?: string }
  | { type: "deleteRule"; id: string }
  | { type: "applyRules" }
  | { type: "setBudget"; month: string; categoryId: string; amount: number }
  | { type: "undo" };

export type DateOrder = "DMY" | "MDY" | "YMD";
export interface CsvMapping {
  date: number;
  payee: number;
  amount: number | null;
  debit: number | null;
  credit: number | null;
  category?: number | null;
  note?: number | null;
  dateOrder: DateOrder;
  decimalSeparator: "." | ",";
}
export interface CsvRecord { line: number; fields: string[]; error?: string }
export interface CsvTable { delimiter: string; headers: string[]; headerLine: number; rows: CsvRecord[] }
export interface RejectedRow { line: number; reason: string }
export interface ImportPreview {
  token: string;
  accepted: TransactionDraft[];
  rejected: RejectedRow[];
  duplicates: number;
  totalRows: number;
}

/** The only ledger API exposed to the renderer. Native paths never cross this seam. */
export interface LedgerBackend {
  readonly kind: "native" | "mock";
  read(): Promise<LedgerSnapshot>;
  execute(command: LedgerCommand): Promise<LedgerSnapshot>;
  previewCsv(source: string, mapping: CsvMapping): Promise<ImportPreview>;
  openCsv(): Promise<string | null>;
  exportCsv(source: string): Promise<boolean>;
}

/** Persistence publishes an entire candidate atomically, or rejects without replacing it. */
export interface LedgerStore {
  load(): Promise<Ledger>;
  save(ledger: Ledger): Promise<void>;
}

/** Return independent collections for every new ledger or isolated mock. */
export function createEmptyLedger(): Ledger {
  return { version: LEDGER_VERSION, currency: DEFAULT_CURRENCY, transactions: [], categories: [], rules: [], budgets: {} };
}
