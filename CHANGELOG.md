# Changelog
<!-- keel:start -->
All notable changes are recorded here. Versions follow semantic versioning.
The first version is prepared but remains untagged and unpublished.

## [0.1.0] - 2026-11-18

### Added
- Record, edit and delete transactions with exact minor-unit amounts and a single currency.
- Reopen a versioned local ledger after restart; failed writes preserve the prior ledger.
- Detect and map bank CSVs, preview rejected physical lines and skip stored duplicates.
- Manage categories and ordered payee rules, including complete category merges.
- Compare exact monthly income, spending and category net totals against monthly budgets.
- Find transactions, export the entire matching set, re-import category/note data and undo one immediate delete, merge or import.

### Distribution
- Unsigned Windows x64 NSIS, macOS arm64 dmg, Linux x64 deb and AppImage bundles.
- No updater, account, bank connection or runtime network access.
- Signing status and limitations: RELEASE-NOTES.md. Evidence: VERIFICATION.md and release-readiness PR.

### Fixed
- Older version-zero rows with absent or null optional category/note fields open without changing the old file until a save.
<!-- keel:end -->
