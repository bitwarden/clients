export interface PackedItems {
  /** Indices that should be visible in the row. When pinIndex is set, it is always in this list. */
  displayed: readonly number[];
  /** Indices that should be rendered in the overflow affordance instead. */
  overflow: readonly number[];
}

/**
 * Pure pack function — given measurements, decide which items fit and which overflow.
 * The pinned item (if any) is always kept in `displayed` and reinserted at its ordinal
 * position so visible order matches DOM order.
 *
 * Returns "all displayed" when measurements aren't ready yet (containerWidth <= 0).
 *
 * @param itemWidths     Natural widths of each item in DOM order, in pixels.
 * @param containerWidth Available width for the row, in pixels.
 * @param gap            Horizontal gap between adjacent items, in pixels.
 * @param pinIndex       Item to keep visible no matter what, or null for first-fit only.
 */
export function pack(
  itemWidths: readonly number[],
  containerWidth: number,
  gap: number,
  pinIndex: number | null,
): PackedItems {
  const count = itemWidths.length;
  const all = Array.from({ length: count }, (_, i) => i);

  if (containerWidth <= 0) {
    return { displayed: all, overflow: [] };
  }

  const totalWidth = itemWidths.reduce((sum, w, i) => sum + w + (i > 0 ? gap : 0), 0);
  if (totalWidth <= containerWidth) {
    return { displayed: all, overflow: [] };
  }

  if (pinIndex !== null && pinIndex >= 0 && pinIndex < count) {
    const available = containerWidth - itemWidths[pinIndex];
    const displayed: number[] = [];
    const overflow: number[] = [];
    let used = 0;

    for (let i = 0; i < count; i++) {
      if (i === pinIndex) {
        continue;
      }
      const w = itemWidths[i] + gap;
      if (used + w > available) {
        for (let j = i; j < count; j++) {
          if (j !== pinIndex) {
            overflow.push(j);
          }
        }
        break;
      }
      used += w;
      displayed.push(i);
    }

    // Reinsert the pinned item at its ordinal position so visible order matches DOM order.
    const insertPos = displayed.findIndex((j) => j > pinIndex);
    if (insertPos === -1) {
      displayed.push(pinIndex);
    } else {
      displayed.splice(insertPos, 0, pinIndex);
    }

    return { displayed, overflow };
  }

  // No pinning — simple first-fit.
  const displayed: number[] = [];
  const overflow: number[] = [];
  let used = 0;
  for (let i = 0; i < count; i++) {
    const w = itemWidths[i] + (i > 0 ? gap : 0);
    if (used + w > containerWidth) {
      for (let j = i; j < count; j++) {
        overflow.push(j);
      }
      break;
    }
    used += w;
    displayed.push(i);
  }
  return { displayed, overflow };
}

/**
 * "Collapse the middle" pack — the breadcrumb pattern. Keeps the ends anchored and
 * overflows the middle, so a long trail renders as `first … lastFewThatFit current`.
 *
 * Priority when space runs out is `last > first > trailing-middle`:
 * - The last item (the current page) is mandatory and never overflows; when nothing
 *   else fits it is displayed on its own rather than dropped.
 * - The first item (the root) is preferred but droppable — kept only when it fits
 *   alongside the last item. At very small widths it collapses into the overflow too.
 * - Remaining space is filled by the items nearest the last one, walking backward, so
 *   the current page's closest ancestors survive.
 *
 * `containerWidth` is the space left for items *after* the caller has reserved the
 * overflow trigger's width, mirroring how `pack` is called for the trailing strategy.
 *
 * @param itemWidths     Natural widths of each item in DOM order, in pixels.
 * @param containerWidth Available width for the row, in pixels.
 * @param gap            Horizontal gap between adjacent items, in pixels.
 */
export function packMiddle(
  itemWidths: readonly number[],
  containerWidth: number,
  gap: number,
): PackedItems {
  const count = itemWidths.length;
  const all = Array.from({ length: count }, (_, i) => i);

  // Not measured, or a single item that can't collapse against itself.
  if (containerWidth <= 0 || count <= 1) {
    return { displayed: all, overflow: [] };
  }

  const totalWidth = itemWidths.reduce((sum, w, i) => sum + w + (i > 0 ? gap : 0), 0);
  if (totalWidth <= containerWidth) {
    return { displayed: all, overflow: [] };
  }

  const last = count - 1;

  // (1) The last item (current page) is always kept.
  let used = itemWidths[last];

  // (2) Keep the first item (root) only when it fits alongside the last.
  const keepFirst = itemWidths[0] + gap + used <= containerWidth;
  if (keepFirst) {
    used += itemWidths[0] + gap;
  }

  // (3) Fill the middle from the end backward — the current page's nearest ancestors
  // win. Stop at the first one that doesn't fit; the run is contiguous.
  const survivors: number[] = [];
  for (let i = last - 1; i >= (keepFirst ? 1 : 0); i--) {
    const w = itemWidths[i] + gap;
    if (used + w > containerWidth) {
      break;
    }
    used += w;
    survivors.push(i);
  }
  survivors.sort((a, b) => a - b);

  const displayed = [...(keepFirst ? [0] : []), ...survivors, last];
  const displayedSet = new Set(displayed);
  const overflow = all.filter((i) => !displayedSet.has(i));

  return { displayed, overflow };
}

export type OverflowStrategy = "end" | "middle";

export type PackOverflowOptions = {
  /** Horizontal gap between adjacent items, in pixels. */
  gap?: number;
  /** Width of the trailing overflow trigger; reserved once anything overflows. */
  triggerWidth?: number;
  /** Reserve the trigger even when everything fits. */
  triggerAlwaysShow?: boolean;
  /** Item kept visible regardless of space (`"end"` strategy only). */
  pinIndex?: number | null;
  strategy?: OverflowStrategy;
};

function indices(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i);
}

/**
 * Full packing decision for an overflow row, including reserving the trigger's width. Shared by
 * `bit-overflow-list`, `attachOverflowList` and any surface that measures its own items.
 *
 * Returns "all displayed" when the container hasn't been measured (`containerWidth <= 0`).
 */
export function packOverflow(
  itemWidths: readonly number[],
  containerWidth: number,
  {
    gap = 0,
    triggerWidth = 0,
    triggerAlwaysShow = false,
    pinIndex = null,
    strategy = "end",
  }: PackOverflowOptions = {},
): PackedItems {
  const count = itemWidths.length;
  if (count === 0 || containerWidth <= 0) {
    return { displayed: indices(count), overflow: [] };
  }

  const totalWidth = itemWidths.reduce((sum, w, i) => sum + w + (i > 0 ? gap : 0), 0);

  // Everything fits and the trigger isn't pinned visible — no need to reserve trigger width,
  // since it'll be hidden anyway.
  if (!triggerAlwaysShow && totalWidth <= containerWidth) {
    return pack(itemWidths, containerWidth, gap, pinIndex);
  }

  const triggerReserve = triggerWidth > 0 ? triggerWidth + gap : 0;
  const available = containerWidth - triggerReserve;

  if (strategy === "middle") {
    // No room even for the current page after reserving the trigger. Keep the last item
    // displayed anyway — `packMiddle` reads a non-positive budget as "not measured".
    if (available <= 0) {
      return { displayed: [count - 1], overflow: indices(count - 1) };
    }
    return packMiddle(itemWidths, available, gap);
  }

  // `pack` treats a non-positive container as "not measured", so decide here instead. A pinned
  // item still has to stay visible.
  if (available <= 0) {
    const pin = pinIndex !== null && pinIndex >= 0 && pinIndex < count ? pinIndex : null;
    return pin === null
      ? { displayed: [], overflow: indices(count) }
      : { displayed: [pin], overflow: indices(count).filter((i) => i !== pin) };
  }

  return pack(itemWidths, available, gap, pinIndex);
}
