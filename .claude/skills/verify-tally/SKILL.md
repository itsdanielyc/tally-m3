---
name: verify-tally
description: How to launch, check, drive and clean up Tally on this machine to prove a behaviour end to end. Use it whenever you need to see the real app do something rather than trust a unit test, before claiming a user-facing change works, or when triaging a real-shell failure.
license: MIT
---

# verify-tally

Read cold, mid-task. Every command below is real for this repository.

## Launch

- Built app for the real-shell suite: `npm run build` writes `out/`; the
  suite launches it through Playwright's Electron launcher. Electron
  downloads its binary on first launch; `node node_modules/electron/install.js`
  fetches it ahead of time (CI does this in its own step).
- Dev loop with hot reload: `npm run dev` (electron-vite); renderer alone
  in a browser: `npm run dev:web` (Vite on port 17241).
- Ready means: the main window titled "Tally" is visible and the backend
  badge reads "native".

## Doctor (read-only)

- `node -v` is 24 or newer; the Electron binary is present
  (`node node_modules/electron/install.js` is a no-op when it is).
- `out/main/main.js` exists and is newer than `electron/` and `src/`.
- Linux without a display: run the suite under `xvfb-run`.
- No other instance is running (`tasklist` / `pgrep -f tally`).

## Drive

- Transaction journeys: `npm run build` then `npx playwright test -c playwright.e2e.config.ts tests/e2e/ledger.spec.ts`.
  The suite uses `TALLY_TEST_MODE=1`, `TALLY_DATA_DIR=<repo>/.cache/<unique-dir>` and,
  during the slice 1 replacement period, `TALLY_LEDGER_UI=1` to select the preview UI.
  Test paths outside this repository's `.cache` are rejected. Never launch a data-writing
  test against the normal application-data directory.
- Browser preview during replacement: `http://127.0.0.1:17241/?ledger=1`.
- L1 `npm run test:unit`; L2 `npm run test:contract`; L3 `npm run test:integration`.
- The transaction suite adds/edits, closes and restarts Electron, checks exact file bytes,
  deletes, verifies renderer Node globals are absent and checks malformed money over IPC.
- Reports use separate `test-results/ui` and `test-results/e2e` folders. Wait for the
  document to load before asserting app readiness; do not compensate with a larger timeout.
- CSV import uses the named native-dialog bypass `TALLY_TEST_IMPORT_PATH`, enabled
  only in isolated unpackaged test launches and bounded to `<repo>/.cache/`.
  The L6 journey reads an actual 2,000-row file, reports its rejected physical line,
  confirms in under five seconds and previews the same file again as duplicates.
  Native decoding accepts UTF-8 and BOM-labelled UTF-16; malformed text fails before import.

- Real shell: `npm run test:e2e` launches `out/` through Playwright and
  checks the badge, the greeting round trip and the console; add journeys
  under `tests/e2e/`.
- Browser against the mock: `npm run test:ui` (chromium); the badge must
  read "mock".
- Stable handles: `data-testid` attributes and ARIA roles, never pixels.

## Evidence

- A screenshot from the real shell lands in `artifacts/e2e/<os>-<arch>.png`.
- A behaviour counts as verified when a test asserts it and the ledger row
  names the level, the platform and the run.
- Never weaken a journey to make it pass.

## Cleanup

- Kill only what you started (the suite does this; after a manual launch,
  close the window or kill the one PID you recorded).
- Evidence (`artifacts/`) survives cleanup and is gitignored.
