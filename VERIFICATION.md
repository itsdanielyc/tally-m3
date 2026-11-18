# Verification ledger

Append-only. Each row says what was proven, where, and by which run. "Built"
is never rounded up to "tested"; anything not listed here is unverified.

| Date | Level | Claim | Platforms | Evidence |
|---|---|---|---|---|
| 2026-11-18 16:27 UTC | L1/L2 | Scaffold contract detects an intentionally wrong mock greeting, restored to 3 passing tests | local windows x64 | `npm run test:unit`, exit 0 at 16:27:18; red: expected greeting, received `wrong greeting`; `artifacts/red/scaffold-contract.log` |
| 2026-11-18 16:21 UTC | L4/L5 | Scaffold browser behavior, shared ARIA and geometry pass; pixels await runners | local windows x64 | `npm run test:ui`, exit 0, 4 pass / 1 missing-baseline skip; dedicated loopback port |
| 2026-11-18 16:21 UTC | L0/L6 | Built Electron sandbox, IPC greeting, platform and console smoke pass | local windows x64 | `npm run build` and `npm run test:e2e`, exit 0, 4 pass; `artifacts/e2e/win32-x64.png` visually reviewed |

## Unverified

- Everything: the scaffold has not yet run in CI for this project.
