# Tally 0.1.0 release readiness
<!-- keel:start -->
This is a prepared, untagged candidate. No GitHub release or published assets exist.
The fixed v0.1.0 scope is in SLICES.md; the evidence ledger is VERIFICATION.md.
The immutable candidate SHA and final exact-run attestation are recorded in
[release-readiness PR #24](https://github.com/itsdanielyc/tally-m3/pull/24).

The release workflow refuses a candidate unless both CI and installer round trips
passed for that exact commit on Windows x64, macOS arm64 and Linux x64. It builds
only NSIS, dmg, deb and AppImage, with per-platform SHA256SUMS. Tier 2 and 3 are empty.

<!-- signing:start -->
Signing: unsigned, with no Developer ID notarization. Windows SmartScreen can show
“Windows protected your PC”. macOS Gatekeeper can report that the developer cannot
be verified or that Apple could not verify the app is free of malware; wording depends
on the OS. Test installer launches remove quarantine attributes; they do not prove the
download-warning bypass. Signing would require a paid Windows OV/EV certificate or
signing service, and a paid annual Apple Developer membership plus Developer ID and
notarization credentials. No credentials were added or rotated; ADR 001 stays unsigned.
<!-- signing:end -->

No tag or GitHub release is created in this run. Tag-triggered publishing and a smoke
install of published assets are intentionally unverified. Physical power-cut tests,
screen-reader testing and other architectures/distributions are unverified. The single
local Windows stress worker fast-fail remains tracked in GitHub issue #9; thirty later
serial repeats passed. Normal required native journeys remain enabled.

CSV text is UTF-8 or BOM-labelled UTF-16, bounded to 20 MiB. Larger exports require
narrower filters. Amounts/budgets are bounded integer minor units; derived monthly totals
use BigInt. Two-digit years use the recorded pivot, and same-source multiplicity is
preserved so exported identical transactions round-trip. Undo history is session-only;
the undo result itself is persisted atomically.
<!-- keel:end -->
