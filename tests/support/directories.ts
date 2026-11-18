import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve, sep, join } from "node:path";

const TEST_ROOT = resolve(process.cwd(), ".cache");

/** Allocate isolated data only under the repository, never application data or system temp. */
export async function createTestDirectory(prefix: string): Promise<string> {
  await mkdir(TEST_ROOT, { recursive: true });
  return mkdtemp(join(TEST_ROOT, prefix));
}

/** Resolve and bound the target before any recursive test cleanup. */
export async function removeTestDirectory(directory: string): Promise<void> {
  const target = resolve(directory);
  if (!target.startsWith(`${TEST_ROOT}${sep}`)) throw new Error(`Refusing cleanup outside the test root: ${target}`);
  await rm(target, { recursive: true, force: true });
}
