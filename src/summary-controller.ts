import type { LedgerCommand } from "../contracts/ledger";
import { parseMinorUnits } from "../domain/money";
import { shiftMonth } from "../domain/summary";

/** Navigation is view state; only a budget save crosses the persistence boundary. */
export function bindSummaryEvents(month: string, changeMonth: (month: string) => void, execute: (command: LedgerCommand) => Promise<boolean>, reportError: (error: unknown) => void): void {
  const picker = document.getElementById("summary-month") as HTMLInputElement | null;
  if (!picker) return;
  picker.addEventListener("change", () => changeMonth(picker.value));
  document.getElementById("previous-month")?.addEventListener("click", () => changeMonth(shiftMonth(month, -1)));
  document.getElementById("next-month")?.addEventListener("click", () => changeMonth(shiftMonth(month, 1)));
  for (const form of document.querySelectorAll<HTMLFormElement>(".budget-form")) form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const input = form.querySelector<HTMLInputElement>("input");
      if (!input || !form.dataset.categoryId) throw new Error("Budget form is incomplete.");
      void execute({ type: "setBudget", month, categoryId: form.dataset.categoryId, amount: parseMinorUnits(input.value) });
    } catch (error) { reportError(error); }
  });
}
