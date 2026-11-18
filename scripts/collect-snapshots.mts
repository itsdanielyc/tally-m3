import { readdir, mkdir, copyFile } from "node:fs/promises";
import { resolve, join, dirname, extname } from "node:path";

const SHARED_EXTENSIONS = new Set([".json", ".yml", ".yaml"]);
const SUPPORTED_PLATFORMS = new Set(["win32", "darwin", "linux"]);

/** O(files + copied bytes) time, O(directory depth) auxiliary space. Never mix another OS's pixels. */
async function collect(sourceRoot: string, destinationRoot: string, platform: string, includeShared: boolean): Promise<number> {
  let pixels = 0;
  async function visit(relative: string): Promise<void> {
    for (const entry of await readdir(join(sourceRoot, relative), { withFileTypes: true })) {
      const child = join(relative, entry.name);
      if (entry.isDirectory()) { await visit(child); continue; }
      if (!entry.isFile()) continue;
      const ownedPixel = entry.name.endsWith(`-${platform}.png`);
      const shared = includeShared && SHARED_EXTENSIONS.has(extname(entry.name));
      if (!ownedPixel && !shared) continue;
      const destination = join(destinationRoot, child);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(join(sourceRoot, child), destination);
      if (ownedPixel) pixels += 1;
    }
  }
  await visit("");
  return pixels;
}

const args = process.argv.slice(2);
const source = args[0];
const destination = args[1];
const platformOption = args.indexOf("--platform");
const platform = platformOption < 0 ? process.platform : args[platformOption + 1]!;
if (!source || !destination || !SUPPORTED_PLATFORMS.has(platform)) throw new Error("Usage: collect-snapshots.mts source destination [--platform win32|darwin|linux] [--include-shared]");
const includeShared = args.includes("--include-shared") || process.env.SNAPSHOT_SHARED === "true";
const pixels = await collect(resolve(source), resolve(destination), platform, includeShared);
if (!pixels) throw new Error(`No ${platform} pixel snapshots were captured.`);
console.log(`Staged ${pixels} ${platform} pixel snapshot(s); shared snapshots: ${includeShared}.`);
