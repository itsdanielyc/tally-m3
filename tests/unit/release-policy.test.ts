import { expect, it } from "vitest";
import { assertWorkflowProof, assertVersionAgreement } from "../../scripts/release-policy";

const candidate = "a".repeat(40);
const required = ["installers (ubuntu-latest)", "installers (windows-latest)", "installers (macos-latest)"];
const valid = { headSha: candidate, conclusion: "success", jobs: required.map((name) => ({ name, conclusion: "success" })) };
it("accepts proof only for the exact candidate and every required platform job", () => expect(() => assertWorkflowProof(valid, candidate, required)).not.toThrow());
it.each([{ ...valid, headSha: "b".repeat(40) }, { ...valid, conclusion: "failure" }, { ...valid, jobs: valid.jobs.slice(1) }, { ...valid, jobs: valid.jobs.map((job, index) => index ? job : { ...job, conclusion: "skipped" }) }])("rejects unproven or incomplete workflow evidence %j", (proof) => expect(() => assertWorkflowProof(proof, candidate, required)).toThrow(/proof|candidate|platform|job/i));
it("accepts matching semantic versions and rejects drift", () => {
  expect(assertVersionAgreement("0.1.0", "0.1.0", "0.1.0")).toBe("0.1.0");
  expect(() => assertVersionAgreement("0.1.0", "0.1.1", "0.1.0")).toThrow(/version/i);
  expect(() => assertVersionAgreement("0.1", "0.1", "0.1")).toThrow(/version/i);
});
