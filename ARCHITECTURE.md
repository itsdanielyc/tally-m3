# Tally architecture
<!-- keel:start -->
## Boundaries
- `contracts/`: shared, strictly typed ledger, command and result shapes; no OS APIs.
- `domain/`: money, dates, validation, CSV, rules, summaries and filtering; pure functions.
- `electron/`: persistence, command service, IPC and native file dialogs; owns the local file.
- `src/api.ts`: sole renderer boundary; native preload or visibly labelled in-memory mock.
- `src/`: accessible HTML views and event controllers; no Node or filesystem access.
- `tests/`: L1 domain, L2 shared adapter conformance, L3 real file I/O, L4/L5 browser and L6 Electron.
Dependencies flow UI -> adapter -> contracts -> service -> domain/store; domain never imports UI or Electron.

## Seam
One typed request dispatcher crosses the sandboxed, context-isolated preload.
The same service powers a memory-backed mock and a disk-backed native adapter.
Conformance tests run shared cases against both stores; L6 also exercises IPC and verifies sandboxing.
Contract changes land in a separate small PR before their feature implementation.

## State and data
The main process owns a single ledger JSON document in application data: schema version,
currency, transactions, categories, rules and monthly budgets. Amounts and aggregates are safe integers.
Commands validate all input at the trust boundary. Mutations clone and validate a candidate,
Monthly totals are derived with BigInt; persisted transactions and budgets stay bounded integers.
Credits offset category budget use. Month navigation uses calendar strings, without timezone conversion.
flush a temporary file, atomically rename it, then publish the candidate to memory.
Failed writes leave both the previous file and in-memory state intact. Startup never silently
replaces corrupt or unsupported data. Version migration is explicit and fixture-tested.
One in-memory snapshot supports one immediate undo for delete, category merge and import;
any subsequent mutation replaces/clears it. Undo itself is persisted atomically.
Renderer state holds only the current snapshot, active view, filters and import preview.
CSV duplicates use a Set keyed by date, signed amount and normalized payee; imports commit once.

## Platform integration
Native CSV open/save dialogs live in Electron only. A test-only path injected through
environment variables is enabled solely in isolated test launches, so L6 drives actual file I/O.
No runtime network, telemetry, updater, remote content or renderer Node integration.

## Deliberately simple
- JSON plus atomic replacement instead of a database: revisit when full-file saves exceed 5 seconds.
- Pure DOM TypeScript instead of a component framework: revisit if view state becomes hard to trace.
- One command queue and one ledger instance: no multi-window editing, sync or accounts.
Solo ownership: one agent owns all directories; no delegation or handoff artifacts.
<!-- keel:end -->
