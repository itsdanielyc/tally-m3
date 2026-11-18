interface WorkflowJob { name: string; conclusion: string | null }
export interface WorkflowProof { headSha: string; conclusion: string | null; jobs: WorkflowJob[]; url?: string }

/** A successful run cannot substitute another commit or omit a declared platform. O(j+r) time/space. */
export function assertWorkflowProof(value: unknown, candidate: string, requiredJobs: readonly string[]): asserts value is WorkflowProof {
  if (!value || typeof value !== "object" || !("headSha" in value) || value.headSha !== candidate || !("conclusion" in value) || value.conclusion !== "success" || !("jobs" in value) || !Array.isArray(value.jobs)) throw new Error("Workflow proof does not establish success on this exact candidate.");
  const green = new Set(value.jobs.filter((job: unknown): job is WorkflowJob => !!job && typeof job === "object" && "name" in job && typeof job.name === "string" && "conclusion" in job && job.conclusion === "success").map((job) => job.name));
  for (const job of requiredJobs) if (!green.has(job)) throw new Error(`Required platform job lacks green proof: ${job}`);
}

/** One semantic version drives the package, lock root and lock package entry. */
export function assertVersionAgreement(packageVersion: unknown, lockVersion: unknown, lockEntryVersion: unknown): string {
  if (typeof packageVersion !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(packageVersion) || packageVersion !== lockVersion || packageVersion !== lockEntryVersion) throw new Error("Package/lock versions are invalid or have drifted.");
  return packageVersion;
}
