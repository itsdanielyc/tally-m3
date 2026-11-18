import { expect, it } from "vitest";
import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createTestDirectory, removeTestDirectory } from "../support/directories";

async function capture(directory: string, label: string): Promise<string> {
  const source = join(directory, label);
  await mkdir(source);
  await writeFile(join(source, "ledger-chromium-win32.png"), `${label}-windows`);
  await writeFile(join(source, "ledger-chromium-linux.png"), `${label}-linux`);
  await writeFile(join(source, "ledger-chromium-darwin.png"), `${label}-mac`);
  await writeFile(join(source, "ledger.geometry.json"), JSON.stringify({ owner: label }));
  await writeFile(join(source, "ledger.aria.yml"), `- text: ${label}`);
  return source;
}

function collect(source: string, destination: string, platform: string, shared: boolean): void {
  const result = spawnSync(process.execPath, ["scripts/collect-snapshots.mts", source, destination, "--platform", platform, ...(shared ? ["--include-shared"] : [])], { encoding: "utf8" });
  expect(result.stderr, result.stderr).toBe("");
  expect(result.status).toBe(0);
}

it("stages only its own platform PNGs and explicitly selected shared snapshots", async () => {
  const directory = await createTestDirectory("snapshot-owner-");
  try {
    const source = await capture(directory, "windows-new");
    const output = join(directory, "staged");
    collect(source, output, "win32", true);
    expect((await readdir(output)).sort()).toEqual(["ledger-chromium-win32.png", "ledger.aria.yml", "ledger.geometry.json"]);
  } finally { await removeTestDirectory(directory); }
});

it("merging capture sets never overwrites another OS or the selected shared baseline", async () => {
  const directory = await createTestDirectory("snapshot-merge-");
  try {
    const output = join(directory, "staged");
    collect(await capture(directory, "windows-new"), output, "win32", true);
    collect(await capture(directory, "linux-new"), output, "linux", false);
    expect(await readFile(join(output, "ledger-chromium-win32.png"), "utf8")).toBe("windows-new-windows");
    expect(await readFile(join(output, "ledger-chromium-linux.png"), "utf8")).toBe("linux-new-linux");
    expect(await readFile(join(output, "ledger.geometry.json"), "utf8")).toBe('{"owner":"windows-new"}');
  } finally { await removeTestDirectory(directory); }
});
