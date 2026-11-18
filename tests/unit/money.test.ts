import { describe, expect, it } from "vitest";
import { formatMinorUnits, parseMinorUnits, isISODate } from "../../domain/money";

describe("integer money and calendar dates", () => {
  it.each([["0", 0], ["-0.01", -1], ["12.34", 1234], ["9,876.54", 987654], ["90071992547409.91", Number.MAX_SAFE_INTEGER]])("parses %s without floating point", (text, expected) => {
    expect(parseMinorUnits(String(text))).toBe(expected);
    expect(parseMinorUnits(formatMinorUnits(Number(expected)))).toBe(expected);
  });
  it("reads decimal commas and negative parentheses", () => {
    expect(parseMinorUnits("(1.234,56)", ",")).toBe(-123456);
  });
  it.each(["", "NaN", "1e3", "0.001", "1,2,3", "90071992547409.92"])("rejects malformed or unsafe amount %s", (text) => {
    expect(() => parseMinorUnits(text)).toThrow(/amount/i);
  });
  it.each(["2000-02-29", "2026-11-18", "0001-01-01"])("accepts real ISO date %s", (date) => expect(isISODate(date)).toBe(true));
  it.each(["1900-02-29", "2026-02-30", "2026-13-01", "18/11/2026", "0000-01-01"])("rejects invalid ISO date %s", (date) => expect(isISODate(date)).toBe(false));
});
