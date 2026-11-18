import { expect, it } from "vitest";
import { createEmptyLedger, type Transaction } from "../../contracts/ledger";
import { defaultFilters, filterTransactions, paginateTransactions } from "../../domain/find";
import { exportTransactions } from "../../domain/export";
import { inspectCsv, prepareImport, suggestMapping } from "../../domain/csv";

const rows: Transaction[] = [
  { id: "one", date: "2026-11-18", payee: "CAFÉ store", amount: -1250, categoryId: "food", note: "Milk & bread" },
  { id: "two", date: "2026-11-19", payee: "Salary", amount: 200000, categoryId: null, note: "November" },
  { id: "three", date: "2026-10-31", payee: "Other", amount: -500, categoryId: "home", note: "café beans" },
];
it("combines text, category, inclusive date and signed amount bounds", () => {
  const filters = { ...defaultFilters(), query: "MILK", categoryId: "food", fromDate: "2026-11-18", toDate: "2026-11-18", minimumAmount: -1250, maximumAmount: -1250 };
  expect(filterTransactions(rows, filters).map((row) => row.id)).toEqual(["one"]);
  expect(filterTransactions(rows, { ...defaultFilters(), query: "cafe\u0301" }).map((row) => row.id)).toEqual(["one", "three"]);
  expect(filterTransactions(rows, { ...defaultFilters(), categoryId: null }).map((row) => row.id)).toEqual(["two"]);
});
it("treats search text literally and preserves input order and objects", () => {
  const before = structuredClone(rows);
  expect(filterTransactions(rows, { ...defaultFilters(), query: ".*" })).toEqual([]);
  expect(filterTransactions(rows, defaultFilters())).toEqual(rows);
  expect(rows).toEqual(before);
});
it.each([{ fromDate: "2026-02-30" }, { fromDate: "2026-12-01", toDate: "2026-11-01" }, { minimumAmount: 1.5 }, { minimumAmount: 10, maximumAmount: -10 }])("rejects invalid filter bounds %j", (invalid) => expect(() => filterTransactions(rows, { ...defaultFilters(), ...invalid })).toThrow(/date|amount|range/i));
it("pages the view without truncating the matching result set", () => {
  const many = Array.from({ length: 125 }, (_, index) => ({ ...rows[0]!, id: String(index) }));
  const page = paginateTransactions(many, 99, 50);
  expect(page).toMatchObject({ page: 2, totalPages: 3, totalCount: 125, offset: 100 });
  expect(page.rows).toHaveLength(25);
  expect(many).toHaveLength(125);
  expect(paginateTransactions([], 0, 50)).toMatchObject({ page: 0, totalCount: 0, rows: [] });
});
it("exports quoted Unicode, notes, categories and duplicate transactions back unchanged", () => {
  const ledger = createEmptyLedger(); ledger.categories = [{ id: "food", name: 'Food, "groceries"' }];
  ledger.transactions = [
    { ...rows[0]!, payee: 'Corner, "Shop"', note: "first\r\nsecond" },
    { ...rows[0]!, id: "duplicate", payee: 'Corner, "Shop"', note: "different" },
    { ...rows[1]!, payee: "=literal text", amount: 1 },
  ];
  const csv = exportTransactions(ledger.transactions, ledger.categories);
  const preview = prepareImport(csv, suggestMapping(inspectCsv(csv)), createEmptyLedger());
  expect(preview.rejected).toEqual([]); expect(preview.duplicates).toBe(0); expect(preview.accepted).toHaveLength(3);
  expect(preview.newCategories.map((category) => category.name)).toEqual(['Food, "groceries"']);
  expect(preview.accepted.map((row) => ({ date: row.date, payee: row.payee, amount: row.amount, note: row.note }))).toEqual(ledger.transactions.map(({ date, payee, amount, note }) => ({ date, payee, amount, note })));
  expect(preview.accepted[0]?.categoryId).toBe(preview.newCategories[0]?.id);
});
it("does not create a category for an already stored duplicate", () => {
  const ledger = createEmptyLedger(); ledger.transactions = [rows[0]!];
  const source = 'Date,Payee,Amount,Category,Note\n2026-11-18,CAFÉ store,-12.50,Travel,ignored';
  const preview = prepareImport(source, suggestMapping(inspectCsv(source)), ledger);
  expect(preview).toMatchObject({ accepted: [], newCategories: [], duplicates: 1 });
});
