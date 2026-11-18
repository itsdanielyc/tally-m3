type EditableControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement;

/** Freeze a pending form without enabling controls that were already disabled. O(e) time, O(k) space. */
export function disableControls(scope: ParentNode): () => void {
  const controls = Array.from(scope.querySelectorAll<EditableControl>("input, select, textarea, button")).filter((control) => !control.disabled);
  for (const control of controls) control.disabled = true;
  return () => { for (const control of controls) if (control.isConnected) control.disabled = false; };
}
