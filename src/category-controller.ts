import type { LedgerCommand, LedgerSnapshot } from "../contracts/ledger";

/** Bind only the active management surface; the app owns command/error/refresh state. */
export function bindCategoryEvents(snapshot: LedgerSnapshot, execute: (command: LedgerCommand) => Promise<boolean>): void {
  const root = document.getElementById("category-workspace");
  if (!root) return;
  const element = <T extends HTMLElement>(id: string): T => {
    const found = root.querySelector<T>(`#${id}`);
    if (!found) throw new Error(`Missing category control: ${id}`);
    return found;
  };
  const categoryForm = element<HTMLFormElement>("category-form");
  const ruleForm = element<HTMLFormElement>("rule-form");
  const categoryName = element<HTMLInputElement>("category-name");
  const ruleText = element<HTMLInputElement>("rule-contains");
  const ruleCategory = element<HTMLSelectElement>("rule-category");
  categoryForm.addEventListener("submit", (event) => { event.preventDefault(); void execute({ type: "saveCategory", id: categoryForm.dataset.editId, name: categoryName.value }); });
  ruleForm.addEventListener("submit", (event) => { event.preventDefault(); void execute({ type: "saveRule", id: ruleForm.dataset.editId, contains: ruleText.value, categoryId: ruleCategory.value }); });
  element<HTMLFormElement>("merge-form").addEventListener("submit", (event) => { event.preventDefault(); void execute({ type: "mergeCategory", sourceId: element<HTMLSelectElement>("merge-source").value, targetId: element<HTMLSelectElement>("merge-target").value }); });
  element("category-cancel").addEventListener("click", () => { categoryForm.reset(); delete categoryForm.dataset.editId; element("category-save").textContent = "Add category"; element("category-cancel").hidden = true; });
  element("rule-cancel").addEventListener("click", () => { ruleForm.reset(); delete ruleForm.dataset.editId; element("rule-cancel").hidden = true; });
  root.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLElement>("[data-category-action]");
    if (!button) return;
    const id = button.dataset.id!;
    switch (button.dataset.categoryAction) {
      case "rename": {
        const category = snapshot.ledger.categories.find((value) => value.id === id);
        if (!category) return;
        categoryForm.dataset.editId = id; categoryName.value = category.name;
        element("category-save").textContent = "Save category"; element("category-cancel").hidden = false; categoryName.focus(); categoryName.select(); break;
      }
      case "edit-rule": {
        const rule = snapshot.ledger.rules.find((value) => value.id === id);
        if (!rule) return;
        ruleForm.dataset.editId = id; ruleText.value = rule.contains; ruleCategory.value = rule.categoryId;
        element("rule-cancel").hidden = false; ruleText.focus(); ruleText.select(); break;
      }
      case "delete-category": void execute({ type: "deleteCategory", id }); break;
      case "delete-rule": void execute({ type: "deleteRule", id }); break;
      case "apply-rules": void execute({ type: "applyRules" }); break;
    }
  });
}
