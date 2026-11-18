import { open, mkdir, rename, unlink, realpath } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { MAX_CSV_CHARACTERS } from "../domain/csv-columns";

interface CsvExportOptions { replaceFile?: (source: string, target: string) => Promise<void> }

function pathKey(value: string): string { return process.platform === "win32" || process.platform === "darwin" ? value.toLowerCase() : value; }
async function canonicalPath(value: string): Promise<string> {
  try { return await realpath(value); }
  catch (error) { if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return resolve(value); throw error; }
}

/** Never overwrite the ledger. Flush and replace the chosen CSV atomically. O(bytes) time/space. */
export async function writeCsvExport(destination: string, source: string, ledgerPath: string, options: CsvExportOptions = {}): Promise<void> {
  if (typeof source !== "string" || Buffer.byteLength(source, "utf8") > MAX_CSV_CHARACTERS) throw new Error("Export is larger than 20 MiB. Narrow the filters so it can be imported back.");
  const output = resolve(destination);
  const forbidden = new Set([ledgerPath, `${ledgerPath}.pending`].map((value) => pathKey(resolve(value))));
  forbidden.add(pathKey(await canonicalPath(ledgerPath)));
  if (forbidden.has(pathKey(output)) || forbidden.has(pathKey(await canonicalPath(output)))) throw new Error("Choose a CSV destination outside the live ledger and its pending file.");
  await mkdir(dirname(output), { recursive: true });
  const temporary = join(dirname(output), `.tally-export-${randomUUID()}.tmp`);
  try {
    const file = await open(temporary, "wx", 0o600);
    try { await file.writeFile(source, "utf8"); await file.sync(); } finally { await file.close(); }
    await (options.replaceFile ?? rename)(temporary, output);
  } finally { await unlink(temporary).catch(() => undefined); }
}
