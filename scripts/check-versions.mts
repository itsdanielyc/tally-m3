import { readFile } from "node:fs/promises";
import { assertVersionAgreement } from "./release-policy.ts";

const pkg = JSON.parse(await readFile("package.json", "utf8")) as { version?: unknown };
const lock = JSON.parse(await readFile("package-lock.json", "utf8")) as { version?: unknown; packages?: Record<string, { version?: unknown }> };
const version = assertVersionAgreement(pkg.version, lock.version, lock.packages?.[""]?.version);
const changelog = await readFile("CHANGELOG.md", "utf8");
if (!changelog.includes(`## [${version}]`)) throw new Error(`Changelog lacks version ${version}.`);
if (process.env.GITHUB_REF?.startsWith("refs/tags/") && process.env.GITHUB_REF_NAME !== `v${version}`) throw new Error("Tag version differs from the package version.");
console.log(`Version ${version} agrees across package, lock and changelog.`);
