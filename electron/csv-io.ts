import { readFile, stat } from "node:fs/promises";
import { TextDecoder } from "node:util";
import { MAX_CSV_CHARACTERS } from "../domain/csv-columns";

const MAX_CSV_FILE_BYTES = MAX_CSV_CHARACTERS;

/** Read bounded, explicitly decoded text; malformed encodings never silently replace payee characters. */
export async function readCsvSource(filePath: string): Promise<string> {
  const information = await stat(filePath);
  if (!information.isFile() || information.size > MAX_CSV_FILE_BYTES) throw new Error("Choose a CSV file no larger than 20 MiB.");
  const bytes = await readFile(filePath);
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-8";
  let source: string;
  try { source = new TextDecoder(encoding, { fatal: true }).decode(bytes); }
  catch { throw new Error("CSV text must be UTF-8 or BOM-labelled UTF-16. No rows were imported."); }
  if (source.includes("\0")) throw new Error("CSV must be plain text without NUL characters.");
  return source;
}
