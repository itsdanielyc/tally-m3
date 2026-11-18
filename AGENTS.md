# Tally
<!-- keel:start -->
Tally is a one-person offline expense ledger for Windows x64, macOS Apple silicon
and Linux x64. PRODUCT.md and docs/adr/ are fixed. Build only SLICES.md in order.
Use only repository-local `.agents/skills/keel*` skills. Solo: one agent owns all code.

## Commands
- types: `npm run typecheck`; unit: `npm run test:unit`
- contracts: `npm run test:contract`; integration: `npm run test:integration`
- browser/mock: `npm run test:ui`; real shell: `npm run build` then `npm run test:e2e`
- installer: `.github/workflows/installers.yml`; triage: `npm run triage [run-id]`
- manual launch/evidence: `.agents/skills/verify-tally/SKILL.md`

## Layout
`src/` UI reaches only `src/api.ts`; `contracts/` shared types; `domain/` pure logic;
`electron/` native service, persistence, dialogs, preload; `tests/` by level.

## Rules
1. Name level, platform and run for every tested claim; VERIFICATION.md is append-only.
2. Every added or rewritten test must be seen red for its intended failure before trusted.
3. Contract changes merge first in a small separate PR, including mock/conformance changes.
4. Pixel baselines come only from hosted snapshots workflow and must be visually reviewed.
5. Never delete flaky coverage or hide it with timeouts; quarantine with an issue.
6. Keep money as safe integer minor units, validate at IPC, preserve old file on failed writes.
7. Keep functions small, descriptively named and strictly typed; document exported contracts
   and complex business logic; note time/space complexity above nontrivial algorithms.
8. Never tag or create a GitHub release during this run. No runtime network access.

## References
ARCHITECTURE.md: boundaries; TESTING.md: strategy; PLAN.md: status/rulings;
VERIFICATION.md: evidence; DESIGN.md: short UI decision log. Fixed input files stay intact.
<!-- keel:end -->
