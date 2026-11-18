import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { assertWorkflowProof } from "./release-policy.ts";

const RUNNERS: Readonly<Record<string, string>> = { "windows-x64": "windows-latest", "macos-arm64": "macos-latest", "linux-x64": "ubuntu-latest" };
const sh = (command: string, args: string[]): string => execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const candidate = process.argv[2] ?? process.env.GITHUB_SHA ?? sh("git", ["rev-parse", "HEAD"]);
if (!/^[a-f0-9]{40}$/.test(candidate)) throw new Error("Release candidate must be an exact commit SHA.");
const repository = process.env.GITHUB_REPOSITORY ?? sh("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
const manifest = JSON.parse(await readFile("keel.json", "utf8")) as { platforms: { tier1: string[]; tier2: string[]; tier3: string[] } };
if (manifest.platforms.tier2.length || manifest.platforms.tier3.length) throw new Error("Extend the release gate before adding new platform tiers.");
const runners = manifest.platforms.tier1.map((platform) => { const runner = RUNNERS[platform]; if (!runner) throw new Error(`Unknown Tier 1 platform: ${platform}`); return runner; });

/** Read named successful runs, then inspect every required platform job. No tags or releases are written. */
function prove(workflow: string, prefix: string): void {
  const runs = JSON.parse(sh("gh", ["run", "list", "--repo", repository, "--workflow", workflow, "--commit", candidate, "--status", "success", "--limit", "20", "--json", "databaseId"])) as { databaseId: number }[];
  for (const run of runs) {
    const proof: unknown = JSON.parse(sh("gh", ["run", "view", String(run.databaseId), "--repo", repository, "--json", "headSha,conclusion,jobs,url"]));
    try { assertWorkflowProof(proof, candidate, runners.map((runner) => `${prefix} (${runner})`)); console.log(`${workflow}: ${String(run.databaseId)} proves ${candidate}`); return; }
    catch { /* Try an older successful attempt only if it proves every declared platform. */ }
  }
  throw new Error(`No complete green ${workflow} platform proof exists for candidate ${candidate}.`);
}

prove("installers.yml", "installers");
prove("ci.yml", "verify");
console.log(`Release gate passed for ${candidate}. No tag or release was created.`);
