import type { TransactionFilters } from "../domain/find";
import { parseMinorUnits } from "../domain/money";
import { CATEGORY_FILTER_PREFIX } from "./find-view";

/** Read a filter draft once; the app validates it before replacing the active result set. */
export function bindFindEvents(apply: (filters: TransactionFilters) => void, changePage: (page: number) => void, reportError: (error: unknown) => void): void {
  const form = document.getElementById("filter-form");
  if (!form) return;
  const value = (id: string): string => {
    const control = form.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`);
    if (!control) throw new Error(`Missing filter control: ${id}`);
    return control.value;
  };
  const amount = (id: string): number | null => value(id).trim() ? parseMinorUnits(value(id)) : null;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const category = value("filter-category");
      if (category !== "all" && category !== "uncategorised" && !category.startsWith(CATEGORY_FILTER_PREFIX)) throw new Error("Choose a valid category filter.");
      apply({ query: value("filter-query"), categoryId: category === "all" ? undefined : category === "uncategorised" ? null : category.slice(CATEGORY_FILTER_PREFIX.length), fromDate: value("filter-from") || null, toDate: value("filter-to") || null, minimumAmount: amount("filter-minimum"), maximumAmount: amount("filter-maximum") });
    } catch (error) { reportError(error); }
  });
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-page]")) button.addEventListener("click", () => changePage(Number(button.dataset.page)));
}
