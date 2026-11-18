import { describe, expect, it } from "vitest";
import { createEmptyLedger, type CsvMapping } from "../../contracts/ledger";
import { inspectCsv, parseCsvDate, prepareImport, suggestMapping } from "../../domain/csv";

const mapping: CsvMapping = { date: 0, payee: 1, amount: 2, debit: null, credit: null, dateOrder: "DMY", decimalSeparator: "." };

describe("bank CSV reader", () => {
  it.each([",", ";", "\t", "|"])("detects delimiter %j and respects quoted delimiters", (delimiter) => {
    const source = `Date${delimiter}Payee${delimiter}Amount\n18/11/2026${delimiter}"Corner${delimiter}Shop"${delimiter}-12.34`;
    expect(inspectCsv(source).delimiter).toBe(delimiter);
    expect(prepareImport(source, mapping, createEmptyLedger()).accepted[0]?.payee).toBe(`Corner${delimiter}Shop`);
  });
  it("finds a header after a preamble and reports original physical line numbers", () => {
    const source = 'Statement\r\nGenerated today\r\nDate;Description;Debit;Credit\r\n18/11/2026;"Corner; Shop";12,34;\r\n19/11/2026;Pay;;2000,00\r\n31/02/2026;Broken;1,00;\r\n20/11/2026;"two\nlines";2,00;';
    const table = inspectCsv(source);
    expect(table.headerLine).toBe(3);
    expect(table.headers).toEqual(["Date", "Description", "Debit", "Credit"]);
    const detected = suggestMapping(table);
    expect(detected).toMatchObject({ date: 0, payee: 1, amount: null, debit: 2, credit: 3, decimalSeparator: "," });
    const result = prepareImport(source, detected, createEmptyLedger());
    expect(result.accepted.map((row) => row.amount)).toEqual([-1234, 200000, -200]);
    expect(result.rejected).toEqual([{ line: 6, reason: expect.stringMatching(/date/i) }]);
    expect(result.totalRows).toBe(4);
  });
  it("preserves escaped quotes and embedded CRLF note text", () => {
    const result = prepareImport('Date,Payee,Amount,Note\r\n18/11/2026,"Corner ""Store""",-12.34,"line 1\r\nline 2"', { ...mapping, note: 3 }, createEmptyLedger());
    expect(result.accepted[0]).toMatchObject({ payee: 'Corner "Store"', note: "line 1\r\nline 2", amount: -1234 });
  });
  it("honours date order, two-digit year pivot and ISO dates", () => {
    expect(parseCsvDate("01/02/26", "DMY")).toBe("2026-02-01");
    expect(parseCsvDate("01/02/26", "MDY")).toBe("2026-01-02");
    expect(parseCsvDate("2026.11.18", "YMD")).toBe("2026-11-18");
    expect(parseCsvDate("31/12/99", "DMY")).toBe("1999-12-31");
    expect(parseCsvDate("2026-11-18", "DMY")).toBe("2026-11-18");
  });
  it.each(["31/02/2026", "29/02/1900", "no date", "1/2/6"])("rejects invalid date %s", (source) => expect(() => parseCsvDate(source, "DMY")).toThrow(/date|year/i));
  it("lists malformed rows independently, including an unclosed quote", () => {
    const result = prepareImport('Date,Payee,Amount\n18/11/2026,Good,-1.00\n18/11/2026,No cents,0.001\n18/11/2026,,2.00\n18/11/2026,Too,many,fields\n18/11/2026,"Unclosed,2.00', mapping, createEmptyLedger());
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected.map((row) => row.line)).toEqual([3, 4, 5, 6]);
    expect(result.rejected.map((row) => row.reason).join(" ")).toMatch(/amount/i);
    expect(result.rejected[3]?.reason).toMatch(/quote/i);
  });
  it("skips stored duplicates by normalized date, amount and payee while retaining source multiplicity", () => {
    const ledger = createEmptyLedger();
    ledger.transactions.push({ id: "stored", date: "2026-11-18", payee: "Green Market", amount: -1234, categoryId: null, note: "old note" });
    const source = 'Date,Payee,Amount\n18/11/2026,  GREEN MARKET  ,-12.34\n19/11/2026,New,-1.00\n19/11/2026,New,-1.00';
    const result = prepareImport(source, mapping, ledger);
    expect(result.duplicates).toBe(1);
    expect(result.accepted).toHaveLength(2);
    expect(result.accepted.map((row) => row.date)).toEqual(["2026-11-19", "2026-11-19"]);
  });
  it.each([{ date: 99 }, { payee: 0 }, { debit: 1 }, { amount: null }, { decimalSeparator: "?" }, { dateOrder: "???" }])("rejects invalid column mapping %j", (invalid) => {
    expect(() => prepareImport('Date,Payee,Amount\n18/11/2026,Shop,-1.00', { ...mapping, ...invalid } as CsvMapping, createEmptyLedger())).toThrow();
  });
  it("rejects conflicting or negative debit/credit values", () => {
    const result = prepareImport('Date;Payee;Debit;Credit\n18/11/2026;Both;1,00;2,00\n18/11/2026;Negative;;-1,00', { ...mapping, amount: null, debit: 2, credit: 3, decimalSeparator: "," }, createEmptyLedger());
    expect(result.accepted).toEqual([]);
    expect(result.rejected.map((row) => row.line)).toEqual([2, 3]);
    expect(result.rejected[0]?.reason).toMatch(/both/i);
    expect(result.rejected[1]?.reason).toMatch(/negative/i);
  });
  it("handles BOM, blank trailing rows and an empty header-only file", () => {
    expect(prepareImport('\ufeffDate,Payee,Amount\r\n\r\n', mapping, createEmptyLedger())).toMatchObject({ accepted: [], rejected: [], duplicates: 0, totalRows: 0 });
    expect(() => inspectCsv("")).toThrow(/CSV|header/i);
  });
  it("previews 2,000 bank rows in under five seconds", () => {
    const source = 'Date,Payee,Amount\n' + Array.from({ length: 2000 }, (_, index) => `18/11/2026,Shop ${index},-1.01`).join("\n");
    const start = performance.now();
    const preview = prepareImport(source, mapping, createEmptyLedger());
    expect(preview.accepted).toHaveLength(2000);
    expect(preview.rejected).toEqual([]);
    expect(performance.now() - start).toBeLessThan(5000);
  });
});
