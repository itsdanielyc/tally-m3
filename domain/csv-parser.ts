import type { CsvRecord } from "../contracts/ledger";

type FieldState = "plain" | "quoted" | "closed";

/** RFC-style delimiter reader with physical source lines. O(n) amortized time, O(n) space. */
export function parseCsvRecords(source: string, delimiter: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let state: FieldState = "plain";
  let line = 1;
  let startLine = 1;
  let error: string | undefined;

  const finishRecord = (): void => {
    fields.push(field);
    if (error || fields.some((value) => value.trim())) records.push({ line: startLine, fields, ...(error ? { error } : {}) });
    fields = []; field = ""; state = "plain"; error = undefined;
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (state === "quoted") {
      if (character === '"' && source[index + 1] === '"') { field += '"'; index += 1; continue; }
      if (character === '"') { state = "closed"; continue; }
      field += character;
      if (character === "\n" || (character === "\r" && source[index + 1] !== "\n")) line += 1;
      continue;
    }
    if (character === delimiter) { fields.push(field); field = ""; state = "plain"; continue; }
    if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      finishRecord(); line += 1; startLine = line; continue;
    }
    if (state === "closed") {
      if (character === " " || character === "\t") continue;
      error = "Unexpected text after a closing quote.";
      field += character;
      continue;
    }
    if (character === '"') {
      if (field.trim()) { error = "Unexpected quote inside an unquoted field."; field += character; }
      else { field = ""; state = "quoted"; }
      continue;
    }
    field += character;
  }
  if (state === "quoted") error = "Unclosed quoted field.";
  finishRecord();
  return records;
}
