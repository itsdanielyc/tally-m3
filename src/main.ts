if (new URLSearchParams(window.location.search).has("ledger")) {
  await import("./tally");
} else {
  await import("./scaffold");
}
export {};
