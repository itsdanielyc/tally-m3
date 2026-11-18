# Tally test strategy
<!-- keel:start -->
| Level | Tool / command | Purpose |
|---|---|---|
| L0 | `npm run typecheck` | Separate renderer, main and test type checking |
| L1 | `npm run test:unit` | Exact money, valid dates, CSV formats, rules, totals, filters |
| L2 | `npm run test:contract` | Same scenarios against memory and disk service |
| L3 | `npm run test:integration` | Temp ledger, migrations, interrupted saves, permission failures |
| L4/L5 | `npm run test:ui` | Labelled mock journeys; ARIA, geometry, runner pixel baselines |
| L6 | `npm run build` then `npm run test:e2e` | Real Electron IPC, isolated files, restart and CSV round trip |
| L7 | `installers` workflow | NSIS, dmg, deb and AppImage install/launch/remove |

All touched levels must pass on windows-x64, macos-arm64 and linux-x64 before a slice is done.
CI runs fast checks and real I/O on all three, chromium UI and Electron on all three,
and installers on main. No Tier 2 or Tier 3 platforms are configured.

## Critical journeys
| Journey | Cheapest proof | Real shell proof |
|---|---|---|
| Add/edit/delete and reopen unchanged | L1/L2/L3 + L4 form | L6 add/edit/restart/delete |
| Map/preview malformed and duplicate CSV, commit atomically | L1/L2/L3 + L4 wizard | L6 native file import |
| Category lifecycle and ordered payee rules | L1/L2 + L4 | L6 category/rule journey |
| Exact monthly income, spending and budgets | L1/L2 + L4 | L6 summary |
| Filter/export/reimport and one-step undo | L1/L2/L3 + L4 | L6 native export/reimport |
| Install launch uninstall | L7 OS scripts | L7 independent packaged processes |

Visual tier 1 is a shared ARIA snapshot; tier 2 uses 8 px geometry tolerance;
tier 3 uses per-OS chromium PNGs with 0.002 pixel ratio tolerance.
Only the hosted `snapshots` workflow creates PNG baselines, reviewed before merge.
Real-shell screenshots are reviewed from every platform for each UI slice.

L0-L2 budget <3 minutes; browser per OS <5 minutes; L6 <15 minutes;
L7 <25 minutes; PR wall clock <20 minutes. Record measured exceptions and their cause.
Every new test needs a recorded red. Missing-module red proves initial tests;
later tests must fail on missing behavior or a deliberate mutation.
Flakiness follows `.agents/skills/keel-test/SKILL.md`: reproduce, quarantine with issue,
fix cause; one retry at L6/L7 only, never lower. No wider timeout without a found cause.
No signing, notarization, screen reader or other distribution/architecture claim in v0.1.0.
<!-- keel:end -->
