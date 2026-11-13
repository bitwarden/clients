import { DestroyRef, ElementRef, Signal, computed, inject, signal } from "@angular/core";

/** `bit-table-v2` draws a 1px border on each side, inside the width its host is given. */
const TABLE_FRAME_PX = 2;

/** A column the table may drop, with the minimum width of its `bit-column` track. */
export interface PamDroppableColumn<C extends string> {
  readonly column: C;
  readonly minWidth: number;
}

/**
 * The droppable columns that fit beside the always-shown ones in `containerWidth` px, keeping
 * them in priority order: a column shows only if every column before it in `droppable` does, so
 * the least important goes first as the container narrows. A width of 0 means "not measured yet"
 * and keeps every column, as on a wide window.
 *
 * @param fixedWidth The summed minimum track widths of the columns that always show.
 * @param droppable Most important first.
 */
export function fitPamColumns<C extends string>(
  containerWidth: number,
  fixedWidth: number,
  droppable: readonly PamDroppableColumn<C>[],
): ReadonlySet<C> {
  if (containerWidth <= 0) {
    return new Set(droppable.map(({ column }) => column));
  }
  const shown = new Set<C>();
  let budget = containerWidth - TABLE_FRAME_PX - fixedWidth;
  for (const { column, minWidth } of droppable) {
    if (minWidth > budget) {
      break;
    }
    shown.add(column);
    budget -= minWidth;
  }
  return shown;
}

/**
 * The host element's content-box width, in px, tracked with a `ResizeObserver`. Reads 0 until the
 * first observation. Call from a component's injection context; the host must not be inline.
 */
export function pamHostWidth(): Signal<number> {
  const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  const width = signal(0);
  const observer = new ResizeObserver(([entry]) =>
    width.set(entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width),
  );
  observer.observe(host);
  inject(DestroyRef).onDestroy(() => observer.disconnect());
  return width.asReadonly();
}

/**
 * Which droppable columns the tab's table shows, by the width the tab actually has rather than
 * the window's: the desktop side nav takes a large, fixed share of a narrow window, so viewport
 * breakpoints would leave the table wider than its container and push the trailing columns
 * (Actions) out of view. Call from the tab component's injection context.
 */
export function pamFittingColumns<C extends string>(
  fixedWidth: number,
  droppable: readonly PamDroppableColumn<C>[],
): Signal<ReadonlySet<C>> {
  const width = pamHostWidth();
  return computed(() => fitPamColumns(width(), fixedWidth, droppable), {
    equal: (a, b) => a.size === b.size && [...a].every((column) => b.has(column)),
  });
}
