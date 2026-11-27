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

/** How long a virtual list gets to render rows after a scroll restore, in frames. */
const RENDER_RETRY_COUNT = 10;
const RENDER_RETRY_MS = 16;

/**
 * {@link focusHealthListRow} for a list that has only just been scrolled: a virtual list renders
 * the rows around the new offset a frame or two later, so the preferred row is looked for again
 * before `fallback` is used.
 */
export function focusHealthListRowWhenRendered(
  host: HTMLElement,
  rowIds: readonly (string | undefined)[],
  fallback?: () => HTMLElement | null | undefined,
  retriesLeft = RENDER_RETRY_COUNT,
): void {
  const preferred = rowIds.filter((id): id is string => id != null);
  const rendered = preferred.some((id) =>
    Array.from(host.querySelectorAll(`[${HEALTH_LIST_ROW_ATTRIBUTE}]`)).some(
      (element) => element.getAttribute(HEALTH_LIST_ROW_ATTRIBUTE) === id,
    ),
  );
  if (rendered || retriesLeft <= 0) {
    focusHealthListRow(host, rowIds, fallback);
    return;
  }
  setTimeout(
    () => focusHealthListRowWhenRendered(host, rowIds, fallback, retriesLeft - 1),
    RENDER_RETRY_MS,
  );
}
