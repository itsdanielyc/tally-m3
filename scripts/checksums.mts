import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";

const directory = "release";
const bundles = (await readdir(directory)).filter((name) => /\.(exe|dmg|deb|AppImage)$/.test(name)).sort();
if (!bundles.length) throw new Error("No release bundles exist to checksum.");
const lines: string[] = [];
for (const name of bundles) lines.push(`${createHash("sha256").update(await readFile(join(directory, name))).digest("hex")}  ${name}`);
const output = join(directory, `SHA256SUMS-${process.platform}-${process.arch}.txt`);
await writeFile(output, `${lines.join("\n")}\n`, "utf8");
console.log(`Checksummed ${bundles.length} bundles in ${output}.`);
