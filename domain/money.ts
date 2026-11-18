const MINOR_UNIT_FACTOR = 100n;
const MAX_MINOR_UNITS = BigInt(Number.MAX_SAFE_INTEGER);
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** Parse two-digit currency using decimal strings and integer arithmetic only. O(n) time, O(n) space. */
export function parseMinorUnits(source: string, decimalSeparator: "." | "," = "."): number {
  const input = source.trim();
  const parenthesized = input.startsWith("(") && input.endsWith(")");
  const unsigned = parenthesized ? input.slice(1, -1) : input.replace(/^[+-]/, "");
  const negative = parenthesized || input.startsWith("-");
  const grouping = decimalSeparator === "." ? "," : ".";
  const pieces = unsigned.split(decimalSeparator);
  const whole = pieces[0] ?? "";
  const fraction = pieces[1] ?? "";
  const groupingPattern = grouping === "," ? /^\d{1,3}(,\d{3})+$/ : /^\d{1,3}(\.\d{3})+$/;
  const validWhole = /^\d+$/.test(whole) || groupingPattern.test(whole);
  if (!validWhole || pieces.length > 2 || !/^\d{0,2}$/.test(fraction) || (pieces.length === 2 && !fraction)) {
    throw new Error("Amount must be a number with at most two decimal places.");
  }
  const minorUnits = BigInt(whole.split(grouping).join("")) * MINOR_UNIT_FACTOR + BigInt(fraction.padEnd(2, "0"));
  if (minorUnits > MAX_MINOR_UNITS) throw new Error("Amount is outside the supported integer range.");
  return Number(negative ? -minorUnits : minorUnits);
}

/** Format integer minor units as an exact signed decimal, without a floating-point division. */
export function formatMinorUnits(amount: number | bigint): string {
  if (typeof amount === "number") assertMinorUnits(amount);
  const integer = BigInt(amount);
  const absolute = integer < 0n ? -integer : integer;
  return `${integer < 0n ? "-" : ""}${absolute / MINOR_UNIT_FACTOR}.${String(absolute % MINOR_UNIT_FACTOR).padStart(2, "0")}`;
}

/** Fail at the boundary instead of rounding fractional or unsafe money. */
export function assertMinorUnits(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value)) throw new Error("Amount must be whole minor units within the safe integer range.");
}

/** Check an ISO calendar date directly, including Gregorian century leap rules. */
export function isISODate(source: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(source)) return false;
  const [year, month, day] = source.split("-").map(Number);
  if (!year || !month || month > 12 || !day) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maximumDay = month === 2 && leapYear ? 29 : MONTH_LENGTHS[month - 1]!;
  return day <= maximumDay;
}

/** Add bounded integers exactly and reject aggregate overflow. */
export function addMinorUnits(left: number, right: number): number {
  const total = left + right;
  assertMinorUnits(total);
  return total;
}
