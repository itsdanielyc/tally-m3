# Verification ledger

Append-only. Each row says what was proven, where, and by which run. "Built"
is never rounded up to "tested"; anything not listed here is unverified.

| Date | Level | Claim | Platforms | Evidence |
|---|---|---|---|---|
| 2026-11-18 16:27 UTC | L1/L2 | Scaffold contract detects an intentionally wrong mock greeting, restored to 3 passing tests | local windows x64 | `npm run test:unit`, exit 0 at 16:27:18; red: expected greeting, received `wrong greeting`; `artifacts/red/scaffold-contract.log` |
| 2026-11-18 16:21 UTC | L4/L5 | Scaffold browser behavior, shared ARIA and geometry pass; pixels await runners | local windows x64 | `npm run test:ui`, exit 0, 4 pass / 1 missing-baseline skip; dedicated loopback port |
| 2026-11-18 16:21 UTC | L0/L6 | Built Electron sandbox, IPC greeting, platform and console smoke pass | local windows x64 | `npm run build` and `npm run test:e2e`, exit 0, 4 pass; `artifacts/e2e/win32-x64.png` visually reviewed |

| 2026-11-18 17:28 UTC | Scaffold / L0-L2, L4-L6 | Types, contract, browser behavior and all three visual tiers, sandbox/IPC Electron smoke; every native screenshot visually reviewed | windows-x64, macos-arm64, linux-x64 | [CI 44354583567](https://github.com/itsdanielyc/tally-m3/actions/runs/44354583567), 8/8 jobs green on source 3ebf8bc; queued macOS job requeued in attempt 2; artifacts e2e-* |
| 2026-11-18 17:28 UTC | L7 installers | NSIS, dmg, deb and AppImage install, launch and removal | windows-x64, macos-arm64, linux-x64 | [installers 44354583315](https://github.com/itsdanielyc/tally-m3/actions/runs/44354583315), 3/3 jobs green on source 3ebf8bc; unsigned |
| 2026-11-18 17:28 UTC | L5 review | Runner PNGs and native screenshots reviewed across three OSes | windows-x64, macos-arm64, linux-x64 | Windows/Linux capture jobs in [44346108378](https://github.com/itsdanielyc/tally-m3/actions/runs/44346108378), macOS capture job in [44349705557](https://github.com/itsdanielyc/tally-m3/actions/runs/44349705557); proposal failure corrected by PR 8; final CI above passes all baselines |
| 2026-11-18 17:15 UTC | L0-L3 local / slice 1 branch | Exact money/calendar, actual browser-mock and file-service conformance, migration, rejected writes and detached/serial state | local windows x64 | typecheck exit 0; unit 25, contract 16, integration 4 pass; all 40 new domain/contract/I/O tests deliberately seen red: amount offset/validation bypass, all-valid/all-invalid dates, missing IDs, lost queue, leaked snapshots, premature publication, ignored disk load/save; artifacts/red/slice1-*.json |
| 2026-11-18 17:15 UTC | L4/L5 local / slice 1 branch | Add/edit/delete, amount error and currency flow; ARIA/geometry; scaffold coverage retained | local windows x64 | npm run test:ui exit 0, 10 pass, 1 pending runner PNG skip; five new checks deliberately red with wrong stored amount, omitted validation, ignored currency, missing button/geometry target |
| 2026-11-18 17:19 UTC | L6 local / slice 1 branch | Native IPC contract, malformed money, exact add/edit/restart/delete file journey; 30 serial repeats pass | local windows x64 | build exit 0; repeat-each 30 exit 0, 90/90 assertions, 78s; artifacts/e2e/stress-before.json. Each new journey deliberately red via schema 0, wrong cent, or no-op delete. Earlier 20-repeat run had one worker fast-fail: issue #9, not claimed fixed |

## Unverified

- Slice 1 hosted full-level proof and transaction-screen PNGs are pending. Slices 2 through 6 are not implemented.
- Isolated local Windows stress worker fast-fail remains unexplained: [issue #9](https://github.com/itsdanielyc/tally-m3/issues/9). Subsequent 30 repeats passed 90/90.
- Signing/notarization and physical power-cut testing have not been performed.
