# Tally v0.1.0 plan
<!-- keel:start -->
The fixed scope and ordering come from SLICES.md. Solo ownership for every slice.

| # | Slice | Done when | Levels | Owner | Status |
|---|---|---|---|---|---|
| 0 | Scaffold | electron-web scaffold, CI and installers green on every Tier 1 platform; runner baselines reviewed and first ledger rows recorded | L0-L2, L4-L7 | solo | done: CI 44354583567, installers 44354583315 |
| 1 | Record transactions | Validation and whole-minor-unit money tests; memory/disk conformance; atomic-write and migration tests; add/edit/delete UI; real-shell restart retains the exact ledger; Tier 1 green | L0-L6 | solo | done: CI 44371409712 and 44380550668 |
| 2 | Import a bank CSV | Delimiter/header/date/money mapping fixtures, rejected line reasons, within-file/existing duplicates, 2,000 rows <5s; atomic all-or-none import; preview UI and native-dialog-bypass real-shell journey; Tier 1 green | L0-L6 | solo | open |
| 3 | Categories and rules | Category create/rename/delete/merge semantics and ordered contains rules tested, UI manages them and applies to uncategorised/imported rows; Electron journey; Tier 1 green | L0-L6 | solo | open |
| 4 | Monthly summary and budgets | Integer exact per-category/income/spending totals, boundary months, budget remaining/over tested; previous/next UI and Electron summary; Tier 1 green | L0-L6 | solo | open |
| 5 | Find, export, undo | Combined filters, escaped CSV round trip, one immediate undo of delete/merge/import with atomic persistence; UI and native export/reimport journey; Tier 1 green | L0-L6 | solo | open |
| 6 | Release readiness | 0.1.0 versions agree; changelog and unsigned notes; release gate proven to reject unproven commit; fresh CI and installer round trips green for candidate commit; ledger current; no tag/release | L0-L7 | solo | open |

## Rulings
- Ruling: category deletion removes its rules and budgets and leaves its transactions uncategorised; merge adds per-month budgets and reassigns every reference — prevent dangling IDs — deletion loses those settings until the slice 5 undo is available.
- Ruling: Uncategorised is reserved, category names and duplicate rule needles compare without case using Unicode NFC, first-created matching rule wins — keep null state and rule priority unambiguous — rule reordering is outside the fixed scope.
- Ruling: snapshot artifacts contain only the capturing OS's PNGs; the first selected runner owns shared text/geometry — full artifact sets carried stale other-OS PNGs that overwrote fresh captures — two integration tests and an ownership mutation guard the merge.
- Ruling: CSV inputs are bounded to 20 MiB and native decoding accepts UTF-8 or BOM-labelled UTF-16 — bound memory use and prevent silent character replacement — other encodings fail with a conversion message before any rows are written.
- Ruling: CSV duplicates compare against the ledger as it stood at preview time, preserving repeated source rows — exported manually entered identical transactions must round-trip with their multiplicity — accidental repeated rows in a first-time source remain visible as accepted rows.
- Ruling: two-digit CSV years 00–69 mean 2000–2069 and 70–99 mean 1970–1999 — common bank convention, always shown as four-digit dates in preview — older/future ambiguous files need explicit four-digit years.
- Ruling: after a slice is locally green, implement its successor on an isolated branch while hosted verification queues — unattended hosted macOS scheduling exceeded execution time — merges and done statuses remain strictly ordered and require the full named Tier 1 proof for each slice; branch management costs more.
- Ruling: one CI verification job per Tier 1 OS runs L0 through L6 in order — repeated setup and queued macOS jobs dominated wall time — all levels and platforms remain required; execution budgets stay unchanged.
- Ruling: keep the scaffold UI/tests until the replacement transaction journeys pass on runners, then promote in a separate PR — preserves inherited coverage while replacing the demo — one temporary preview route exists only during slice 1.
- Ruling: treat isolated Windows Playwright worker fast-fail as an L6 harness observation, issue #9 — 30 subsequent serial repeats passed 90/90 without changing assertions/timeouts — cause remains unverified; one environmental L6 retry is the existing Keel allowance.
- Ruling: implement slice 1 only on an isolated branch while macOS scaffold jobs await hosted capacity — main remains the scaffold and no slice can be marked done without its complete Tier 1 proof — this defers the scaffold skill's before-feature scheduling gate, not any definition of done; feature merge waits for scaffold proof.
- Ruling: use `com.example.tally` as the unsigned bundle identifier — no organization identifier supplied — changing it later may change install identity.
- Ruling: default currency GBP, configurable as a three-letter currency with two minor digits — single-currency UK-context household ledger — non-two-digit currencies require a later scope decision.
- Ruling: first matching payee rule wins, case-insensitive contains; duplicate payees use trimmed case-folded text — deterministic and useful bank matching — differently cased payees are considered duplicates.
- Ruling: spending entered negative and income positive; zero is allowed — signed CSV and exact accounting — sign must be communicated in UI.
- Ruling: all reversible choices and pre-authorized GitHub branch/PR/workflow operations proceed unattended — owner's explicit instruction — decisions are recorded here and in evidence.
- Ruling: preserve the original skills and fixed inputs after scaffold generation — generator's broad rename also visits embedded templates — restore only its incidental changes to those tracked files.
- Ruling: router inventory's git detection is a Windows path false negative — `git status` confirms this folder's clean main and existing origin — use direct git/gh evidence.
- Ruling: browser harness binds 127.0.0.1:17241 and refuses server reuse — template port 1420 was occupied locally — dev URLs differ from template documentation.
- Ruling: CI concurrency includes event type — delayed merged PR events cancelled main evidence — PR and main may briefly run concurrently.
- Ruling: bootstrap workflow PRs merge before initial pixel baselines exist — GitHub dispatch needs workflows on the default branch — scaffold stays open until the subsequent baseline commit is fully green.
<!-- keel:end -->

Ruling: pin macos-26 with an arm64 assertion ? the successful initial macOS installer job identifies macos-26-arm64; the earlier macos-15 pin had no execution evidence ? runner-image updates are explicit.

Ruling: retain the demonstrated macos-latest runner with explicit arm64 assertion; image names do not establish runner labels ? avoid unproven pin aliases ? capacity remains external. Resume snapshots for only the missing OS; already reviewed Linux/Windows captures remain valid because renderer bytes are unchanged.
