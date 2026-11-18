import { createEmptyLedger, type Ledger, type LedgerStore } from "../contracts/ledger";

/** Browser mock persistence with the same detached read/write contract as disk. */
export class MemoryLedgerStore implements LedgerStore {
  private ledger: Ledger;
  constructor(initialLedger: Ledger = createEmptyLedger()) { this.ledger = structuredClone(initialLedger); }
  async load(): Promise<Ledger> { return structuredClone(this.ledger); }
  async save(ledger: Ledger): Promise<void> { this.ledger = structuredClone(ledger); }
}
