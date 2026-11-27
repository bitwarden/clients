/** The attribute that marks a Health list row's focusable element with its row id. */
export const HEALTH_LIST_ROW_ATTRIBUTE = "data-health-list-row";

/**
 * Moves focus within a Health list after rows changed under the user, for example after a
 * merge removed the row they had opened. Focuses the first of `rowIds` that is rendered, so
 * pass the preferred row first (the row now at the same index, then the previous one). Falls
 * back to `fallback` when none is rendered; a virtual list only renders rows near the scroll
 * offset. Call after the list has rendered (`afterNextRender`).
 *
 * @returns Whether a row took focus.
 */
export function focusHealthListRow(
  host: HTMLElement,
  rowIds: readonly (string | undefined)[],
  fallback?: () => HTMLElement | null | undefined,
): boolean {
  const rendered = new Map<string, HTMLElement>();
  host.querySelectorAll<HTMLElement>(`[${HEALTH_LIST_ROW_ATTRIBUTE}]`).forEach((element) => {
    const id = element.getAttribute(HEALTH_LIST_ROW_ATTRIBUTE);
    if (id != null) {
      rendered.set(id, element);
    }
  });

  for (const id of rowIds) {
    const row = id == null ? undefined : rendered.get(id);
    if (row != null) {
      row.focus();
      return true;
    }
  }

  fallback?.()?.focus();
  return false;
}
